# JobZ2 – AI Job Auto Apply Agent

Enterprise-grade SaaS: structured resumes, AI job matching (Gemini), and automatic LinkedIn Easy Apply via a browser automation worker.

## Tech stack

- **Web**: Next.js 14 (App Router), TypeScript, Tailwind, React Hook Form + Zod, Supabase (Auth, Postgres, Storage, Realtime), Sonner, Lucide
- **Worker**: Node + TypeScript, **browser-use** (browser-use-node, LLM-powered automation), Gemini (match scoring), Supabase
- **Package manager**: npm

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
3. In Authentication > Providers, enable Email and Google if desired. For Google, add your OAuth Client ID and Secret (from Google Cloud Console).
4. In Project Settings > API, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role (keep secret) → `SUPABASE_SERVICE_ROLE_KEY` (for worker and seed)

### 3. Environment

Copy the example and fill in:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` (for local web dev you only need the `NEXT_PUBLIC_*` and `GEMINI_API_KEY` in the shell or in `apps/web/.env.local`). For the worker, use a separate `.env` in `apps/worker` or export:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (worker; service role bypasses RLS)
- `GEMINI_API_KEY` (worker; match scoring)
- `OPENAI_API_KEY` (worker; required by browser-use-node for the LLM agent)

### 4. Run web app (port 5000)

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000). Sign up, then use Dashboard to add resumes, set preferences, and create auto-apply jobs.

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

## Deployment

- **Web**: Deploy to **Vercel**. Set env vars in Project Settings (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`). Build command: `npm run build` (from root with workspaces or from `apps/web`). Output: `apps/web` if using root build.
- **Worker**: Run on a **VM or container host** (e.g. Railway, Render, Fly.io, or a VPS). Use the provided `apps/worker/Dockerfile`: build the worker (`npm run build` in `apps/worker`), then `docker build -t jobz2-worker apps/worker` and run with env vars. The worker needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, and Chromium (installed in Dockerfile via Playwright, which is a dependency of browser-use-node).

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start Next.js on port 5000 |
| `npm run dev:worker` | Start worker (poll + automate) |
| `npm run build`| Build web app              |
| `npm run start`| Start production web      |
| `npm run lint` | Lint workspaces            |
| `npm run typecheck` | TypeScript check     |
| `npm run format`| Prettier format           |
| `npm run db:seed` | Seed demo user data (from apps/web) |

## Health check

- **Web**: `GET /api/health` returns `{ "status": "ok", "service": "jobz2-web" }`.

## Security

- RLS on all user data in Supabase.
- Server-side secrets (service role only in worker/env).
- Zod validation on API inputs.
- Per-user API rate limiting on auto-apply endpoint.
