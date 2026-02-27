import './bootstrap.js';
import { supabase, appendLog, type AutoApplyJobRow, type LogEntry } from './supabase.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { runLinkedInEasyApply } from './automation.js';
import { runLinkedInSearchAndApply } from './automation-search.js';
import { getMatchScore } from './gemini.js';

const DEFAULT_MAX_RETRIES = 3;

async function getSystemSettings(): Promise<{ maxRetries: number; maintenanceMode: boolean }> {
  const { data: maxRetriesRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'max_retries')
    .single();
  const raw = (maxRetriesRow?.value as number | string | null) ?? DEFAULT_MAX_RETRIES;
  const maxRetries = typeof raw === 'number' ? raw : parseInt(String(raw), 10) || DEFAULT_MAX_RETRIES;

  const { data: maintenanceRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .single();
  const maintenanceMode = maintenanceRow?.value === true;

  return { maxRetries, maintenanceMode };
}

async function isAiMatchingEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'ai_matching_enabled')
    .single();
  return (data as { enabled?: boolean } | null)?.enabled ?? false;
}

async function runSearchAndApplyFlow(
  job: AutoApplyJobRow,
  jobId: string,
  currentLogs: LogEntry[],
  onLog: (entry: LogEntry) => void
): Promise<{ success: boolean; appliedCount: number; logs: LogEntry[]; error?: string }> {
  const resumeId = job.resume_id;
  const { data: resume } = resumeId
    ? await supabase.from('resumes').select('resume_json').eq('id', resumeId).eq('user_id', job.user_id).single()
    : await supabase.from('resumes').select('resume_json').eq('user_id', job.user_id).eq('is_active', true).single();

  const resumeData = (resume?.resume_json as Record<string, unknown>) ?? {};

  const { data: prefs } = await supabase
    .from('job_preferences')
    .select('keywords, locations')
    .eq('user_id', job.user_id)
    .single();

  const jobTitles = Array.isArray((prefs as { keywords?: string[] })?.keywords) ? (prefs as { keywords: string[] }).keywords : [];
  const locations = Array.isArray((prefs as { locations?: string[] })?.locations) ? (prefs as { locations: string[] }).locations : [];
  const resumeTitles = (resumeData.job_titles as string[]) ?? [];
  const resumeLocations = (resumeData.preferred_locations as string[]) ?? [];
  const finalTitles = jobTitles.length ? jobTitles : resumeTitles;
  const finalLocations = locations.length ? locations : resumeLocations;

  const { data: session } = await supabase
    .from('linkedin_sessions')
    .select('cookies_json')
    .eq('user_id', job.user_id)
    .single();

  let cookiesRaw = (session as { cookies_json?: unknown })?.cookies_json;
  if (typeof cookiesRaw === 'string') {
    try {
      cookiesRaw = JSON.parse(cookiesRaw) as unknown;
    } catch {
      cookiesRaw = [];
    }
  }
  const cookies = Array.isArray(cookiesRaw)
    ? (cookiesRaw as { name: string; value: string; domain?: string; path?: string }[])
    : [];

  const result = await runLinkedInSearchAndApply(
    {
      jobTitles: finalTitles,
      locations: finalLocations,
      resumeData,
      cookies,
    },
    onLog
  );

  for (const applied of result.appliedJobs) {
    await supabase.from('applied_jobs').insert({
      user_id: job.user_id,
      auto_apply_job_id: jobId,
      job_url: applied.job_url,
      job_title: applied.job_title,
      company_name: applied.company_name,
      job_location: applied.job_location,
      status: 'applied',
    });
  }

  return {
    success: result.success,
    appliedCount: result.appliedCount,
    logs: result.logs,
    error: result.error,
  };
}

async function fetchPendingJob(): Promise<AutoApplyJobRow | null> {
  try {
    const { data, error } = await supabase
      .from('auto_apply_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') return null;
    return data as AutoApplyJobRow | null;
  } catch {
    return null;
  }
}

