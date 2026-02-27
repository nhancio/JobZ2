'use client';

import { useState } from 'react';
import { Linkedin } from 'lucide-react';
import { toast } from 'sonner';

export function ConnectLinkedInButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/linkedin/connect', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create connect request');
        return;
      }
      toast.success(
        'Connect request queued. In the worker folder run: npm run linkedin:connect — then log in in the browser that opens.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <Linkedin className="h-4 w-4" />
      {loading ? 'Queuing…' : 'Connect LinkedIn'}
    </button>
  );
}
