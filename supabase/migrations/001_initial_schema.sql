-- JobZ2: AI Job Auto Apply Agent - Initial Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PROFILES (extends auth.users)
-- =============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free_plan' CHECK (plan_type IN ('free_plan', 'pro_plan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- RESUMES (structured resume storage)
-- =============================================================================
CREATE TABLE public.resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  file_path TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);

-- =============================================================================
-- JOB PREFERENCES
-- =============================================================================
CREATE TABLE public.job_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  keywords TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  remote_only BOOLEAN NOT NULL DEFAULT FALSE,
  min_salary INTEGER,
  industries TEXT[] DEFAULT '{}',
  experience_level TEXT[] DEFAULT '{}',
  match_threshold INTEGER NOT NULL DEFAULT 70 CHECK (match_threshold >= 0 AND match_threshold <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_preferences_user_id ON public.job_preferences(user_id);

-- =============================================================================
-- AUTO_APPLY_JOBS (worker queue)
-- =============================================================================
CREATE TYPE auto_apply_job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TABLE public.auto_apply_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  job_url TEXT NOT NULL,
  job_title TEXT,
  company_name TEXT,
  status auto_apply_job_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  logs JSONB DEFAULT '[]'::JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_apply_jobs_status ON public.auto_apply_jobs(status);
CREATE INDEX idx_auto_apply_jobs_user_id ON public.auto_apply_jobs(user_id);
CREATE INDEX idx_auto_apply_jobs_created_at ON public.auto_apply_jobs(created_at);

-- =============================================================================
-- APPLIED_JOBS (history + match score)
-- =============================================================================
CREATE TABLE public.applied_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auto_apply_job_id UUID REFERENCES public.auto_apply_jobs(id) ON DELETE SET NULL,
  job_url TEXT NOT NULL,
  job_title TEXT,
  company_name TEXT,
  match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applied_jobs_user_id ON public.applied_jobs(user_id);
CREATE INDEX idx_applied_jobs_applied_at ON public.applied_jobs(applied_at);

-- =============================================================================
-- USAGE_COUNTERS (rate limiting per plan)
-- =============================================================================
CREATE TABLE public.usage_counters (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  applications_today INTEGER NOT NULL DEFAULT 0,
  plan_type TEXT NOT NULL DEFAULT 'free_plan' CHECK (plan_type IN ('free_plan', 'pro_plan')),
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SYSTEM_SETTINGS (global config)
-- =============================================================================
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default system settings
INSERT INTO public.system_settings (key, value) VALUES
  ('default_delays', '{"between_steps_ms": 2000, "page_load_ms": 3000}'::JSONB),
  ('max_retries', '3'),
  ('maintenance_mode', 'false');

-- =============================================================================
-- FEATURE_FLAGS
-- =============================================================================
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.feature_flags (key, enabled) VALUES
  ('automation_enabled', true),
  ('ai_matching_enabled', true),
  ('dry_run_enabled', true);

-- =============================================================================
-- LINKEDIN SESSION STORAGE (encrypted per-user; app encrypts/decrypts)
-- =============================================================================
CREATE TABLE public.linkedin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  encrypted_cookies JSONB,
  encrypted_storage JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_linkedin_sessions_user_id ON public.linkedin_sessions(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_apply_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applied_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_sessions ENABLE ROW LEVEL SECURITY;

-- system_settings and feature_flags: read-only for authenticated users
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Resumes: CRUD own
CREATE POLICY resumes_select_own ON public.resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY resumes_insert_own ON public.resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY resumes_update_own ON public.resumes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY resumes_delete_own ON public.resumes FOR DELETE USING (auth.uid() = user_id);

-- Job preferences: CRUD own
CREATE POLICY job_preferences_select_own ON public.job_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY job_preferences_insert_own ON public.job_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY job_preferences_update_own ON public.job_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY job_preferences_delete_own ON public.job_preferences FOR DELETE USING (auth.uid() = user_id);

-- Auto apply jobs: CRUD own
CREATE POLICY auto_apply_jobs_select_own ON public.auto_apply_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY auto_apply_jobs_insert_own ON public.auto_apply_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY auto_apply_jobs_update_own ON public.auto_apply_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY auto_apply_jobs_delete_own ON public.auto_apply_jobs FOR DELETE USING (auth.uid() = user_id);

-- Worker needs to update jobs: use service role or add policy for status updates by same user
-- Applied jobs: CRUD own
CREATE POLICY applied_jobs_select_own ON public.applied_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY applied_jobs_insert_own ON public.applied_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usage counters: select/update own (worker updates via service role)
CREATE POLICY usage_counters_select_own ON public.usage_counters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY usage_counters_insert_own ON public.usage_counters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY usage_counters_update_own ON public.usage_counters FOR UPDATE USING (auth.uid() = user_id);

-- LinkedIn sessions: own only
CREATE POLICY linkedin_sessions_select_own ON public.linkedin_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY linkedin_sessions_insert_own ON public.linkedin_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY linkedin_sessions_update_own ON public.linkedin_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY linkedin_sessions_delete_own ON public.linkedin_sessions FOR DELETE USING (auth.uid() = user_id);

-- System settings / feature flags: read for all authenticated
CREATE POLICY system_settings_select ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY feature_flags_select ON public.feature_flags FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- STORAGE BUCKET (resume files)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  5242880,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can read/write own folder
CREATE POLICY resumes_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY resumes_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY resumes_storage_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY resumes_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- TRIGGERS: updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER resumes_updated_at BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER job_preferences_updated_at BEFORE UPDATE ON public.job_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER auto_apply_jobs_updated_at BEFORE UPDATE ON public.auto_apply_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- FUNCTION: Create profile on signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.usage_counters (user_id, plan_type)
  VALUES (NEW.id, 'free_plan');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- FUNCTION: Reset usage counter at day boundary (call via cron or worker)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.maybe_reset_usage_today(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.usage_counters
  SET applications_today = 0, last_reset_date = CURRENT_DATE, updated_at = NOW()
  WHERE user_id = p_user_id AND last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REALTIME: In Dashboard > Database > Replication, add table "auto_apply_jobs" for live logs.
