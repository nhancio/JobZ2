-- JobZ2: Auto-apply flow – resumes (url, parsed JSON, active), LinkedIn connect, applied_jobs columns
-- Run after 001_initial_schema.sql

-- =============================================================================
-- RESUMES: add resume_url, resume_json, is_active (one active per user)
-- =============================================================================
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_json JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_one_active_per_user
  ON public.resumes (user_id) WHERE (is_active = TRUE);

COMMENT ON COLUMN public.resumes.resume_url IS 'Supabase storage URL of uploaded file (PDF/DOC)';
COMMENT ON COLUMN public.resumes.resume_json IS 'Parsed by Gemini: skills, job_titles, experience_level, preferred_locations';
COMMENT ON COLUMN public.resumes.is_active IS 'Only one active resume per user; used for auto-apply';

-- =============================================================================
-- APPLIED_JOBS: add job_location, status
-- =============================================================================
ALTER TABLE public.applied_jobs
  ADD COLUMN IF NOT EXISTS job_location TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied';

-- =============================================================================
-- AUTO_APPLY_JOBS: job_url optional for "search + apply" runs
-- =============================================================================
ALTER TABLE public.auto_apply_jobs
  ALTER COLUMN job_url DROP NOT NULL;

-- =============================================================================
-- LINKEDIN_CONNECT_REQUESTS (user requests session capture; worker fulfills)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.linkedin_connect_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_connect_requests_status ON public.linkedin_connect_requests(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_connect_requests_user_id ON public.linkedin_connect_requests(user_id);

ALTER TABLE public.linkedin_connect_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY linkedin_connect_requests_select_own ON public.linkedin_connect_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY linkedin_connect_requests_insert_own ON public.linkedin_connect_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Worker updates via service role
CREATE TRIGGER linkedin_connect_requests_updated_at BEFORE UPDATE ON public.linkedin_connect_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- LINKEDIN_SESSIONS: add cookies_json for storing session (encrypt in app)
-- =============================================================================
ALTER TABLE public.linkedin_sessions
  ADD COLUMN IF NOT EXISTS cookies_json JSONB;
