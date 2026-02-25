import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autoApplyJobSchema } from '@/lib/schemas';
import { PLAN_LIMITS } from '@/lib/types/database';
import type { PlanType } from '@/lib/types/database';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = checkRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = autoApplyJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: flags } = await supabase.from('feature_flags').select('key, enabled').in('key', ['automation_enabled', 'dry_run_enabled']);
    const automationEnabled = flags?.find((f) => f.key === 'automation_enabled')?.enabled ?? false;
    if (!automationEnabled && !parsed.data.dry_run) {
      return NextResponse.json({ error: 'Automation is currently disabled' }, { status: 403 });
    }

    const { data: usage } = await supabase.from('usage_counters').select('*').eq('user_id', user.id).single();
    const planType = (usage?.plan_type as PlanType) ?? 'free_plan';
    const limit = PLAN_LIMITS[planType] ?? 5;
    let applicationsToday = usage?.applications_today ?? 0;
    const lastReset = usage?.last_reset_date;
    const today = new Date().toISOString().slice(0, 10);
    if (lastReset !== today) {
      await supabase.rpc('maybe_reset_usage_today', { p_user_id: user.id });
      applicationsToday = 0;
    }
    if (applicationsToday >= limit && !parsed.data.dry_run) {
      return NextResponse.json(
        { error: `Daily limit reached (${limit} applications). Upgrade or try again tomorrow.` },
        { status: 403 }
      );
    }

    const { data: job, error: insertError } = await supabase
      .from('auto_apply_jobs')
      .insert({
        user_id: user.id,
        job_url: parsed.data.job_url,
        job_title: parsed.data.job_title ?? null,
        company_name: parsed.data.company_name ?? null,
        resume_id: parsed.data.resume_id ?? null,
        dry_run: parsed.data.dry_run ?? false,
        status: 'pending',
        progress: 0,
        logs: [],
      })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (!parsed.data.dry_run) {
      await supabase
        .from('usage_counters')
        .update({
          applications_today: applicationsToday + 1,
          last_reset_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ id: job?.id, message: 'Job enqueued' });
  } catch (err) {
    console.error('auto-apply error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
