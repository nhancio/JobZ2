# Run worker in the cloud (avoids VPN/firewall on your PC)

Deploy the worker to **Render.com** so it always has internet access to Supabase.

## Steps

1. **Push your repo to GitHub** (if not already).

2. **Render**: Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Background Worker**.

3. **Connect** your GitHub repo and select the JobZ2 repo.

4. **Settings:**
   - **Root Directory:** `apps/worker`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`

5. **Environment:** Add these (use the same values as in your local `apps/worker/.env`):
   - `SUPABASE_URL` = `https://jmuhzeqkxmgxgzeqftbt.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = your service_role secret from Supabase Dashboard → Settings → API  
   - (Optional) `GEMINI_API_KEY` if you use single-URL Easy Apply

6. **Deploy.** The worker will run 24/7 in the cloud and poll for jobs; your local VPN doesn’t affect it.

---

Alternatively, use the **Blueprint**: **New** → **Blueprint** → connect repo. Render will read `render.yaml` from the repo root. Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the worker service’s **Environment** tab.
