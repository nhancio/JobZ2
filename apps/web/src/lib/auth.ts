import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { createClient } from '@/lib/supabase/server';

/** Get current user id. Uses NextAuth session first (so login never hits Supabase in browser), then Supabase auth. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const nextAuthId = (session as { supabaseUserId?: string } | null)?.supabaseUserId;
  if (nextAuthId) return nextAuthId;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
