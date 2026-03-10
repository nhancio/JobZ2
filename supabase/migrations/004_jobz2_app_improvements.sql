-- JobZ2 merged app: improvements (config, user_preferences, applied_jobs columns)

ALTER TABLE auto_apply_jobs ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE applied_jobs ADD COLUMN IF NOT EXISTS match_score INTEGER;
ALTER TABLE applied_jobs ADD COLUMN IF NOT EXISTS skip_reason TEXT;

CREATE TABLE IF NOT EXISTS user_preferences (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_blocklist    TEXT[]      NOT NULL DEFAULT '{}',
  default_job_titles   TEXT[]      NOT NULL DEFAULT '{}',
  default_location     TEXT        NOT NULL DEFAULT 'Remote',
  default_max_jobs     INTEGER     NOT NULL DEFAULT 25,
  min_match_score      INTEGER     NOT NULL DEFAULT 0,
  notification_email   TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER trg_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
