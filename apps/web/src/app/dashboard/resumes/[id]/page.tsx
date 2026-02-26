import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { FileText } from 'lucide-react';
import { ResumeActions } from './ResumeActions';

export default async function ResumeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await getSessionUserId();
  if (!userId) return null;
  const supabase = createAdminClient();

  const { data: resume } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!resume) notFound();

  const resumeJson = (resume.resume_json as Record<string, unknown>) ?? {};
  const hasJson = resumeJson && Object.keys(resumeJson).length > 0;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/resumes" className="text-sm text-primary-600 hover:underline">Back to resumes</Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <FileText className="h-12 w-12 text-primary-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">{resume.name}</h1>
            {(resume.is_active || resume.is_default) && (
              <span className="text-sm text-primary-600">{resume.is_active ? 'Active' : 'Default'}</span>
            )}
          </div>
        </div>
        <ResumeActions resumeId={id} isActive={!!resume.is_active} />
        {hasJson && (
          <pre className="mt-6 overflow-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            {JSON.stringify(resumeJson, null, 2)}
          </pre>
        )}
        {resume.content && typeof resume.content === 'object' && Object.keys(resume.content as object).length > 0 && !hasJson && (
          <pre className="mt-6 overflow-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            {JSON.stringify(resume.content, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
