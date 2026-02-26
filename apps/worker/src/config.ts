function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error('Missing env: ' + name);
  return v;
}

function envOptional(name: string): string | undefined {
  return process.env[name];
}

const openaiKey = envOptional('OPENAI_API_KEY') ?? '';
const geminiKey = envOptional('GEMINI_API_KEY') ?? '';

/** Key used for the browser-use LLM: OpenAI key if set, else Gemini (via OpenAI-compatible API). */
export const effectiveLlmKey = openaiKey.trim() || geminiKey;
/** When using Gemini for the agent, set this so the OpenAI client uses Gemini's endpoint. */
export const openaiCompatibleBaseUrl =
  openaiKey.trim() === '' && geminiKey
    ? 'https://generativelanguage.googleapis.com/v1beta/openai'
    : undefined;

export const config = {
  supabaseUrl: env('SUPABASE_URL'),
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  geminiApiKey: geminiKey,
  openaiApiKey: openaiKey,
  effectiveLlmKey,
  openaiCompatibleBaseUrl,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 15000,
  headless: process.env.HEADLESS !== 'false',
};
