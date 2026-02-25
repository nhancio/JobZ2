function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error('Missing env: ' + name);
  return v;
}

export const config = {
  supabaseUrl: env('SUPABASE_URL'),
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  geminiApiKey: env('GEMINI_API_KEY'),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 15000,
};
