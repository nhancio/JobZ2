'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobPreferencesSchema, type JobPreferencesInput } from '@/lib/schemas';
import { toast } from 'sonner';

export default function PreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JobPreferencesInput>({
    resolver: zodResolver(jobPreferencesSchema),
    defaultValues: {
      keywords: [],
      locations: [],
      remote_only: false,
      min_salary: null,
      industries: [],
      experience_level: [],
      match_threshold: 70,
    },
  });

  const keywordsStr = watch('keywords');
  const locationsStr = watch('locations');

  useEffect(() => {
    fetch('/api/preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { keywords?: string[]; locations?: string[]; remote_only?: boolean; min_salary?: number | null; industries?: string[]; experience_level?: string[]; match_threshold?: number } | null) => {
        if (data) {
          setValue('keywords', data.keywords ?? []);
          setValue('locations', data.locations ?? []);
          setValue('remote_only', data.remote_only ?? false);
          setValue('min_salary', data.min_salary);
          setValue('industries', data.industries ?? []);
          setValue('experience_level', data.experience_level ?? []);
          setValue('match_threshold', data.match_threshold ?? 70);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [setValue]);

  const onSubmit = async (data: JobPreferencesInput) => {
    setSaving(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: data.keywords,
          locations: data.locations,
          remote_only: data.remote_only,
          min_salary: data.min_salary,
          industries: data.industries,
          experience_level: data.experience_level,
          match_threshold: data.match_threshold,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? 'Failed to save');
        return;
      }
      toast.success('Preferences saved');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-500">Loading preferences…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Job preferences</h1>
      <p className="text-slate-600">
        Override job titles (keywords) and locations for automatic job search. If empty, resume data is used.
        Match threshold: only jobs with score ≥ threshold are recorded.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700">Job titles / keywords (comma-separated, for search)</label>
          <input
            type="text"
            placeholder="e.g. React, TypeScript, Node.js"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            defaultValue={keywordsStr?.join(', ')}
            onChange={(e) =>
              setValue(
                'keywords',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Locations (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. New York, Remote, San Francisco"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            defaultValue={locationsStr?.join(', ')}
            onChange={(e) =>
              setValue(
                'locations',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="remote_only"
            type="checkbox"
            {...register('remote_only')}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="remote_only" className="text-sm text-slate-700">
            Prefer remote only
          </label>
        </div>
        <div>
          <label htmlFor="min_salary" className="block text-sm font-medium text-slate-700">
            Min salary (optional)
          </label>
          <input
            id="min_salary"
            type="number"
            {...register('min_salary', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="match_threshold" className="block text-sm font-medium text-slate-700">
            Match threshold (0–100). Apply only if AI score ≥ this value.
          </label>
          <input
            id="match_threshold"
            type="number"
            min={0}
            max={100}
            {...register('match_threshold', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {errors.match_threshold && (
            <p className="mt-1 text-sm text-red-600">{errors.match_threshold.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </form>
    </div>
  );
}
