'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewResumePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [parseAfter, setParseAfter] = useState(true);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];
    if (!file) {
      toast.error('Select a PDF or DOC file');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch('/api/resume/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Upload failed');
        return;
      }
      toast.success('Resume uploaded');
      if (parseAfter && data.id) {
        const parseRes = await fetch('/api/resume/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_id: data.id }),
        });
        if (parseRes.ok) toast.success('Resume parsed');
        else toast.error('Parse failed');
      }
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
      <h1 className="text-2xl font-bold text-slate-900">Upload resume</h1>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-slate-700">
            File (PDF, DOC, DOCX or TXT, max 5MB)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-primary-700"
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="parse_after"
            type="checkbox"
            checked={parseAfter}
            onChange={(e) => setParseAfter(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600"
          />
          <label htmlFor="parse_after" className="text-sm text-slate-700">
            Parse with Gemini (extract skills, job titles, locations)
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Uploading…' : 'Upload'}
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
