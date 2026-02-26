import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * GET /api/auto-apply/status?job_id=xxx or no query for latest job.
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get('job_id');
  const supabase = createAdminClient();

  if (jobId) {
    const { data, error } = await supabase
      .from('auto_apply_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data } = await supabase
    .from('auto_apply_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
