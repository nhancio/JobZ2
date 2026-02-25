export type PlanType = 'free_plan' | 'pro_plan';

export type AutoApplyJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan_type: PlanType;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  content: Record<string, unknown>;
  file_path: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobPreferences {
  id: string;
  user_id: string;
  keywords: string[];
  locations: string[];
  remote_only: boolean;
  min_salary: number | null;
  industries: string[];
  experience_level: string[];
  match_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AutoApplyJob {
  id: string;
  user_id: string;
  resume_id: string | null;
  job_url: string;
  job_title: string | null;
  company_name: string | null;
  status: AutoApplyJobStatus;
  progress: number;
  logs: LogEntry[];
  retry_count: number;
  last_error: string | null;
  dry_run: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppliedJob {
  id: string;
  user_id: string;
  auto_apply_job_id: string | null;
  job_url: string;
  job_title: string | null;
  company_name: string | null;
  match_score: number | null;
  applied_at: string;
  created_at: string;
}

export interface UsageCounters {
  user_id: string;
  applications_today: number;
  plan_type: PlanType;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  updated_at: string;
}

export const PLAN_LIMITS: Record<PlanType, number> = {
  free_plan: 5,
  pro_plan: 50,
};
