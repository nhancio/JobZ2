# Run after: supabase start
# Fills apps/web/.env.local and apps/worker/.env from supabase status (local keys)
$status = npx supabase status -o json 2>$null
if (-not $status) {
  Write-Host "Run 'supabase start' first (needs Docker running)."
  exit 1
}
$j = $status | ConvertFrom-Json
$apiUrl = "http://127.0.0.1:54321"
$anon = $j.anon_key
$serviceRole = $j.service_role_key

$webEnv = @"
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$serviceRole
GEMINI_API_KEY=$env:GEMINI_API_KEY
"@
$webEnv | Set-Content -Path "apps/web/.env.local" -Encoding utf8

$workerEnv = @"
SUPABASE_URL=$apiUrl
SUPABASE_SERVICE_ROLE_KEY=$serviceRole
"@
$workerEnv | Set-Content -Path "apps/worker/.env" -Encoding utf8

Write-Host "Updated apps/web/.env.local and apps/worker/.env for local Supabase."
