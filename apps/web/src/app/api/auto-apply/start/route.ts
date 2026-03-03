import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_LIMITS } from '@/lib/types/database';
import type { PlanType } from '@/lib/types/database';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Start automatic job search and apply: read active resume (and parsed resume_json),
 * create one auto_apply_job record (status queued), worker will search LinkedIn
 * using job_titles + preferred_locations and Easy Apply filter, then apply to each.
 */
export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { allowed } = checkRateLimit(userId);
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const supabase = createAdminClient();

    const { data: activeResume } = await supabase
      .from('resumes')
      .select('id, resume_json')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!activeResume) {
      return NextResponse.json({ error: 'No active resume. Upload and set one active first.' }, { status: 400 });
    }

    const { data: maintenanceRow } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();
    if ((maintenanceRow?.value as boolean) === true) {
      return NextResponse.json({ error: 'System is in maintenance mode.' }, { status: 503 });
    }

    const { data: usage } = await supabase.from('usage_counters').select('*').eq('user_id', userId).single();
    const planType = (usage?.plan_type as PlanType) ?? 'free_plan';
    const limit = PLAN_LIMITS[planType] ?? 5;
    let applicationsToday = usage?.applications_today ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    if (usage?.last_reset_date !== today) {
      const { error: resetErr } = await supabase.rpc('maybe_reset_usage_today', { p_user_id: userId });
      if (resetErr) console.warn('maybe_reset_usage_today:', resetErr.message);
      applicationsToday = 0;
    }
    if (applicationsToday >= limit) {
      return NextResponse.json({ error: `Daily limit reached (${limit}). Try again tomorrow.` }, { status: 403 });
    }

    const { data: job, error } = await supabase
      .from('auto_apply_jobs')
      .insert({
        user_id: userId,
        resume_id: activeResume.id,
        job_url: null,
        status: 'pending',
        progress: 0,
        logs: [],
        dry_run: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('DB error auto_apply_jobs insert:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: updateErr } = await supabase
      .from('usage_counters')
      .update({
        applications_today: applicationsToday + 1,
        last_reset_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (updateErr) console.warn('usage_counters update:', updateErr.message);

    return NextResponse.json({ id: job?.id, message: 'Auto-apply started. Worker will search LinkedIn and apply.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/auto-apply/start error:', msg);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}
