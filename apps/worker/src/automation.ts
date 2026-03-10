import { logger } from './logger.js';
import type { LogEntry } from './firebase.js';
import { config } from './config.js';

export interface AutomationResult {
  success: boolean;
  error?: string;
  progress: number;
  logs: LogEntry[];
}

/** Minimal interface for browser-use Agent (avoids depending on package internals). */
interface BrowserUseAgent {
  run(): Promise<void>;
}

/** Minimal interface for browser-use Browser. */
interface BrowserUseBrowser {
  close?(): Promise<void>;
}

/**
 * Run LinkedIn Easy Apply using browser-use (browser-use-node).
 * Uses LLM-powered agent to navigate, click Easy Apply, and optionally submit.
 */
export async function runLinkedInEasyApply(
  jobUrl: string,
  dryRun: boolean,
  onLog: (entry: LogEntry) => void
): Promise<AutomationResult> {
  const logs: LogEntry[] = [];
  const add = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = { ts: new Date().toISOString(), level, message };
    logs.push(entry);
    onLog(entry);
  };

  if (!config.effectiveLlmKey) {
    add('warn', 'No LLM key: set GEMINI_API_KEY or OPENAI_API_KEY to run automation.');
    return {
      success: false,
      error: 'Set GEMINI_API_KEY (or OPENAI_API_KEY) to run automation.',
      progress: 0,
      logs,
    };
  }

  // Use Gemini when OPENAI_API_KEY is not set: point OpenAI client to Gemini's compatible endpoint
  if (config.openaiCompatibleBaseUrl) {
    process.env.OPENAI_API_KEY = config.effectiveLlmKey;
    process.env.OPENAI_BASE_URL = config.openaiCompatibleBaseUrl;
    add('info', 'Using Gemini for browser agent (OpenAI-compatible API).');
  }

  const task = dryRun
    ? `Open this LinkedIn job page: ${jobUrl}. Click the "Easy Apply" button. Do NOT fill out the form or click Submit - stop after the Easy Apply modal opens. Report when done.`
    : `Open this LinkedIn job page: ${jobUrl}. Click "Easy Apply" and complete the application form step by step. Click "Next" through each step until you see "Submit", then click Submit to apply. Report when the application is submitted.`;

  let browser: BrowserUseBrowser | null = null;

  try {
    add('info', 'Loading browser-use agent');
    const mod = await import('browser-use-node');
    const Agent = (mod as { Agent?: unknown }).Agent ?? (mod as { default?: { Agent?: unknown } }).default?.Agent;
    const Browser = (mod as { Browser?: unknown }).Browser ?? (mod as { default?: { Browser?: unknown } }).default?.Browser;

    if (!Agent || !Browser) {
      throw new Error('browser-use-node did not export Agent or Browser. Check package version.');
    }

    add('info', 'Launching browser');
    browser = new (Browser as new (opts?: { headless?: boolean }) => BrowserUseBrowser)({
      headless: config.headless,
    }) as BrowserUseBrowser;

    add('info', 'Starting automation task');
    const agent = new (Agent as new (opts: { task: string; browser: BrowserUseBrowser; useVision?: boolean; maxFailures?: number; retryDelay?: number }) => BrowserUseAgent)({
      task,
      browser,
      useVision: true,
      maxFailures: 3,
      retryDelay: 5,
    });

    await agent.run();
    add('info', dryRun ? 'Dry run completed (no submit)' : 'Application flow completed');
    if (browser?.close) await browser.close();
    return { success: true, progress: 100, logs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Browser-use automation error', { error: message });
    add('error', message);
    if (browser?.close) await browser.close().catch(() => {});
    return {
      success: false,
      error: message,
      progress: 50,
      logs,
    };
  }
}
