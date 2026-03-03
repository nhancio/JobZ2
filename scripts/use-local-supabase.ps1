# Run after: supabase start
# Fills apps/web/.env.local and apps/worker/.env from supabase status (local keys)
# Preserves NEXTAUTH_* and GOOGLE_* in web .env.local so login still works.
$status = npx supabase status -o json 2>$null
if (-not $status) {
  Write-Host "Run 'supabase start' first (needs Docker running)."
  exit 1
}
$j = $status | ConvertFrom-Json
$apiUrl = "http://127.0.0.1:54321"
$anon = $j.anon_key
$serviceRole = $j.service_role_key

# Preserve NextAuth/Google/Gemini from existing web .env.local
$webEnvPath = "apps/web/.env.local"
$extraLines = @()
if (Test-Path $webEnvPath) {
  Get-Content $webEnvPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^(NEXTAUTH_|GOOGLE_|GEMINI_API_KEY=)') { $extraLines += $line }
  }
}
$geminiLine = ($extraLines | Where-Object { $_ -match '^GEMINI_API_KEY=' }) -join "`n"
if (-not $geminiLine -and $env:GEMINI_API_KEY) { $geminiLine = "GEMINI_API_KEY=$env:GEMINI_API_KEY" }
if (-not $geminiLine) { $geminiLine = "GEMINI_API_KEY=" }

$webEnv = @"
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$serviceRole
$geminiLine
"@
# Append preserved auth vars (exclude GEMINI we already added)
$extraLines | Where-Object { $_ -notmatch '^GEMINI_API_KEY=' } | ForEach-Object { $webEnv += "`n$_" }
$webEnv | Set-Content -Path $webEnvPath -Encoding utf8

$workerEnv = @"
SUPABASE_URL=$apiUrl
SUPABASE_SERVICE_ROLE_KEY=$serviceRole
"@
$workerEnv | Set-Content -Path "apps/worker/.env" -Encoding utf8

Write-Host "Updated apps/web/.env.local and apps/worker/.env for local Supabase."
Write-Host "NextAuth/Google vars preserved in .env.local - login will use Google."
