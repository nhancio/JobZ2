import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobPreferencesSchema } from '@/lib/schemas';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('job_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function PUT(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const parsed = jobPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from('job_preferences').upsert(
    {
      user_id: userId,
      keywords: parsed.data.keywords,
      locations: parsed.data.locations,
      remote_only: parsed.data.remote_only,
      min_salary: parsed.data.min_salary,
      industries: parsed.data.industries,
      experience_level: parsed.data.experience_level,
      match_threshold: parsed.data.match_threshold,
    },
    { onConflict: 'user_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
