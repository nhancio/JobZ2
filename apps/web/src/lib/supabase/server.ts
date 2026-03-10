import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components — middleware refreshes the session
          }
        },
      },
    }
  )
}

/**
 * JWT-authenticated client for background tasks.
 * Pass the user's access token captured before the response is sent.
 * This respects RLS (writes only succeed for the token's user_id),
 * so NO service role key is needed.
 */
export function createServiceClient(accessToken?: string) {
  const key = accessToken
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // use anon key + JWT header
    : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false } }
  )

  if (accessToken) {
    // Inject the user's JWT so RLS sees the correct auth.uid()
    client.realtime.setAuth(accessToken)
    // Also set it as the Authorization header via headers option
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      }
    )
  }

  return client
}
