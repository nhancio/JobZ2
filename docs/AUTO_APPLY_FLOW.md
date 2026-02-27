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
- **Worker**: Polls `auto_apply_jobs` where `status = 'pending'`.
  - **With `job_url`**: Runs single-URL LinkedIn Easy Apply (browser-use agent).
  - **Without `job_url`** (automatic run): Loads user’s active resume `resume_json`, `job_preferences` (keywords, locations), and `linkedin_sessions.cookies_json`. Launches Puppeteer (Chromium), injects cookies, goes to LinkedIn Jobs search (keywords + location + Easy Apply filter), collects job URLs (up to 5), then for each: open job, click Easy Apply, Next/Submit, insert into `applied_jobs`, update `auto_apply_jobs` progress and logs. Uses realistic delays.
- **APIs**: `POST /api/resume/upload`, `POST /api/resume/parse`, `POST /api/linkedin/connect`, `POST /api/auto-apply/start`, `GET /api/auto-apply/status?job_id=...`.

## 3. LinkedIn session storage and reuse

- **Table**: `linkedin_sessions` (`user_id`, `cookies_json`, `encrypted_cookies`, …). One row per user.
- **Connect**: User clicks “Connect LinkedIn” → `POST /api/linkedin/connect` creates a `linkedin_connect_requests` row. A separate flow (worker in headed mode or a one-off script) opens a browser for the user to log into LinkedIn once, then saves cookies to `linkedin_sessions.cookies_json` (array of `{ name, value, domain?, path? }`). Can encrypt before storing; worker reads and, if needed, decrypts.
- **Reuse**: For each automatic run (no `job_url`), the worker reads `linkedin_sessions.cookies_json` for the user, normalizes to Puppeteer format (domain `.linkedin.com`), launches Chromium, `page.setCookie(...cookies)`, then navigates to LinkedIn Jobs search and runs the apply loop in the same session.

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
4. **Preferences**: Dashboard → Preferences → set job titles (keywords) and locations; if empty, resume data is used for automatic search.
5. **LinkedIn** (for automatic search): On the Dashboard click **Connect LinkedIn**, then in the worker folder run `npm run linkedin:connect`. A browser opens; log in once. Session is saved to `linkedin_sessions`. Alternatively, save your LinkedIn session so the worker can search and apply (e.g. run a connect flow that opens a browser for you to log in and saves cookies to `linkedin_sessions`, or populate `linkedin_sessions.cookies_json` for your user (e.g. from browser DevTools). Without it, automatic runs fail with “Connect LinkedIn first.”
6. **Auto-apply**: Dashboard → “New auto-apply job” → creates a run; worker processes it.
7. **Worker**: `cd apps/worker`, `npm install` (installs Puppeteer; first run may download Chromium), set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (or `OPENAI_API_KEY`), then `npm run dev`. Worker polls for `pending` jobs: with `job_url` → single-URL Easy Apply; without `job_url` → LinkedIn search + Easy Apply for up to 5 jobs using saved session. To capture a LinkedIn session (after clicking Connect LinkedIn in the app), run `npm run linkedin:connect` in the worker folder; a browser opens for you to log in once, then cookies are saved.

All automation runs server-side (API routes use `runtime = 'nodejs'`; browser automation runs in the worker only).
