import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Resume } from '@/lib/types/database';
import { FileText, Plus } from 'lucide-react';

export default async function ResumesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: resumes } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Resumes</h1>
        <Link
          href="/dashboard/resumes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add resume
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumes?.map((r: Resume) => (
          <Link
            key={r.id}
            href={`/dashboard/resumes/${r.id}`}
            className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-primary-200"
          >
            <FileText className="h-10 w-10 shrink-0 text-primary-500" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{r.name}</p>
              {r.is_default && (
                <span className="mt-1 inline-block text-xs text-primary-600">Default</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      {(!resumes || resumes.length === 0) && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-slate-600">No resumes yet</p>
          <Link
            href="/dashboard/resumes/new"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add your first resume
          </Link>
        </div>
      )}
    </div>
  );
}
