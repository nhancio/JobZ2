import './bootstrap.js';
/**
 * LinkedIn connect: run once when user has a pending linkedin_connect_request.
 * Opens a browser for the user to log into LinkedIn, then saves cookies to linkedin_sessions.
 *
 * Usage: npm run linkedin:connect
 * Prereq: User has clicked "Connect LinkedIn" in the app (creates pending request).
 */
import puppeteer from 'puppeteer';
import { db } from './firebase.js';

const LOGIN_URL = 'https://www.linkedin.com/login';
const LOGIN_SUCCESS_COOKIE = 'li_at';
const WAIT_MS = 5 * 60 * 1000; // 5 min max wait for user to log in
const POLL_MS = 2000;

async function main(): Promise<void> {
  const snap = await db.collection('linkedin_connect_requests')
    .where('status', '==', 'pending')
    .orderBy('created_at', 'asc')
    .limit(1)
    .get();

  if (snap.empty) {
    console.log('No pending LinkedIn connect request. Create one from the app (Connect LinkedIn).');
    process.exit(0);
  }

  const requestDoc = snap.docs[0];
  const request    = { id: requestDoc.id, ...requestDoc.data() } as { id: string; user_id: string };

  console.log('Opening browser for LinkedIn login. Log in manually; cookies will be saved when done.');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(90000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

    const start = Date.now();
    while (Date.now() - start < WAIT_MS) {
      const cookies = await page.cookies();
      const hasLiAt = cookies.some((c) => c.name === LOGIN_SUCCESS_COOKIE);
      const url = page.url();
      if (hasLiAt || url.includes('/feed') || url.includes('/mynetwork')) {
        const sessionCookies = cookies.map((c) => ({
          name:   c.name,
          value:  c.value,
          domain: c.domain,
          path:   c.path ?? '/',
        }));

        const now = new Date().toISOString();
        try {
          await db.collection('linkedin_sessions').doc(request.user_id).set({
            user_id:      request.user_id,
            cookies_json: sessionCookies,
            is_valid:     true,
            updated_at:   now,
          }, { merge: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await db.collection('linkedin_connect_requests').doc(request.id).update({
            status: 'failed', error_message: message, updated_at: now,
          });
          console.error('Failed to save session:', message);
          process.exit(1);
        }

        await db.collection('linkedin_connect_requests').doc(request.id).update({
          status: 'completed', updated_at: now,
        });
        console.log('LinkedIn session saved. You can close the browser.');
        await browser.close();
        process.exit(0);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }

    await db.collection('linkedin_connect_requests').doc(request.id).update({
      status: 'failed', error_message: 'Timeout waiting for login', updated_at: new Date().toISOString(),
    });
    console.error('Timeout: please log in within 5 minutes and run the script again.');
    process.exit(1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.collection('linkedin_connect_requests').doc(request.id).update({
      status: 'failed', error_message: message, updated_at: new Date().toISOString(),
    }).catch(() => {});
    console.error(err);
    await browser.close();
    process.exit(1);
  }
}

main();
