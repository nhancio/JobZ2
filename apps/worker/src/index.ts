import './bootstrap.js';
import { db, appendLog, type AutoApplyJobRow, type LogEntry } from './firebase.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { runLinkedInEasyApply } from './automation.js';
import { runLinkedInSearchAndApply } from './automation-search.js';
import { getMatchScore } from './gemini.js';

const DEFAULT_MAX_RETRIES = 3;

async function getSystemSettings(): Promise<{ maxRetries: number; maintenanceMode: boolean }> {
  const maxRetriesDoc = await db.collection('system_settings').doc('max_retries').get();
  const raw = (maxRetriesDoc.exists ? maxRetriesDoc.data()?.value : null) ?? DEFAULT_MAX_RETRIES;
  const maxRetries = typeof raw === 'number' ? raw : parseInt(String(raw), 10) || DEFAULT_MAX_RETRIES;

  const maintenanceDoc = await db.collection('system_settings').doc('maintenance_mode').get();
  const maintenanceMode = maintenanceDoc.exists && maintenanceDoc.data()?.value === true;

  return { maxRetries, maintenanceMode };
}

async function isAiMatchingEnabled(): Promise<boolean> {
  const doc = await db.collection('feature_flags').doc('ai_matching_enabled').get();
  return doc.exists ? doc.data()?.enabled ?? false : false;
}

async function runSearchAndApplyFlow(
  job: AutoApplyJobRow,
  jobId: string,
  currentLogs: LogEntry[],
  onLog: (entry: LogEntry) => void
): Promise<{ success: boolean; appliedCount: number; logs: LogEntry[]; error?: string }> {
  // Get resume
  let resumeData: Record<string, unknown> = {};
  if (job.resume_id) {
    const resumeDoc = await db.collection('resumes').doc(job.resume_id).get();
    if (resumeDoc.exists && resumeDoc.data()?.user_id === job.user_id) {
      resumeData = (resumeDoc.data()?.resume_json as Record<string, unknown>) ?? {};
    }
  } else {
    // Fall back to user's primary resume (doc ID == user_id)
    const resumeDoc = await db.collection('resumes').doc(job.user_id).get();
    if (resumeDoc.exists) {
      resumeData = (resumeDoc.data()?.resume_json as Record<string, unknown>) ?? {};
    }
  }

  const prefsDoc = await db.collection('job_preferences').doc(job.user_id).get();
  const prefs    = prefsDoc.exists ? prefsDoc.data() : null;

  const jobTitles  = Array.isArray(prefs?.keywords)  ? (prefs!.keywords  as string[]) : [];
  const locations  = Array.isArray(prefs?.locations) ? (prefs!.locations as string[]) : [];
  const resumeTitles    = (resumeData.job_titles as string[]) ?? [];
  const resumeLocations = (resumeData.preferred_locations as string[]) ?? [];
  const finalTitles    = jobTitles.length  ? jobTitles  : resumeTitles;
  const finalLocations = locations.length ? locations : resumeLocations;

  const sessionDoc = await db.collection('linkedin_sessions').doc(job.user_id).get();
  let cookiesRaw = sessionDoc.exists ? sessionDoc.data()?.cookies_json : undefined;
  if (typeof cookiesRaw === 'string') {
    try { cookiesRaw = JSON.parse(cookiesRaw); } catch { cookiesRaw = []; }
  }
  const cookies = Array.isArray(cookiesRaw)
    ? (cookiesRaw as { name: string; value: string; domain?: string; path?: string }[])
    : [];

  const result = await runLinkedInSearchAndApply(
    { jobTitles: finalTitles, locations: finalLocations, resumeData, cookies },
    onLog
  );

  for (const applied of result.appliedJobs) {
    await db.collection('applied_jobs').add({
      user_id:          job.user_id,
      auto_apply_job_id: jobId,
      job_url:          applied.job_url,
      job_title:        applied.job_title,
      company_name:     applied.company_name,
      job_location:     applied.job_location,
      status:           'applied',
      applied_at:       new Date().toISOString(),
      created_at:       new Date().toISOString(),
    });
  }

  return {
    success:      result.success,
    appliedCount: result.appliedCount,
    logs:         result.logs,
    error:        result.error,
  };
}

