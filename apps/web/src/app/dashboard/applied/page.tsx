import { createClient } from '@/lib/supabase/server';
import type { AppliedJob } from '@/lib/types/database';
import { ExternalLink } from 'lucide-react';

export default async function AppliedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: applied } = await supabase
    .from('applied_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('applied_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Applied jobs</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Job</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Match score</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Applied</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {applied?.map((a: AppliedJob) => (
              <tr key={a.id}>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-900">{a.job_title || 'Untitled'}</p>
                  <p className="text-sm text-slate-500">{a.company_name || '—'}</p>
                </td>
                <td className="px-5 py-4">
                  {a.match_score != null ? (
                    <span className="rounded bg-primary-100 px-2 py-1 text-sm font-medium text-primary-700">{a.match_score}%</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">{new Date(a.applied_at).toLocaleString()}</td>
                <td className="px-5 py-4 text-right">
                  <a href={a.job_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                    <ExternalLink className="inline h-4 w-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!applied || applied.length === 0) && (
          <div className="py-12 text-center text-slate-500">No applications yet.</div>
        )}
      </div>
    </div>
  );
}
