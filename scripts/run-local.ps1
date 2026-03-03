# One-command local setup: start Supabase, apply migrations, switch env to local.
# Requires: Docker Desktop running, Supabase CLI (npx supabase works).
# Preserves NextAuth/Google in apps/web/.env.local so login keeps working.
Set-Location $PSScriptRoot\..

Write-Host 'JobZ2 - Making the full flow work locally (upload resume -> login -> LinkedIn -> auto-apply)' -ForegroundColor Cyan
Write-Host ""

# 1. Supabase local
Write-Host '[1/3] Starting Supabase (Docker must be running)...' -ForegroundColor Yellow
$start = npx supabase start 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Supabase start failed. Is Docker Desktop running?" -ForegroundColor Red
  Write-Host $start
  exit 1
}
Write-Host "Supabase started." -ForegroundColor Green

# 2. Migrations
Write-Host '[2/3] Applying migrations (tables, storage, RLS)...' -ForegroundColor Yellow
npx supabase db reset --no-seed 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "db reset failed." -ForegroundColor Red
  exit 1
}
Write-Host "Migrations applied." -ForegroundColor Green

# 3. Env
Write-Host '[3/3] Pointing app and worker to local Supabase (keeping NextAuth/Google)...' -ForegroundColor Yellow
& "$PSScriptRoot\use-local-supabase.ps1"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "Done. Next:" -ForegroundColor Green
Write-Host "  Terminal 1: npm run dev"
Write-Host "  Terminal 2: npm run dev:worker"
Write-Host ""
Write-Host 'Then open http://localhost:5000 -> Login with Google -> Upload resume -> Connect LinkedIn -> New auto-apply job.' -ForegroundColor Cyan
