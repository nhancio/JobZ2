# Automatic Job Apply Flow

## 1. Supabase SQL for all tables

- **Initial schema**: Run `supabase/migrations/001_initial_schema.sql` for:
  - `profiles`, `resumes`, `job_preferences`, `auto_apply_jobs`, `applied_jobs`, `usage_counters`, `system_settings`, `feature_flags`, `linkedin_sessions`
  - RLS, storage bucket `resumes`, triggers (`handle_new_user`, `maybe_reset_usage_today`)

- **Auto-apply flow**: Run `supabase/migrations/002_auto_apply_flow.sql` for:
  - `resumes`: `resume_url`, `resume_json`, `is_active` (one active per user)
  - `applied_jobs`: `job_location`, `status`
  - `auto_apply_jobs`: `job_url` nullable for “search + apply” runs
  - `linkedin_connect_requests` table
  - `linkedin_sessions`: `cookies_json`

## 2. Backend automation flow

- **Start**: User clicks “New auto-apply job” → `POST /api/auto-apply/start` → reads active resume, creates one `auto_apply_jobs` row (status `pending`, no `job_url`), increments usage.
- **Worker** (existing): Polls `auto_apply_jobs` where `status = 'pending'`. For jobs **with** `job_url`, runs LinkedIn Easy Apply on that URL (current behavior). For jobs **without** `job_url` (automatic search run), the worker can be extended to: load user’s `resume_json` and preferences, load LinkedIn session from `linkedin_sessions`, open LinkedIn, search by job_titles + locations, filter Easy Apply, then for each result open job, Easy Apply, autofill, submit, insert into `applied_jobs`, update `auto_apply_jobs.progress` and `logs`.
- **APIs**: `POST /api/resume/upload` (file → storage + resume row), `POST /api/resume/parse` (Gemini → `resume_json`), `POST /api/linkedin/connect` (enqueue connect request for worker), `POST /api/auto-apply/start`, `GET /api/auto-apply/status?job_id=...`.

## 3. LinkedIn session storage and reuse

- **Table**: `linkedin_sessions` (`user_id`, `encrypted_cookies`, `cookies_json`, `encrypted_storage`). One row per user.
- **Connect**: User clicks “Connect LinkedIn” → `POST /api/linkedin/connect` creates a row in `linkedin_connect_requests` (status `pending`). A **worker** (with browser) picks up pending requests, opens a headed browser, navigates to LinkedIn login; user logs in once; worker captures cookies, encrypts them (e.g. using `lib/encryption`), and writes to `linkedin_sessions` for that `user_id`, then marks the request `completed`.
- **Reuse**: For each automation run, the worker loads the user’s row from `linkedin_sessions`, decrypts cookies, injects them into the browser context, then runs the search and Easy Apply flow so the user stays logged in.

## 4. How dashboard reads real data

- **Server components** use `getSessionUserId()` (Supabase `auth.getUser()`), then `createAdminClient()` to query:
  - **Usage today**: `usage_counters.applications_today` and `plan_type` for limit.
  - **Resumes**: `resumes` count and list; “Active” from `is_active`.
  - **Jobs in queue**: Count of `auto_apply_jobs` where `status IN ('pending','running')`.
  - **Applied**: Count of `applied_jobs` for the user; recent list for “Recently applied.”
  - **Recent auto-apply jobs**: `auto_apply_jobs` ordered by `created_at`, limit 10.
- All dashboard cards and lists use these queries; no client-side Supabase.

## 5. Steps to run locally

1. **Supabase**: Create project, run `001_initial_schema.sql` and `002_auto_apply_flow.sql`. Enable Google in Authentication > Providers. Set Site URL (e.g. `http://localhost:5000`) and Redirect URL `http://localhost:5000/auth/callback`. Copy Project URL and anon key to `apps/web/.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; add `SUPABASE_SERVICE_ROLE_KEY`. Add `GEMINI_API_KEY` for resume parsing and (optionally) worker.
2. **Web**: From repo root, `npm install` then `npm run dev`. Open http://localhost:5000 → Login with Google (Supabase). If no resume, you’re redirected to `/dashboard/resumes`; else `/dashboard`.
3. **Resume**: Go to Resumes → Add resume → Upload PDF/DOC, optionally “Parse with Gemini.” Set one resume as “Active.”
4. **Preferences**: Dashboard → Preferences → set job_titles/locations overrides (or leave empty to use resume data when worker supports it).
5. **Auto-apply**: Dashboard → “New auto-apply job” → creates a run; worker (see below) processes it.
6. **Worker**: In another terminal, `cd apps/worker`, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` (or `OPENAI_API_KEY`), then `npm run dev`. Worker polls for `pending` jobs; for jobs with `job_url` it runs the existing single-URL Easy Apply flow.

All automation runs server-side (API routes use `runtime = 'nodejs'`; browser automation runs in the worker only).
