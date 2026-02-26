import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Creates a LinkedIn connect request. The worker (running with browser support)
 * polls for pending requests, opens a browser for the user to log into LinkedIn
 * once, then saves cookies to linkedin_sessions. This API only enqueues the request.
 */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('linkedin_connect_requests')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['pending'])
    .limit(1)
    .maybeSingle();

  if (existing?.status === 'pending') {
    return NextResponse.json({ request_id: existing.id, message: 'Connect already pending' });
  }

  const { data: row, error } = await supabase
    .from('linkedin_connect_requests')
    .insert({ user_id: userId, status: 'pending' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request_id: row.id, message: 'Connect request queued. Run the worker to complete (see README).' });
}
