'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LogEntry } from '@/lib/types/database';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function LogViewer({
  initialLogs,
  jobId,
}: {
  initialLogs: LogEntry[];
  jobId: string;
}) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auto_apply_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newData = payload.new as { logs?: LogEntry[] };
          if (Array.isArray(newData.logs)) {
            setLogs(newData.logs);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  if (logs.length === 0) {
    return (
      <div className="px-5 py-8 font-mono text-sm text-slate-500">No logs yet.</div>
    );
  }

  return (
    <div className="max-h-96 overflow-auto px-5 py-4 font-mono text-sm">
      {logs.map((entry, i) => (
        <div
          key={i}
          className={`flex gap-2 border-b border-slate-100 py-1 ${
            entry.level === 'error'
              ? 'text-red-700'
              : entry.level === 'warn'
                ? 'text-amber-700'
                : 'text-slate-700'
          }`}
        >
          <span className="shrink-0 text-slate-400">{entry.ts}</span>
          <span className="shrink-0 font-medium">{entry.level}</span>
          <span>{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