async function fetchPendingJob(): Promise<AutoApplyJobRow | null> {
  try {
    const snap = await db.collection('auto_apply_jobs')
      .where('status', '==', 'pending')
      .orderBy('created_at', 'asc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as AutoApplyJobRow;
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
  try {
    await db.collection('auto_apply_jobs').doc(id).update({
      ...updates,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Update job failed', { id, error: String(err) });
  }
}

async function processJob(job: AutoApplyJobRow): Promise<void> {
  const jobId = job.id;
  logger.info('Processing job', { jobId, dryRun: job.dry_run });

  await updateJob(jobId, {
    status:   'running',
    progress: 10,
    logs:     appendLog(job.logs, { level: 'info', message: 'Worker picked up job' }),
  });

  let currentLogs = appendLog(job.logs, { level: 'info', message: 'Worker picked up job' });

  const onLog = (entry: LogEntry) => {
    currentLogs = appendLog(currentLogs, { level: entry.level, message: entry.message });
    void db.collection('auto_apply_jobs').doc(jobId).update({ logs: currentLogs });
  };

  if (!job.job_url) {
    const searchResult = await runSearchAndApplyFlow(job, jobId, currentLogs, onLog);
    await updateJob(jobId, {
      status:     searchResult.success ? 'completed' : 'failed',
      progress:   searchResult.success ? 100 : 50,
      logs:       searchResult.logs,
      last_error: searchResult.error ?? null,
    });
    logger.info('Search-and-apply finished', { jobId, appliedCount: searchResult.appliedCount });
    return;
  }

  const result = await runLinkedInEasyApply(job.job_url, job.dry_run, (e) => {
    currentLogs = appendLog(currentLogs, { level: e.level, message: e.message });
  });

  await updateJob(jobId, {
    progress:   result.progress,
    logs:       result.logs,
    last_error: result.error ?? null,
  });

  if (result.success && !job.dry_run) {
    let matchScore: number | null = null;
    const aiEnabled = await isAiMatchingEnabled();
    if (config.geminiApiKey && aiEnabled) {
      try {
        matchScore = await getMatchScore('Resume on file', job.job_title ?? 'Job', job.job_url);
      } catch {
        matchScore = null;
      }
    }

    const prefsDoc  = await db.collection('job_preferences').doc(job.user_id).get();
    const threshold = (prefsDoc.exists ? prefsDoc.data()?.match_threshold : null) ?? 0;
    const shouldRecord = matchScore === null || matchScore >= threshold;

    if (shouldRecord) {
      await db.collection('applied_jobs').add({
        user_id:          job.user_id,
        auto_apply_job_id: jobId,
        job_url:          job.job_url,
        job_title:        job.job_title,
        company_name:     job.company_name,
        match_score:      matchScore,
        applied_at:       new Date().toISOString(),
        created_at:       new Date().toISOString(),
      });
    } else {
      logger.info('Skipped recording applied_job (score below threshold)', { jobId, matchScore, threshold });
    }
  }

  const { maxRetries } = await getSystemSettings();
  const newStatus = result.success ? 'completed' : job.retry_count + 1 >= maxRetries ? 'failed' : 'pending';
  const newRetry  = result.success ? job.retry_count : job.retry_count + 1;

  await updateJob(jobId, {
    status:      newStatus,
    progress:    result.success ? 100 : result.progress,
    retry_count: newRetry,
    last_error:  result.error ?? null,
  });

  logger.info('Job finished', { jobId, status: newStatus, success: result.success });
}

async function checkFirestoreConnection(): Promise<boolean> {
  try {
    await db.collection('system_settings').limit(1).get();
    logger.info('Firestore connection OK');
    return true;
  } catch (err) {
    logger.error('Firestore connection failed', { error: String(err) });
    return false;
  }
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

async function main(): Promise<void> {
  logger.info('Worker started', { pollIntervalMs: config.pollIntervalMs });
  await checkFirestoreConnection();
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
