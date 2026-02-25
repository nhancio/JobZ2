import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { FileText } from 'lucide-react';

export default async function ResumeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: resume } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!resume) notFound();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/resumes" className="text-sm text-primary-600 hover:underline">Back to resumes</Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <FileText className="h-12 w-12 text-primary-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">{resume.name}</h1>
            {resume.is_default && <span className="text-sm text-primary-600">Default</span>}
          </div>
        </div>
        {resume.content && Object.keys(resume.content as object).length > 0 && (
          <pre className="mt-6 overflow-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            {JSON.stringify(resume.content, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
