'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export function StartAutoApplyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auto-apply/start', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to start');
        return;
      }
      toast.success(data.message ?? 'Started');
      router.push('/dashboard/jobs');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
    >
      <Plus className="h-4 w-4" />
      {loading ? 'Starting…' : 'New auto-apply job'}
    </button>
  );
}
