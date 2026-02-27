import puppeteer, { type Browser, type Page } from 'puppeteer';
import { config } from './config.js';
import type { LogEntry } from './supabase.js';

const LINKEDIN_JOBS_BASE = 'https://www.linkedin.com/jobs/search/';
const DELAY_MS = 2000;
const PAGE_LOAD_MS = 5000;

export interface SearchAndApplyInput {
  jobTitles: string[];
  locations: string[];
  resumeData: Record<string, unknown>;
  cookies: { name: string; value: string; domain?: string; path?: string }[];
}

export interface AppliedJobInfo {
  job_url: string;
  job_title: string | null;
  company_name: string | null;
  job_location: string | null;
}

export interface SearchAndApplyResult {
  success: boolean;
  appliedCount: number;
  totalFound: number;
  appliedJobs: AppliedJobInfo[];
  logs: LogEntry[];
  error?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Build LinkedIn jobs search URL with keywords, location, and Easy Apply filter.
 */
function buildSearchUrl(keywords: string[], location: string): string {
  const params = new URLSearchParams();
  if (keywords.length) params.set('keywords', keywords.slice(0, 2).join(' '));
  if (location) params.set('location', location);
  params.set('f_AL', 'true'); // Easy Apply
  return `${LINKEDIN_JOBS_BASE}?${params.toString()}`;
}

/**
 * Normalize cookies for Puppeteer (domain required for .linkedin.com).
 */
function normalizeCookies(
  cookies: { name: string; value: string; domain?: string; path?: string }[]
): { name: string; value: string; domain: string; path: string }[] {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain ?? '.linkedin.com',
    path: c.path ?? '/',
  }));
}

/**
 * Run LinkedIn job search and Easy Apply for each result using one browser session.
 */
export async function runLinkedInSearchAndApply(
  input: SearchAndApplyInput,
  onLog: (entry: LogEntry) => void
): Promise<SearchAndApplyResult> {
  const logs: LogEntry[] = [];
  const add = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = { ts: new Date().toISOString(), level, message };
    logs.push(entry);
    onLog(entry);
  };

  const keywords = input.jobTitles.length ? input.jobTitles : (input.resumeData.job_titles as string[]) ?? [];
  const locations = input.locations.length ? input.locations : (input.resumeData.preferred_locations as string[]) ?? [];
  const searchKeyword = keywords[0] ?? 'Software Engineer';
  const searchLocation = locations[0] ?? 'United States';

  if (!input.cookies.length) {
    add('error', 'No LinkedIn session. Connect LinkedIn first (Dashboard or /api/linkedin/connect).');
    return { success: false, appliedCount: 0, totalFound: 0, appliedJobs: [], logs, error: 'No LinkedIn session' };
  }

  let browser: Browser | null = null;

  try {
    add('info', 'Launching browser with saved LinkedIn session');
    browser = await puppeteer.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setDefaultTimeout(30000);

    // Set cookies before navigating (must be on a domain first for some browsers)
    await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' });
    await page.setCookie(...normalizeCookies(input.cookies));
    await delay(1000);

    const searchUrl = buildSearchUrl([searchKeyword], searchLocation);
    add('info', `Searching LinkedIn Jobs: ${searchKeyword} in ${searchLocation}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await delay(PAGE_LOAD_MS);

    const jobLinks = await page.$$eval(
      'a[href*="/jobs/view/"]',
      (links) =>
        (links as HTMLAnchorElement[])
          .map((a) => a.href)
          .filter((href) => href.includes('/jobs/view/'))
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 5)
    );

    const totalFound = jobLinks.length;
    add('info', `Found ${totalFound} Easy Apply job(s)`);
    if (totalFound === 0) {
      await browser.close();
      return { success: true, appliedCount: 0, totalFound: 0, appliedJobs: [], logs };
    }

    const appliedJobs: AppliedJobInfo[] = [];
    for (let i = 0; i < jobLinks.length; i++) {
      const jobUrl = jobLinks[i];
      add('info', `Opening job ${i + 1}/${totalFound}`);
      await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
      await delay(DELAY_MS);

      const { title, company, location } = await scrapeJobInfo(page);
      const applied = await tryEasyApplyOnPage(page, add);
      if (applied) {
        appliedJobs.push({
          job_url: jobUrl,
          job_title: title,
          company_name: company,
          job_location: location,
        });
      }
      await delay(DELAY_MS);
    }

    add('info', `Applied to ${appliedJobs.length} of ${totalFound} jobs`);
    await browser.close();
    return { success: true, appliedCount: appliedJobs.length, totalFound, appliedJobs, logs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    add('error', message);
    if (browser) await browser.close().catch(() => {});
    return { success: false, appliedCount: 0, totalFound: 0, appliedJobs: [], logs, error: message };
  }
}

async function scrapeJobInfo(page: Page): Promise<{ title: string | null; company: string | null; location: string | null }> {
  try {
    const title = await page.$eval('h1', (el) => el.textContent?.trim() ?? null).catch(() => null);
    const company = await page
      .$eval(
        '.job-details-jobs-unified-top-card__company-name, a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        (el) => el.textContent?.trim() ?? null
      )
      .catch(() => null);
    const location = await page
      .$eval(
        '.job-details-jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-container span',
        (el) => el.textContent?.trim() ?? null
      )
      .catch(() => null);
    return {
      title: title ?? null,
      company: company ?? null,
      location: location ?? null,
    };
  } catch {
    return { title: null, company: null, location: null };
  }
}

/**
 * Click a button by visible text (Puppeteer helper). Runs click in page context to avoid handle typing issues.
 */
async function clickButtonByText(page: Page, textPattern: RegExp): Promise<boolean> {
  return page.evaluate((pattern: string) => {
    const re = new RegExp(pattern);
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (re.test((b.textContent ?? '').trim())) {
        (b as HTMLButtonElement).click();
        return true;
      }
    }
    return false;
  }, textPattern.source);
}

/**
 * Try to click Easy Apply and submit on current job page. Returns true if submit succeeded.
 */
async function tryEasyApplyOnPage(page: Page, add: (level: LogEntry['level'], message: string) => void): Promise<boolean> {
  try {
    const clickedEasy = await clickButtonByText(page, /Easy Apply|Apply now/i);
    if (!clickedEasy) {
      add('warn', 'Easy Apply button not found');
      return false;
    }
    add('info', 'Clicked Easy Apply');
    await delay(3000);

    for (let step = 0; step < 10; step++) {
      const submitted = await clickButtonByText(page, /^Submit$/i);
      if (submitted) {
        add('info', 'Submitted application');
        await delay(2000);
        return true;
      }
      const hasNext = await clickButtonByText(page, /^Next$/i);
      if (!hasNext) break;
      add('info', 'Clicked Next');
      await delay(2000);
    }
    return false;
  } catch {
    add('warn', 'Easy Apply step failed or not found');
    return false;
  }
}
