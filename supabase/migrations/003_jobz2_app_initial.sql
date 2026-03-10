-- ============================================================
-- JobZ2 merged app: initial schema (resumes, linkedin_sessions, auto_apply_jobs, applied_jobs)
-- Run this in your Supabase SQL editor if using the single merged app.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS resumes (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_url    TEXT        NOT NULL,
  resume_json   JSONB       NOT NULL DEFAULT '{}',
  file_name     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS linkedin_sessions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cookies_json  JSONB       NOT NULL DEFAULT '[]',
  user_agent    TEXT,
  is_valid      BOOLEAN     NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS auto_apply_jobs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','running','completed','failed')),
  progress        INTEGER     NOT NULL DEFAULT 0,
  total_found     INTEGER     NOT NULL DEFAULT 0,
  total_applied   INTEGER     NOT NULL DEFAULT 0,
  logs            JSONB       NOT NULL DEFAULT '[]',
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applied_jobs (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_apply_job_id UUID        REFERENCES auto_apply_jobs(id) ON DELETE SET NULL,
  company           TEXT        NOT NULL,
  job_title         TEXT        NOT NULL,
  location          TEXT,
  job_url           TEXT,
  status            TEXT        NOT NULL DEFAULT 'applied'
                                CHECK (status IN ('applied','failed','skipped')),
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resumes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_jobs      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_resumes" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_linkedin_sessions" ON linkedin_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_auto_apply_jobs" ON auto_apply_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_applied_jobs" ON applied_jobs FOR ALL USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "upload_own_resume" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "read_own_resume" ON storage.objects FOR SELECT USING (
  bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "delete_own_resume" ON storage.objects FOR DELETE USING (
  bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_resumes_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_auto_apply_jobs_updated_at BEFORE UPDATE ON auto_apply_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
