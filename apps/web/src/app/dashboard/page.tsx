import Link from 'next/link';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS } from '@/lib/types/database';
import { StartAutoApplyButton } from '@/components/dashboard/StartAutoApplyButton';
import {
  FileText,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const supabase = createAdminClient();

  const [
    { data: usage },
    { data: jobs },
    { data: appliedList },
    appliedCountRes,
    { data: resumes },
    queueCountRes,
  ] = await Promise.all([
    supabase.from('usage_counters').select('*').eq('user_id', userId).single(),
    supabase
      .from('auto_apply_jobs')
      .select('id, status, progress, job_title, company_name, created_at, dry_run')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('applied_jobs')
      .select('id, job_title, company_name, match_score, applied_at, job_url')
      .eq('user_id', userId)
      .order('applied_at', { ascending: false })
      .limit(5),
    supabase.from('applied_jobs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('resumes').select('id, name, is_default, is_active').eq('user_id', userId),
    supabase
      .from('auto_apply_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'running']),
  ]);
  const applied = appliedList ?? [];
  const appliedCount = appliedCountRes?.count ?? 0;
  const queueCount = queueCountRes?.count ?? 0;

  const limit = usage ? PLAN_LIMITS[usage.plan_type as keyof typeof PLAN_LIMITS] ?? 5 : 5;
  const used = usage?.applications_today ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <StartAutoApplyButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Target className="h-10 w-10 text-primary-500" />
            <div>
              <p className="text-sm font-medium text-slate-500">Usage today</p>
              <p className="text-2xl font-bold text-slate-900">
                {used} / {limit}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <FileText className="h-10 w-10 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-500">Resumes</p>
              <p className="text-2xl font-bold text-slate-900">{resumes?.length ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-10 w-10 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-slate-500">Jobs in queue</p>
              <p className="text-2xl font-bold text-slate-900">{queueCount ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm font-medium text-slate-500">Applied</p>
              <p className="text-2xl font-bold text-slate-900">{appliedCount ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recent auto-apply jobs</h2>
          </div>
          <ul className="divide-y divide-slate-200">
            {jobs?.length ? (
              jobs.map((job: { id: string; job_title: string | null; company_name: string | null; status: string; progress: number; dry_run: boolean }) => (
                <li key={job.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{job.job_title || 'Untitled'}</p>
                    <p className="truncate text-sm text-slate-500">{job.company_name || '—'}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <StatusBadge status={job.status} />
                    {job.dry_run && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Dry run
                      </span>
                    )}
                    <span className="text-sm text-slate-400">{job.progress}%</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-5 py-8 text-center text-slate-500">No jobs yet</li>
            )}
          </ul>
          <div className="border-t border-slate-200 px-5 py-3">
            <Link
              href="/dashboard/jobs"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              View all jobs →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recently applied</h2>
          </div>
          <ul className="divide-y divide-slate-200">
            {applied?.length ? (
              applied?.map((a: { id: string; job_title: string | null; company_name: string | null; match_score: number | null; applied_at: string; job_url: string }) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{a.job_title || 'Untitled'}</p>
                    <p className="truncate text-sm text-slate-500">{a.company_name || '—'}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    {a.match_score != null && (
                      <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                        {a.match_score}% match
                      </span>
                    )}
                    <a
                      href={a.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-primary-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-5 py-8 text-center text-slate-500">No applications yet</li>
            )}
          </ul>
          <div className="border-t border-slate-200 px-5 py-3">
            <Link
              href="/dashboard/applied"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              View applied history →
            </Link>
          </div>
        </div>
      </div>

      {used >= limit && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            You&apos;ve reached your daily application limit ({limit}). Upgrade to pro for more.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700',
    running: 'bg-primary-100 text-primary-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-slate-100'}`}>
      {status}
    </span>
  );
}
