'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { autoApplyJobSchema, type AutoApplyJobInput } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';
import type { Resume } from '@/lib/types/database';
import { toast } from 'sonner';

export default function ApplyPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<AutoApplyJobInput>({
    resolver: zodResolver(autoApplyJobSchema),
    defaultValues: { job_url: '', dry_run: true },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.from('resumes').select('*').order('is_default', { ascending: false }).then(({ data }) => setResumes(data ?? []));
  }, []);

  const onSubmit = async (data: AutoApplyJobInput) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_url: data.job_url,
          job_title: data.job_title || null,
          company_name: data.company_name || null,
          resume_id: data.resume_id || null,
          dry_run: data.dry_run ?? true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to create job');
        return;
      }
      toast.success('Job queued');
      router.push('/dashboard/jobs');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">Back</Link>
      <h1 className="text-2xl font-bold text-slate-900">New auto-apply job</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="job_url" className="block text-sm font-medium text-slate-700">Job URL *</label>
          <input id="job_url" type="url" {...register('job_url')} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          {errors.job_url && <p className="mt-1 text-sm text-red-600">{errors.job_url.message}</p>}
        </div>
        <div>
          <label htmlFor="job_title" className="block text-sm font-medium text-slate-700">Job title</label>
          <input id="job_title" type="text" {...register('job_title')} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="company_name" className="block text-sm font-medium text-slate-700">Company</label>
          <input id="company_name" type="text" {...register('company_name')} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="resume_id" className="block text-sm font-medium text-slate-700">Resume</label>
          <select id="resume_id" {...register('resume_id')} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Default</option>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="dry_run" type="checkbox" {...register('dry_run')} className="h-4 w-4 rounded" />
          <label htmlFor="dry_run" className="text-sm text-slate-700">Dry run</label>
        </div>
        <button type="submit" disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2.5 text-white hover:bg-primary-700 disabled:opacity-50">{submitting ? 'Queueing…' : 'Queue job'}</button>
      </form>
    </div>
  );
}