async function updateJob(
  id: string,
  updates: {
    status?: string;
    progress?: number;
    logs?: LogEntry[];
    last_error?: string | null;
    retry_count?: number;
  }
) {
  const { error } = await supabase.from('auto_apply_jobs').update(updates).eq('id', id);
  if (error) logger.error('Update job failed', { id, error: error.message });
}

async function processJob(job: AutoApplyJobRow): Promise<void> {
  const jobId = job.id;
  logger.info('Processing job', { jobId, dryRun: job.dry_run });

  await updateJob(jobId, {
    status: 'running',
    progress: 10,
    logs: appendLog(job.logs, { level: 'info', message: 'Worker picked up job' }),
  });

  let currentLogs = appendLog(job.logs, { level: 'info', message: 'Worker picked up job' });

  const onLog = (entry: LogEntry) => {
    currentLogs = appendLog(currentLogs, { level: entry.level, message: entry.message });
    void supabase.from('auto_apply_jobs').update({ logs: currentLogs }).eq('id', jobId);
  };

  if (!job.job_url) {
    const searchResult = await runSearchAndApplyFlow(job, jobId, currentLogs, onLog);
    await updateJob(jobId, {
      status: searchResult.success ? 'completed' : 'failed',
      progress: searchResult.success ? 100 : 50,
      logs: searchResult.logs,
      last_error: searchResult.error ?? null,
    });
    logger.info('Search-and-apply finished', { jobId, appliedCount: searchResult.appliedCount });
    return;
  }

  const result = await runLinkedInEasyApply(job.job_url, job.dry_run, (e) => {
    currentLogs = appendLog(currentLogs, { level: e.level, message: e.message });
  });

  await updateJob(jobId, {
    progress: result.progress,
    logs: result.logs,
    last_error: result.error ?? null,
  });

  if (result.success && !job.dry_run) {
    let matchScore: number | null = null;
    const aiEnabled = await isAiMatchingEnabled();
    if (config.geminiApiKey && aiEnabled) {
      try {
        const resumeSummary = 'Resume on file';
        const jobTitle = job.job_title ?? 'Job';
        const jobDesc = job.job_url;
        matchScore = await getMatchScore(resumeSummary, jobTitle, jobDesc);
      } catch {
        matchScore = null;
      }
    }
    const { data: prefs } = await supabase
      .from('job_preferences')
      .select('match_threshold')
      .eq('user_id', job.user_id)
      .single();
    const threshold = (prefs as { match_threshold?: number } | null)?.match_threshold ?? 0;
    const shouldRecord = matchScore === null || matchScore >= threshold;
    if (shouldRecord) {
      await supabase.from('applied_jobs').insert({
        user_id: job.user_id,
        auto_apply_job_id: jobId,
        job_url: job.job_url,
        job_title: job.job_title,
        company_name: job.company_name,
        match_score: matchScore,
      });
    } else {
      logger.info('Skipped recording applied_job (score below threshold)', {
        jobId,
        matchScore,
        threshold,
      });
    }
  }

  const { maxRetries } = await getSystemSettings();
  const newStatus = result.success ? 'completed' : job.retry_count + 1 >= maxRetries ? 'failed' : 'pending';
  const newRetry = result.success ? job.retry_count : job.retry_count + 1;

  await updateJob(jobId, {
    status: newStatus,
    progress: result.success ? 100 : result.progress,
    retry_count: newRetry,
    last_error: result.error ?? null,
  });

  logger.info('Job finished', { jobId, status: newStatus, success: result.success });
}

async function poll(): Promise<void> {
  const { maintenanceMode } = await getSystemSettings();
  if (maintenanceMode) {
    logger.info('Maintenance mode enabled, skipping poll');
    return;
  }
  const job = await fetchPendingJob();
  if (job) {
    await processJob(job);
  }
}

async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('system_settings').select('key').limit(1);
    if (error) throw new Error(error.message);
    const url = config.supabaseUrl.replace(/^https?:\/\//, '').split('/')[0];
    logger.info('Supabase connection OK', { host: url });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  logger.info('Worker started', { pollIntervalMs: config.pollIntervalMs });
  await checkSupabaseConnection();
  for (;;) {
    try {
      await poll();
    } catch {
      // retry quietly
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
  }
}

main();
