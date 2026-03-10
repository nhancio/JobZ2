import puppeteer, { type Browser, type Page } from 'puppeteer';
import { config } from './config.js';
import type { LogEntry } from './firebase.js';

const LINKEDIN_JOBS_BASE = 'https://www.linkedin.com/jobs/search/';
const NAV_TIMEOUT_MS = 90000;
const DEFAULT_TIMEOUT_MS = 60000;
const STEP_DELAY_MS = 2500;
const PAGE_SETTLE_MS = 4000;

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

function buildSearchUrl(keywords: string[], location: string): string {
  const params = new URLSearchParams();
  if (keywords.length) params.set('keywords', keywords.slice(0, 2).join(' '));
  if (location) params.set('location', location);
  params.set('f_AL', 'true'); // Easy Apply filter
  return `${LINKEDIN_JOBS_BASE}?${params.toString()}`;
}

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

  const keywords  = input.jobTitles.length  ? input.jobTitles  : ((input.resumeData.job_titles as string[])          ?? []);
  const locations = input.locations.length ? input.locations : ((input.resumeData.preferred_locations as string[]) ?? []);

  if (keywords.length === 0) {
    add('error', 'No job titles found. Upload a resume or add job titles in the run config.');
    return { success: false, appliedCount: 0, totalFound: 0, appliedJobs: [], logs, error: 'No job titles' };
  }
  if (locations.length === 0) {
    add('error', 'No locations found. Upload a resume or add locations in the run config.');
    return { success: false, appliedCount: 0, totalFound: 0, appliedJobs: [], logs, error: 'No locations' };
  }

  const searchKeyword  = keywords[0];
  const searchLocation = locations[0];

  if (!input.cookies.length) {
    add('error', 'No LinkedIn session. Connect LinkedIn first.');
    return { success: false, appliedCount: 0, totalFound: 0, appliedJobs: [], logs, error: 'No LinkedIn session' };
  }

  let browser: Browser | null = null;

  try {
    add('info', 'Launching browser with saved LinkedIn session');
    browser = await puppeteer.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // Navigate to LinkedIn then inject cookies
    add('info', 'Loading LinkedIn homepage to set session cookies');
    await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.setCookie(...normalizeCookies(input.cookies));
    await delay(1500);

    // Verify session is valid by checking for the nav bar
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await delay(2000);
    const isLoggedIn = await page.$('.global-nav__me, [data-control-name="nav.settings"]').then(Boolean).catch(() => false);
    if (!isLoggedIn) {
      add('warn', 'LinkedIn session may be expired — continuing anyway');
    } else {
      add('info', 'LinkedIn session verified');
    }

    const searchUrl = buildSearchUrl([searchKeyword], searchLocation);
    add('info', `Searching: "${searchKeyword}" in "${searchLocation}"`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await delay(PAGE_SETTLE_MS);

    // Wait for job listings to appear
    await page.waitForSelector('a[href*="/jobs/view/"]', { timeout: 20000 }).catch(() => {
      add('warn', 'Job listing links not found after waiting — page may have changed structure');
    });

    const jobLinks = await page.$$eval(
      'a[href*="/jobs/view/"]',
      (links) =>
        (links as HTMLAnchorElement[])
          .map((a) => a.href.split('?')[0]) // strip query params for clean URLs
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
      add('info', `[${i + 1}/${totalFound}] Opening job: ${jobUrl}`);
      try {
        await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        await delay(STEP_DELAY_MS);

        const { title, company, location } = await scrapeJobInfo(page);
        add('info', `Job: "${title ?? 'Unknown'}" at "${company ?? 'Unknown'}"`);

        const applied = await tryEasyApplyOnPage(page, add);
        if (applied) {
          appliedJobs.push({ job_url: jobUrl, job_title: title, company_name: company, job_location: location });
        }
      } catch (jobErr) {
        const msg = jobErr instanceof Error ? jobErr.message : String(jobErr);
        add('warn', `Skipping job ${i + 1} due to error: ${msg}`);
      }
      await delay(STEP_DELAY_MS);
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
    return { title, company, location };
  } catch {
    return { title: null, company: null, location: null };
  }
}

async function clickButtonByText(page: Page, textPattern: RegExp): Promise<boolean> {
  return page.evaluate((pattern: string) => {
    const re = new RegExp(pattern, 'i');
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const b of buttons) {
      if (re.test((b.textContent ?? '').trim())) {
        (b as HTMLButtonElement).click();
        return true;
      }
    }
    return false;
  }, textPattern.source);
}

async function tryEasyApplyOnPage(
  page: Page,
  add: (level: LogEntry['level'], message: string) => void
): Promise<boolean> {
  try {
    // Wait for Easy Apply button to be visible
    await page.waitForSelector(
      'button[data-control-name="jobdetails_topcard_inapply"], button.jobs-apply-button',
      { timeout: 8000 }
    ).catch(() => null);

    const clickedEasy = await clickButtonByText(page, /Easy Apply/i);
    if (!clickedEasy) {
      add('warn', 'Easy Apply button not found — job may require external application');
      return false;
    }
    add('info', 'Clicked Easy Apply');

    // Wait for the modal to appear
    await page.waitForSelector(
      '.jobs-easy-apply-modal, [data-test-modal], .artdeco-modal',
      { timeout: 10000 }
    ).catch(() => null);
    await delay(2000);

    // Step through the form
    for (let step = 0; step < 10; step++) {
      // Try Submit first
      const submitted = await clickButtonByText(page, /^Submit application$/i)
        || await clickButtonByText(page, /^Submit$/i);
      if (submitted) {
        add('info', 'Application submitted successfully');
        await delay(2000);
        return true;
      }

      // Try Review
      const reviewed = await clickButtonByText(page, /^Review$/i);
      if (reviewed) {
        add('info', 'Clicked Review');
        await delay(2000);
        continue;
      }

      // Try Next
      const hasNext = await clickButtonByText(page, /^Next$/i);
      if (hasNext) {
        add('info', `Clicked Next (step ${step + 1})`);
        await delay(2000);
        continue;
      }

      add('warn', 'No Next/Review/Submit button found — stopping form progression');
      break;
    }

    add('warn', 'Could not reach Submit button');
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    add('warn', `Easy Apply failed: ${msg}`);
    return false;
  }
}
