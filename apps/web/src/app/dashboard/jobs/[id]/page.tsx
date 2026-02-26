import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { LogViewer } from './LogViewer';

export default async function JobDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await getSessionUserId();
  if (!userId) return null;
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('auto_apply_jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!job) notFound();

  const logs = Array.isArray(job.logs) ? job.logs : [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/jobs" className="text-sm text-primary-600 hover:underline">Back to jobs</Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{job.job_title || 'Untitled job'}</h1>
        <p className="text-slate-600">{job.company_name || '—'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded bg-slate-100 px-2 py-1 text-sm">Status: {job.status}</span>
          <span className="rounded bg-slate-100 px-2 py-1 text-sm">Progress: {job.progress}%</span>
          {job.dry_run && <span className="rounded bg-amber-100 px-2 py-1 text-sm">Dry run</span>}
        </div>
        {job.last_error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Last error</p>
            <p className="mt-1 text-sm text-red-700">{job.last_error}</p>
          </div>
        )}
        {job.job_url && (
          <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-primary-600 hover:underline">Open job URL</a>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Logs</h2>
        </div>
        <LogViewer initialLogs={logs} jobId={id} />
      </div>
    </div>
  );
}
