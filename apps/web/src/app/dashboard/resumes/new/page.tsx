'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createResumeSchema, type CreateResumeInput } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function NewResumePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateResumeInput>({
    resolver: zodResolver(createResumeSchema),
    defaultValues: { name: '', content: {}, is_default: false },
  });

  const onSubmit = async (data: CreateResumeInput) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('resumes').insert({
        name: data.name,
        content: data.content,
        is_default: data.is_default ?? false,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Resume created');
      router.push('/dashboard/resumes');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/dashboard/resumes" className="text-sm text-primary-600 hover:underline">
        Back to resumes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Add resume</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            {...register('name')}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="is_default"
            type="checkbox"
            {...register('is_default')}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="is_default" className="text-sm text-slate-700">
            Use as default for auto-apply
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <Link
            href="/dashboard/resumes"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
