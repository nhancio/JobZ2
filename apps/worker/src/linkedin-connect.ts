import './bootstrap.js';
/**
 * LinkedIn connect: run once when user has a pending linkedin_connect_request.
 * Opens a browser for the user to log into LinkedIn, then saves cookies to linkedin_sessions.
 *
 * Usage: npm run linkedin:connect
 * Prereq: User has clicked "Connect LinkedIn" in the app (creates pending request).
 */
import puppeteer from 'puppeteer';
import { supabase } from './supabase.js';

const LOGIN_URL = 'https://www.linkedin.com/login';
const LOGIN_SUCCESS_COOKIE = 'li_at';
const WAIT_MS = 5 * 60 * 1000; // 5 min max wait for user to log in
const POLL_MS = 2000;

async function main(): Promise<void> {
  const { data: request, error: fetchError } = await supabase
    .from('linkedin_connect_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !request) {
    console.log('No pending LinkedIn connect request. Create one from the app (Connect LinkedIn).');
    process.exit(0);
  }

  console.log('Opening browser for LinkedIn login. Log in manually; cookies will be saved when done.');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

    const start = Date.now();
    while (Date.now() - start < WAIT_MS) {
      const cookies = await page.cookies();
      const hasLiAt = cookies.some((c) => c.name === LOGIN_SUCCESS_COOKIE);
      const url = page.url();
      if (hasLiAt || url.includes('/feed') || url.includes('/mynetwork')) {
        const sessionCookies = cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path ?? '/',
        }));
        const { error: upsertError } = await supabase.from('linkedin_sessions').upsert(
          {
            user_id: request.user_id,
            cookies_json: sessionCookies,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (upsertError) {
          await supabase
            .from('linkedin_connect_requests')
            .update({ status: 'failed', error_message: upsertError.message, updated_at: new Date().toISOString() })
            .eq('id', request.id);
          console.error('Failed to save session:', upsertError.message);
          process.exit(1);
        }
        await supabase
          .from('linkedin_connect_requests')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', request.id);
        console.log('LinkedIn session saved. You can close the browser.');
        await browser.close();
        process.exit(0);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }

    await supabase
      .from('linkedin_connect_requests')
      .update({ status: 'failed', error_message: 'Timeout waiting for login', updated_at: new Date().toISOString() })
      .eq('id', request.id);
    console.error('Timeout: please log in within 5 minutes and run the script again.');
    process.exit(1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('linkedin_connect_requests')
      .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', request.id);
    console.error(err);
    await browser.close();
    process.exit(1);
  }
}

main();
