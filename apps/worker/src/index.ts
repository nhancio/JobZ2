import { supabase, appendLog, type AutoApplyJobRow, type LogEntry } from './supabase.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { runLinkedInEasyApply } from './automation.js';
import { getMatchScore } from './gemini.js';

const MAX_RETRIES = 3;

async function fetchPendingJob(): Promise<AutoApplyJobRow | null> {
  const { data, error } = await supabase
    .from('auto_apply_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Fetch pending job failed', { error: error.message });
    return null;
  }
  return data as AutoApplyJobRow | null;
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
    try {
      const resumeSummary = 'Resume on file';
      const jobTitle = job.job_title ?? 'Job';
      const jobDesc = job.job_url;
      matchScore = await getMatchScore(resumeSummary, jobTitle, jobDesc);
    } catch {
      matchScore = null;
    }
    await supabase.from('applied_jobs').insert({
      user_id: job.user_id,
      auto_apply_job_id: jobId,
      job_url: job.job_url,
      job_title: job.job_title,
      company_name: job.company_name,
      match_score: matchScore,
    });
  }

  const newStatus = result.success ? 'completed' : job.retry_count + 1 >= MAX_RETRIES ? 'failed' : 'pending';
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
  const job = await fetchPendingJob();
  if (job) {
    await processJob(job);
  }
}

async function main(): Promise<void> {
  logger.info('Worker started', { pollIntervalMs: config.pollIntervalMs });
  for (;;) {
    try {
      await poll();
    } catch (err) {
      logger.error('Poll cycle error', { error: String(err) });
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
  }
}

main();
