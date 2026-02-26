import { createClient } from '@/lib/supabase/server';

/** Get current user id from Supabase session. Use in server components and API routes. */
export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
