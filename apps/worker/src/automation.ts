import { chromium } from 'playwright';
import { logger } from './logger.js';
import type { LogEntry } from './supabase.js';

export interface AutomationResult {
  success: boolean;
  error?: string;
  progress: number;
  logs: LogEntry[];
}

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

  let browser;
  try {
    add('info', 'Launching browser');
    browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    add('info', `Navigating to job URL`);
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    add('info', 'Page loaded');

    await page.waitForTimeout(2000);

    const easyApplyButton = page.locator('button:has-text("Easy Apply")').first();
    const count = await easyApplyButton.count();
    if (count === 0) {
      add('warn', 'Easy Apply button not found; job may require manual apply or different layout');
      return {
        success: false,
        error: 'Easy Apply button not found',
        progress: 30,
        logs,
      };
    }

    add('info', 'Clicking Easy Apply');
    await easyApplyButton.click();
    await page.waitForTimeout(3000);

    if (dryRun) {
      add('info', 'Dry run: skipping form fill and submit');
      return { success: true, progress: 90, logs };
    }

    const nextButtons = page.locator('button:has-text("Next")');
    const submitButton = page.locator('button:has-text("Submit")');
    let progress = 40;
    const maxSteps = 10;
    for (let i = 0; i < maxSteps; i++) {
      const submitCount = await submitButton.count();
      if (submitCount > 0) {
        add('info', 'Submit button found');
        await submitButton.first().click();
        progress = 100;
        add('info', 'Application submitted');
        break;
      }
      const nextCount = await nextButtons.count();
      if (nextCount > 0) {
        await nextButtons.first().click();
        progress = 40 + (i + 1) * 6;
        add('info', `Step ${i + 1}: clicked Next`);
        await page.waitForTimeout(2000);
      } else {
        break;
      }
    }

    await browser.close();
    return { success: progress >= 90, progress, logs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Automation error', { error: message });
    add('error', message);
    if (browser) await browser.close().catch(() => {});
    return {
      success: false,
      error: message,
      progress: 50,
      logs,
    };
  }
}
