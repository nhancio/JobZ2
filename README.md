# JobZ2 – AI Job Auto Apply Agent

Enterprise-grade SaaS: structured resumes, AI job matching (Gemini), and automatic LinkedIn Easy Apply via a browser automation worker.

---

## Why am I seeing 500 errors? (resume upload, preferences, resumes list)

Your **network is blocking Supabase** (e.g. VPN/firewall blocks `*.supabase.co`). So every feature that uses the database — login sync, resume upload, preferences, job list — fails with **500 Internal Server Error**. The app is built to talk to Supabase; when it can’t reach it, those requests fail.

**To get your flow working** (upload resume → connect LinkedIn → auto-apply to matching jobs):

- **Option A:** Use a network that allows Supabase (e.g. different Wi‑Fi, turn off VPN).
- **Option B:** Run Supabase **on your PC** so the app never needs to reach the internet for the DB:
  1. Install **Docker Desktop** and **Supabase CLI** (see **Can't reach Supabase?** below).
  2. From repo root run: **`.\scripts\run-local.ps1`** (starts Supabase, applies migrations, switches env to local and keeps your Google login).
  3. **Terminal 1:** `npm run dev` → **Terminal 2:** `npm run dev:worker`.
  4. Open **http://localhost:5000** → Log in with Google → Upload resume → Connect LinkedIn → **New auto-apply job**.

---

## Can't reach Supabase? (VPN / firewall / ERR_CONNECTION_TIMED_OUT)

If your network blocks **supabase.co**, run Supabase **on your own machine** so nothing hits the internet:

1. Install **Docker Desktop** and **Supabase CLI**.
2. From repo root: **`supabase start`** then **`supabase db reset`**.
3. Copy local API URL and keys from **`supabase status`** into `apps/web/.env.local` and `apps/worker/.env` (use `http://127.0.0.1:54321` as the URL).
4. Run **`npm run dev`** (web) and **`npm run dev:worker`** (worker).

Full steps: **[LOCAL-SETUP-NO-INTERNET.md](./LOCAL-SETUP-NO-INTERNET.md)**.

---

## Tech stack

- **Web**: Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, React Hook Form + Zod, **Supabase Auth (Google)** for sign-in, Supabase (Postgres, Storage, Realtime), Sonner, Lucide
- **Worker**: Node + TypeScript, **browser-use** (browser-use-node, LLM-powered automation), Gemini (AI match scoring), Supabase
- **Package manager**: npm

## ENV (required)

- **Web** (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (for resume parsing)
- **Worker** (`apps/worker/.env` or env): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (optional; for AI matching when `ai_matching_enabled` is on). For automation: `OPENAI_API_KEY` or Gemini via `OPENAI_API_KEY` + `OPENAI_BASE_URL`

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/nhancio/JobZ2.git
cd JobZ2
npm install
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In SQL Editor, run the contents of `supabase/migrations/001_initial_schema.sql` (creates tables, RLS, storage bucket, triggers).
3. In **Database > Replication**, enable replication for the `auto_apply_jobs` table for optional Supabase Realtime; the dashboard also streams job progress via SSE (`/api/jobs/[id]/stream`).
4. Tables include: `profiles`, `resumes`, `job_preferences`, `auto_apply_jobs`, `applied_jobs`, `usage_counters`, `system_settings`, `feature_flags`, `linkedin_sessions`. System settings (`max_retries`, `maintenance_mode`, `default_delays`) and feature flags (`automation_enabled`, `ai_matching_enabled`, `dry_run_enabled`) are seeded in the migration.
5. In Authentication > Providers, enable Email and Google if desired (NextAuth uses Google OAuth from Google Cloud Console; see step 4 in “Run web app”).
6. In Project Settings > API, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role (keep secret) → `SUPABASE_SERVICE_ROLE_KEY` (for worker and seed script)

### 3. Environment

Copy the example and fill in:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` (for local web dev you only need the `NEXT_PUBLIC_*` and `GEMINI_API_KEY` in the shell or in `apps/web/.env.local`). For the worker, use a separate `.env` in `apps/worker` or export:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (worker; service role bypasses RLS)
- `GEMINI_API_KEY` (worker; match scoring)
- `OPENAI_API_KEY` (worker; required by browser-use-node for the LLM agent). **Optional:** you can use **Gemini** instead: set `OPENAI_API_KEY` to your Gemini API key and `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai` so the agent uses Gemini via the OpenAI-compatible API. If unset, the worker still runs but automation jobs will fail with a clear message.

### 4. Run web app (port 5000)

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000). Use **Continue with Google** to sign in (Supabase Auth). After login, if you have no resume you’re redirected to **Resumes**; otherwise to **Dashboard**. Upload a resume (PDF/DOC), parse with Gemini, set one as active. Click **New auto-apply job** to start a run (worker will pick it up). See `docs/AUTO_APPLY_FLOW.md` for the full flow.

### 5. Run worker

In a second terminal, from repo root:

```bash
cd apps/worker
npm install
# Export SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, OPENAI_API_KEY
npm run dev
```

The worker polls for `pending` jobs, runs **browser-use** (browser-use-node) on the job URL: the LLM-powered agent navigates LinkedIn, clicks Easy Apply, and optionally completes and submits. Logs stream to the DB; on success the worker records the application and Gemini match score.

### 6. Testing dry run

1. In Dashboard, click “New auto-apply job”.
2. Paste a LinkedIn Easy Apply job URL.
3. Check **Dry run** (automation runs but does not submit).
4. Click “Queue job”. The worker will pick it up, open the page, click Easy Apply, and stop before submitting. Logs appear on the job detail page (realtime).

### 7. Testing real automation (safely)

- Use a test LinkedIn account.
- Create a job with **Dry run** unchecked. The worker will attempt to fill and submit using the browser-use agent. Ensure your resume and preferences are set.
- Respect LinkedIn’s ToS and rate limits.

## Deployment architecture (Vercel + worker host)

- **Web (Vercel)**  
  - Deploy the Next.js app from the repo root or `apps/web`.  
  - Build command: `npm run build` (or `npm run build --workspace=apps/web` from root).  
  - Root directory: `apps/web` if configuring in Vercel.  
  - Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; optionally `GEMINI_API_KEY` for future server-side use.

- **Worker (VM or container)**  
  - Run the browser-use automation worker on a VM or container host (Railway, Render, Fly.io, ECS, or a VPS).  
  - Use `apps/worker/Dockerfile`: from repo root run  
    `docker build -t jobz2-worker -f apps/worker/Dockerfile apps/worker`  
    then run the container with env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (optional; for AI match scoring), and either `OPENAI_API_KEY` or Gemini via `OPENAI_API_KEY` + `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`.  
  - Chromium is installed in the Dockerfile (Puppeteer). Ensure the host has enough memory for headless Chrome.

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start Next.js on port 5000 |
| `npm run dev:worker` | Start worker (poll + automate) |
| `npm run build`| Build web app              |
| `npm run start`| Start production web       |
| `npm run lint` | Lint workspaces            |
| `npm run lint:fix` | Lint and fix (all workspaces) |
| `npm run typecheck` | TypeScript check (all workspaces) |
| `npm run format`| Prettier format            |
| `npm run test` | Run tests (web: Jest)      |
| `npm run db:seed` | Seed demo user data (from apps/web) |

## Health check

- **Web**: `GET /api/health` returns `{ "status": "ok", "service": "jobz2-web", "timestamp": "..." }`.

## Final verification

- **typecheck**: From root, `npm run typecheck` (runs in both apps).
- **build**: From root, `npm run build` (builds Next.js app).
- **dev**: `npm run dev` starts the web app; in another terminal `npm run dev:worker` starts the worker.
- **Server/client separation**: API routes and server components use `@/lib/supabase/server`; client components use `@/lib/supabase/client`. Secrets stay server-side; only `NEXT_PUBLIC_*` are exposed to the client.

## Security

- RLS on all user data in Supabase.
- Server-side secrets (service role only in worker/env).
- Zod validation on API inputs.
- Per-user API rate limiting on auto-apply endpoint.
