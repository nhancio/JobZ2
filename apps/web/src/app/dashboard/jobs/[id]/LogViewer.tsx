'use client';

import { useEffect, useState } from 'react';
import type { LogEntry } from '@/lib/types/database';

export function LogViewer({
  initialLogs,
  jobId,
}: {
  initialLogs: LogEntry[];
  jobId: string;
}) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  useEffect(() => {
    let closed = false;
    try {
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      es.onmessage = (e) => {
        if (closed) return;
        try {
          const data = JSON.parse(e.data as string) as { logs?: LogEntry[] };
          if (data && Array.isArray(data.logs)) setLogs(data.logs);
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        es.close();
      };
      return () => {
        closed = true;
        es.close();
      };
    } catch {
      // EventSource not available (e.g. some browsers), fall back to polling
      const interval = setInterval(() => {
        if (closed) return;
        fetch(`/api/jobs/${jobId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((job: { logs?: LogEntry[] } | null) => {
            if (job && Array.isArray(job.logs)) setLogs(job.logs);
          })
          .catch(() => {});
      }, 2000);
      return () => {
        closed = true;
        clearInterval(interval);
      };
    }
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
