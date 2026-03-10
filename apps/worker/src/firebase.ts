import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)),
  });
}

const _db = getFirestore(getAdminApp());
_db.settings({ ignoreUndefinedProperties: true });
export const db = _db;

export type AutoApplyJobRow = {
  id: string;
  user_id: string;
  resume_id: string | null;
  job_url: string | null;
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
