import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase/admin';
import { autoApplyJobSchema } from '@/lib/schemas';
import { PLAN_LIMITS } from '@/lib/types/database';
import type { PlanType } from '@/lib/types/database';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = checkRateLimit(userId);
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

    const db = getAdminDb();

    // Check maintenance mode
    const maintenanceDoc = await db.collection('system_settings').doc('maintenance_mode').get();
    const maintenanceMode = maintenanceDoc.exists && maintenanceDoc.data()?.value === true;
    if (maintenanceMode) {
      return NextResponse.json(
        { error: 'System is in maintenance mode. Please try again later.' },
        { status: 503 }
      );
    }

    // Check feature flags
    const automationFlagDoc = await db.collection('feature_flags').doc('automation_enabled').get();
    const automationEnabled = automationFlagDoc.exists ? automationFlagDoc.data()?.enabled ?? false : false;
    if (!automationEnabled && !parsed.data.dry_run) {
      return NextResponse.json({ error: 'Automation is currently disabled' }, { status: 403 });
    }

    // Check usage limits
    const usageDoc = await db.collection('usage_counters').doc(userId).get();
    const usage    = usageDoc.exists ? usageDoc.data() : null;
    const planType = (usage?.plan_type as PlanType) ?? 'free_plan';
    const limit    = PLAN_LIMITS[planType] ?? 5;
    let applicationsToday = usage?.applications_today ?? 0;
    const lastReset = usage?.last_reset_date;
    const today = new Date().toISOString().slice(0, 10);

    if (lastReset !== today) {
      await db.collection('usage_counters').doc(userId).update({
        applications_today: 0,
        last_reset_date: today,
        updated_at: new Date().toISOString(),
      });
      applicationsToday = 0;
    }

    if (applicationsToday >= limit && !parsed.data.dry_run) {
      return NextResponse.json(
        { error: `Daily limit reached (${limit} applications). Upgrade or try again tomorrow.` },
        { status: 403 }
      );
    }

    const now    = new Date().toISOString();
    const jobRef = db.collection('auto_apply_jobs').doc();
    await jobRef.set({
      user_id:      userId,
      job_url:      parsed.data.job_url,
      job_title:    parsed.data.job_title    ?? null,
      company_name: parsed.data.company_name ?? null,
      resume_id:    parsed.data.resume_id    ?? null,
      dry_run:      parsed.data.dry_run      ?? false,
      status:       'pending',
      progress:     0,
      logs:         [],
      created_at:   now,
      updated_at:   now,
    });

    if (!parsed.data.dry_run) {
      await db.collection('usage_counters').doc(userId).update({
        applications_today: applicationsToday + 1,
        last_reset_date: today,
        updated_at: now,
      });
    }

    return NextResponse.json({ id: jobRef.id, message: 'Job enqueued' });
  } catch (err) {
    console.error('auto-apply error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
