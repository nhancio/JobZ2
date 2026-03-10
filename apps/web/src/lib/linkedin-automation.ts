/**
 * LinkedIn Browser Automation — powered by Puppeteer
 * Server-side only. Never import from client components.
 */
import type { ResumeData } from './gemini'
import * as path from 'path'
import * as os   from 'os'
import * as fs   from 'fs'

interface BrowserLaunchConfig {
  executablePath?: string  // undefined → bundled Chromium
  userDataDir: string      // our isolated dir — no SingletonLock conflict
}

/**
 * Finds the best installed Chromium-based browser (Edge → Chrome → Brave).
 * Uses a persistent isolated userDataDir (~/.jobz2/linkedin-profile) so there
 * is no SingletonLock conflict with the running browser. After first login the
 * session is remembered there permanently.
 */
function findBrowserConfig(): BrowserLaunchConfig | null {
  const home    = os.homedir()
  const ourDir  = path.join(home, '.jobz2', 'linkedin-profile')
  fs.mkdirSync(ourDir, { recursive: true })

  // Allow explicit override via env var
  const envExe = process.env.CHROME_EXECUTABLE_PATH
  if (envExe && fs.existsSync(envExe)) {
    return { executablePath: envExe, userDataDir: ourDir }
  }

  const browsers: Array<{ exe: string }> = []

  if (process.platform === 'win32') {
    browsers.push(
      // Edge — user install
      { exe: path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      // Edge — system installs
      { exe: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
      { exe: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
      // Chrome — user install
      { exe: path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe') },
      // Chrome — system installs
      { exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
      { exe: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
      // Brave
      { exe: path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') },
    )
  } else if (process.platform === 'darwin') {
    browsers.push(
      { exe: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { exe: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { exe: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
    )
  } else {
    browsers.push(
      { exe: '/usr/bin/microsoft-edge' },
      { exe: '/usr/bin/google-chrome' },
      { exe: '/usr/bin/chromium-browser' },
      { exe: '/usr/bin/chromium' },
      { exe: '/usr/bin/brave-browser' },
    )
  }

  for (const b of browsers) {
    if (!fs.existsSync(b.exe)) continue
    return { executablePath: b.exe, userDataDir: ourDir }
  }

  throw new Error(
    'No Chrome/Edge/Brave browser found on this machine.\n' +
    'Install Google Chrome or Microsoft Edge, or set the CHROME_EXECUTABLE_PATH environment variable.'
  )
}

export interface LinkedInCookie {
  name: string; value: string; domain: string; path: string
  expires?: number; httpOnly?: boolean; secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface AutoApplyConfig {
  jobTitles: string[]        // titles to search
  locations: string[]        // e.g. ["Remote", "New York, NY"] — all searched
  maxJobs: number            // cap per run
  companyBlocklist: string[] // skip these companies
  minMatchScore: number      // 0-100, skip below this
}

export interface ApplyResult {
  company: string
  job_title: string
  location: string
  job_url: string
  status: 'applied' | 'failed' | 'skipped'
  match_score: number
  skip_reason?: string
}

export interface AutoApplyProgress {
  total_found: number
  total_applied: number
  progress: number
  logs: string[]
  results: ApplyResult[]
  current_job?: { title: string; company: string; step: string } | null
}

// ── Cancellation registry (in-process, works for local dev) ──────────────────
const _cancelled = new Set<string>()

export function cancelJob(jobId: string) { _cancelled.add(jobId) }
export function isJobCancelled(jobId: string) { return _cancelled.has(jobId) }
export function clearCancelFlag(jobId: string) { _cancelled.delete(jobId) }

// ── Helpers ───────────────────────────────────────────────────────────────────
function humanDelay(base = 1500, variance = 800) {
  return new Promise(r => setTimeout(r, base + Math.random() * variance))
}

function computeMatchScore(jobTitle: string, jobDesc: string, resumeData: ResumeData): number {
  let score = 0
  const titleL = jobTitle.toLowerCase()
  const descL  = jobDesc.toLowerCase()

  // Title match (0-40)
  const resumeTitles = (resumeData.job_titles ?? []).map(t => t.toLowerCase())
  const exactTitle = resumeTitles.some(t => titleL.includes(t) || t.includes(titleL))
  if (exactTitle) {
    score += 40
  } else {
    const words = titleL.split(/\s+/).filter(w => w.length > 3)
    const partialTitle = resumeTitles.some(t => words.some(w => t.includes(w)))
    if (partialTitle) score += 20
  }

  // Skills match (0-40)
  const skills = resumeData.skills ?? []
  if (skills.length > 0) {
    const matched = skills.filter(s => descL.includes(s.toLowerCase()))
    score += Math.round((matched.length / skills.length) * 40)
  }

  // Location match (0-20)
  const locs = (resumeData.preferred_locations ?? []).map(l => l.toLowerCase())
  const prefersRemote = locs.some(l => l.includes('remote'))
  if (prefersRemote || locs.some(l => descL.includes(l.split(',')[0]))) score += 20

  return Math.min(100, score)
}

function isBlacklisted(company: string, blocklist: string[]): boolean {
  const cl = company.toLowerCase()
  return blocklist.some(b => cl.includes(b.toLowerCase()))
}

// ── Capture session ───────────────────────────────────────────────────────────

/**
 * Tries a fast headless check — if the saved profile is still logged into LinkedIn,
 * returns cookies immediately with no visible window.
 */
async function tryHeadlessCapture(): Promise<LinkedInCookie[] | null> {
  const puppeteer = await import('puppeteer')
  let config: BrowserLaunchConfig | null
  try { config = findBrowserConfig() } catch { return null }
  let browser: any
  try {
    browser = await puppeteer.default.launch({
      headless:       true,
      executablePath: config.executablePath,
      userDataDir:    config.userDataDir,
      args:           ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 800 },
    })
    const page = await browser.newPage()
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 12000 })
    await new Promise(r => setTimeout(r, 2000))
    const url = page.url()
    if (url.includes('/feed') || url.includes('/home') || url.includes('/in/')) {
      const cookies = await page.cookies()
      await browser.close()
      return cookies as LinkedInCookie[]
    }
    await browser.close()
    return null
  } catch {
    try { await browser?.close() } catch {}
    return null
  }
}

export async function captureLinkedInSession(timeoutMs = 3 * 60 * 1000): Promise<LinkedInCookie[] | null> {
  const puppeteer = await import('puppeteer')

  // Try headless first — if a saved session exists, no popup needed at all
  const quick = await tryHeadlessCapture()
  if (quick) return quick

  // No saved session → open visible login popup
  const config = findBrowserConfig()

  const browser = await puppeteer.default.launch({
    headless:        false,
    executablePath:  config?.executablePath,  // system Edge/Chrome/Brave, else bundled Chromium
    userDataDir:     config!.userDataDir,     // our isolated dir — no SingletonLock conflict
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--app=https://www.linkedin.com/login', // frameless popup: no address bar, no tabs
      '--window-size=480,680',
      '--window-position=400,80',
      '--no-first-run',
      '--disable-default-apps',
    ],
    defaultViewport: { width: 480, height: 620 },
  })

  try {
    const pages = await browser.pages()
    const page  = pages[0] ?? await browser.newPage()

    const deadline = Date.now() + timeoutMs
    let loggedIn = false
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const url = page.url()
        if (url.includes('/feed') || url.includes('/in/') || url.includes('linkedin.com/home')) {
          loggedIn = true; break
        }
      } catch { /* page navigating */ }
    }
    if (!loggedIn) { await browser.close(); return null }
    await humanDelay(2000, 500)
    const cookies = await page.cookies()
    await browser.close()
    return cookies as LinkedInCookie[]
  } catch (err) {
    await browser.close(); throw err
  }
}

// ── Auto-apply ─────────────────────────────────────────────────────────────────
export async function runAutoApply(
  cookies: LinkedInCookie[],
  resumeData: ResumeData,
  onProgress: (p: AutoApplyProgress) => Promise<void>,
  config: AutoApplyConfig,
  jobId: string,
): Promise<AutoApplyProgress> {
  const puppeteer = await import('puppeteer')

  const progress: AutoApplyProgress = {
    total_found: 0, total_applied: 0, progress: 0,
    logs: [], results: [], current_job: null,
  }

  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`
    progress.logs.push(line)
    console.log(line)
  }

  const browserCfg = (() => { try { return findBrowserConfig() } catch { return null } })()
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: browserCfg?.executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  })

  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(90000)
    page.setDefaultNavigationTimeout(90000)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    )
    if (cookies.length > 0) await page.setCookie(...(cookies as any[]))

    log('Verifying LinkedIn session…')
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await humanDelay(2000)

    if (!page.url().includes('/feed') && !page.url().includes('/home')) {
      log('ERROR: LinkedIn session expired. Please reconnect.')
      progress.progress = 100
      await browser.close()
      return progress
    }

    // Derive titles and locations purely from config + resume — nothing hardcoded
    const titlesToSearch = config.jobTitles.length > 0
      ? config.jobTitles
      : (resumeData.job_titles?.slice(0, 5) ?? [])

    const locationsToSearch = config.locations.length > 0
      ? config.locations
      : (resumeData.preferred_locations?.slice(0, 4) ?? [])

    if (titlesToSearch.length === 0) {
      log('ERROR: No job titles found. Upload a resume or add job titles in the run config.')
      progress.progress = 100
      await browser.close()
      return progress
    }
    if (locationsToSearch.length === 0) {
      log('ERROR: No locations found. Upload a resume or add locations in the run config.')
      progress.progress = 100
      await browser.close()
      return progress
    }

    log(`Searching ${titlesToSearch.length} title(s) × ${locationsToSearch.length} location(s): ${titlesToSearch.join(', ')} | ${locationsToSearch.join(', ')}`)

    const allJobLinks: string[] = []

    outer: for (const title of titlesToSearch) {
      for (const loc of locationsToSearch) {
        if (isJobCancelled(jobId)) break outer

        const searchUrl = new URL('https://www.linkedin.com/jobs/search/')
        searchUrl.searchParams.set('keywords', title)
        searchUrl.searchParams.set('location', loc)
        searchUrl.searchParams.set('f_AL', 'true')  // Easy Apply filter
        searchUrl.searchParams.set('sortBy', 'R')

        log(`Searching: "${title}" in "${loc}"…`)
        await page.goto(searchUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 90000 })
        await humanDelay(2000)

        const links: string[] = await page.evaluate(() => {
          const cards = document.querySelectorAll(
            '.job-card-container a[href*="/jobs/view/"], .jobs-search-results__list-item a[href*="/jobs/view/"]'
          )
          const seen = new Set<string>(); const out: string[] = []
          cards.forEach(a => {
            const href = (a as HTMLAnchorElement).href?.split('?')[0]
            if (href && !seen.has(href)) { seen.add(href); out.push(href) }
          })
          return out
        })
        links.forEach(l => { if (!allJobLinks.includes(l)) allJobLinks.push(l) })
      }
    }

    const totalFound = Math.min(allJobLinks.length, config.maxJobs)
    progress.total_found = totalFound
    log(`Found ${totalFound} Easy Apply jobs across ${titlesToSearch.length} title(s).`)

    if (totalFound === 0) {
      log('No jobs found. Try updating your resume or config.')
      progress.progress = 100
      await browser.close()
      return progress
    }

    for (let i = 0; i < totalFound; i++) {
      if (isJobCancelled(jobId)) {
        log('⛔ Run cancelled by user.')
        break
      }

      progress.progress = Math.round(((i + 1) / totalFound) * 100)

      try {
        await page.goto(allJobLinks[i], { waitUntil: 'domcontentloaded', timeout: 90000 })
        await humanDelay(2000, 1000)

        const meta = await page.evaluate(() => {
          const q = (selectors: string) => {
            for (const s of selectors.split('|')) {
              const el = document.querySelector(s.trim())
              if (el?.textContent?.trim()) return el.textContent.trim()
            }
            return null
          }
          const title = q(
            'h1.job-details-jobs-unified-top-card__job-title | h1.t-24 | h1.topcard__title | h1'
          ) ?? 'Unknown'
          const company = q(
            '.job-details-jobs-unified-top-card__company-name a | .job-details-jobs-unified-top-card__company-name | .jobs-unified-top-card__company-name | .topcard__org-name-link | [data-tracking-control-name="public_jobs_topcard-org-name"]'
          ) ?? 'Unknown'
          const loc = q(
            '.job-details-jobs-unified-top-card__primary-description-container .tvm__text | .jobs-unified-top-card__bullet | .topcard__flavor--bullet'
          ) ?? ''
          const desc = q(
            '.jobs-description-content__text | .jobs-description__content | .jobs-description'
          ) ?? ''
          return { title, company, loc, desc }
        })

        const jobUrl = page.url()

        // Blocklist check
        if (isBlacklisted(meta.company, config.companyBlocklist)) {
          log(`[${i+1}/${totalFound}] ⏭ Skipped "${meta.company}" (blocklisted)`)
          progress.results.push({ company: meta.company, job_title: meta.title, location: meta.loc, job_url: jobUrl, status: 'skipped', match_score: 0, skip_reason: 'Company blocklisted' })
          await onProgress({ ...progress })
          continue
        }

        // Match score check
        const score = computeMatchScore(meta.title, meta.desc, resumeData)
        if (score < config.minMatchScore) {
          log(`[${i+1}/${totalFound}] ⏭ Skipped "${meta.title}" (score ${score} < ${config.minMatchScore})`)
          progress.results.push({ company: meta.company, job_title: meta.title, location: meta.loc, job_url: jobUrl, status: 'skipped', match_score: score, skip_reason: `Low match score (${score})` })
          await onProgress({ ...progress })
          continue
        }

        // Update live "applying to" state
        progress.current_job = { title: meta.title, company: meta.company, step: 'Opening application…' }
        log(`[${i+1}/${totalFound}] 🎯 ${meta.title} at ${meta.company} (score: ${score})`)
        await onProgress({ ...progress })

        // Check for Easy Apply button — try class selector first, then text-based fallback
        const easyApplyBtn = await page.evaluateHandle(() => {
          // Class-based
          const byClass = document.querySelector('button.jobs-apply-button:not([disabled]):not([aria-disabled="true"])')
          if (byClass) return byClass
          // Text-based fallback
          const all = Array.from(document.querySelectorAll('button'))
          return all.find(b =>
            /Easy Apply/i.test(b.textContent?.trim() ?? '') &&
            !b.disabled &&
            b.getAttribute('aria-disabled') !== 'true'
          ) ?? null
        }).then(h => h.asElement()).catch(() => null)

        if (!easyApplyBtn) {
          log(`  → ⏭ Skipped (no Easy Apply)`)
          progress.results.push({ company: meta.company, job_title: meta.title, location: meta.loc, job_url: jobUrl, status: 'skipped', match_score: score, skip_reason: 'No Easy Apply button' })
          progress.current_job = null
          await onProgress({ ...progress })
          continue
        }

        progress.current_job = { title: meta.title, company: meta.company, step: 'Filling application form…' }
        await onProgress({ ...progress })

        await easyApplyBtn.click()
        await humanDelay(2000, 500)

        const applied = await fillEasyApplyForm(page, resumeData)

        if (applied) {
          progress.total_applied++
          log(`  → ✅ Applied successfully`)
          progress.results.push({ company: meta.company, job_title: meta.title, location: meta.loc, job_url: jobUrl, status: 'applied', match_score: score })
        } else {
          log(`  → ❌ Failed (form too complex)`)
          progress.results.push({ company: meta.company, job_title: meta.title, location: meta.loc, job_url: jobUrl, status: 'failed', match_score: score, skip_reason: 'Form too complex' })
          await dismissDialog(page)
        }

        progress.current_job = null
        await onProgress({ ...progress })
        await humanDelay(3000, 1500)
      } catch (err: any) {
        log(`  → ⚠ Error: ${err?.message ?? String(err)}`)
        progress.current_job = null
        await onProgress({ ...progress })
      }
    }

    log(`🏁 Done. Applied to ${progress.total_applied} of ${progress.total_found} jobs.`)
    progress.progress = 100
    progress.current_job = null
  } finally {
    clearCancelFlag(jobId)
    await browser.close()
  }

  return progress
}

async function fillEasyApplyForm(page: any, resume: ResumeData): Promise<boolean> {
  for (let step = 0; step < 8; step++) {
    await humanDelay(1000, 400)

    const phoneInput = await page.$('input[id*="phoneNumber"], input[name*="phone"]')
    if (phoneInput && resume.phone) {
      const val = await page.evaluate((el: HTMLInputElement) => el.value, phoneInput)
      if (!val) { await phoneInput.click({ clickCount: 3 }); await phoneInput.type(resume.phone, { delay: 80 }) }
    }

    const cityInput = await page.$('input[id*="city"], input[name*="city"]')
    if (cityInput && resume.preferred_locations?.[0]) {
      const val = await page.evaluate((el: HTMLInputElement) => el.value, cityInput)
      if (!val) {
        await cityInput.click({ clickCount: 3 })
        await cityInput.type(resume.preferred_locations[0].split(',')[0].trim(), { delay: 80 })
        await humanDelay(800)
        const suggestion = await page.$('.basic-typeahead__selectable')
        if (suggestion) await suggestion.click()
      }
    }

    const yesLabels = await page.$$('label')
    for (const label of yesLabels) {
      const text = await page.evaluate((el: HTMLElement) => el.textContent?.trim(), label)
      if (text === 'Yes') { await label.click().catch(() => {}); await humanDelay(300) }
    }

    const numInputs = await page.$$('input[type="text"][id*="year"], input[type="number"]')
    for (const inp of numInputs) {
      const val = await page.evaluate((el: HTMLInputElement) => el.value, inp)
      if (!val) { await inp.click({ clickCount: 3 }); await inp.type(String(resume.years_of_experience ?? 3), { delay: 60 }) }
    }

    const findBtn = async (patterns: RegExp[]) => {
      const handle = await page.evaluateHandle((pats: string[]) => {
        const all = Array.from(document.querySelectorAll('button'))
        for (const pat of pats) {
          const re = new RegExp(pat, 'i')
          const btn = all.find(b => re.test(b.getAttribute('aria-label') ?? '') && !b.disabled)
          if (btn) return btn
        }
        return null
      }, patterns.map(p => p.source))
      return handle.asElement()
    }

    const submitBtn = await findBtn([/Submit application/i, /^Submit$/i])
    if (submitBtn) {
      await submitBtn.click(); await humanDelay(2000)
      const doneBtn = await findBtn([/Dismiss/i, /Done/i])
      if (doneBtn) await doneBtn.click()
      return true
    }

    const reviewBtn = await findBtn([/Review/i])
    if (reviewBtn) { await reviewBtn.click(); await humanDelay(1500); continue }

    const nextBtn = await findBtn([/Continue to next step/i, /Next/i])
    if (nextBtn) { await nextBtn.click(); await humanDelay(1500); continue }

    return false
  }
  return false
}

async function dismissDialog(page: any) {
  try {
    const dismissBtn = await page.$('button[aria-label="Dismiss"]')
    if (dismissBtn) {
      await dismissBtn.click(); await humanDelay(800)
      const discardBtn = await page.$('button[data-control-name="discard_application_confirm_btn"]')
      if (discardBtn) await discardBtn.click()
    }
  } catch {}
}
