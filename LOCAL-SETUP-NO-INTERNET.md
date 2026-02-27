# Run JobZ2 fully offline (no access to supabase.co)

If your network blocks Supabase (VPN, firewall, ERR_CONNECTION_TIMED_OUT), run **Supabase on your machine** so the app and worker never touch the internet.

## What you need

- **Docker Desktop** – [Install](https://docs.docker.com/get-docker/) and make sure it’s running.
- **Supabase CLI** – [Install](https://supabase.com/docs/guides/cli/getting-started):  
  `npm install -g supabase`  
  or:  
  `scoop install supabase` (Windows)

## 1. Start Supabase locally

From the **repo root** (JobZ2):

```powershell
supabase start
```

Wait until it prints “Started supabase local development setup.” and shows URLs. You’ll see something like:

- **API URL:** `http://127.0.0.1:54321`
- **anon key:** `eyJ...`
- **service_role key:** `eyJ...`

## 2. Apply migrations

```powershell
supabase db reset
```

(This runs the SQL in `supabase/migrations/` so your tables exist.)

Or run the migrations once:

```powershell
supabase migration up
```

## 3. Get local keys

Run:

```powershell
supabase status
```

Copy:

- **API URL** → use as `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
- **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## 4. Web app env

Create or edit **`apps/web/.env.local`**:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
GEMINI_API_KEY=<your Gemini key if you have one>
```

## 5. Worker env

Create or edit **`apps/worker/.env`**:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<same service_role key>
```

## 6. Auth (Google) on localhost

Local Supabase can use Google login, but you must allow `http://localhost:5000` in Google Cloud Console:

1. [Google Cloud Console](https://console.cloud.google.com/) → your project → **APIs & Services** → **Credentials**.
2. Open your OAuth 2.0 Client ID (Web application).
3. Under **Authorized redirect URIs** add:  
   `http://127.0.0.1:54321/auth/v1/callback`  
   (Supabase local uses this; the app redirects to it.)
4. Under **Authorized JavaScript origins** add:  
   `http://localhost:5000` and `http://127.0.0.1:5000`.

In **Supabase Studio** (local): open `http://127.0.0.1:54323` → **Authentication** → **Providers** → **Google** → turn on and paste your Google Client ID and Secret.

## 7. Run the app and worker

**Terminal 1 – web:**

```powershell
npm run dev
```

Open **http://localhost:5000**. Log in with Google (or Email if you enabled it).

**Terminal 2 – worker:**

```powershell
cd apps/worker
npm run dev
```

Everything (DB, auth, API, worker) now uses **localhost** – no traffic to supabase.co.

## 8. Stop local Supabase

When you’re done:

```powershell
supabase stop
```

---

**Summary:** With Docker + Supabase CLI, `supabase start` + the env above, JobZ2 runs fully on your machine and works even when the internet blocks supabase.co.
