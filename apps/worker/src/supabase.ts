import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});

export type AutoApplyJobRow = {
  id: string;
  user_id: string;
  resume_id: string | null;
  job_url: string;
  job_title: string | null;
  company_name: string | null;
  status: string;
  progress: number;
  logs: LogEntry[];
  retry_count: number;
  last_error: string | null;
  dry_run: boolean;
  created_at: string;
  updated_at: string;
};

export interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export function appendLog(logs: LogEntry[], entry: Omit<LogEntry, 'ts'>): LogEntry[] {
  return [...logs, { ...entry, ts: new Date().toISOString() }];
}
