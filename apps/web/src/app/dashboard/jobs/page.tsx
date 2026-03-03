import Link from 'next/link';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AutoApplyJob } from '@/lib/types/database';
import { StartAutoApplyButton } from '@/components/dashboard/StartAutoApplyButton';
import { Clock, ExternalLink } from 'lucide-react';

export default async function JobsPage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const supabase = createAdminClient();

  const { data: jobs } = await supabase
    .from('auto_apply_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    running: 'bg-primary-100 text-primary-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Auto-apply jobs</h1>
        <StartAutoApplyButton />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Job
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Progress
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">
                Created
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {jobs?.map((job: AutoApplyJob) => (
              <tr key={job.id}>
                <td className="px-5 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{job.job_title || 'Untitled'}</p>
                    <p className="text-sm text-slate-500">{job.company_name || '—'}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusColors[job.status] ?? 'bg-slate-100'}`}
                  >
                    {job.status}
                  </span>
                  {job.dry_run && (
                    <span className="ml-2 text-xs text-slate-500">Dry run</span>
                  )}
                </td>
                <td className="px-5 py-4">{job.progress}%</td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {new Date(job.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    View
                  </Link>
                  {job.job_url && (
                    <a
                      href={job.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 text-slate-400 hover:text-primary-600"
                    >
                      <ExternalLink className="inline h-4 w-4" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!jobs || jobs.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-slate-400" />
            <p className="mt-2 text-slate-500">No jobs yet</p>
            <div className="mt-4">
              <StartAutoApplyButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
