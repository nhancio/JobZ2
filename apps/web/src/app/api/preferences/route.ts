import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobPreferencesSchema } from '@/lib/schemas';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('job_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      const msg = error.message || '';
      const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
      return NextResponse.json(
        { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
        { status: isNetwork ? 503 : 500 }
      );
    }
    return NextResponse.json(data ?? null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}

/** Normalize body so modal/client can send job_titles/preferred_locations or keywords/locations. */
function normalizePreferencesBody(body: unknown): unknown {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    return {
      ...o,
      keywords: o.keywords ?? o.job_titles ?? [],
      locations: o.locations ?? o.preferred_locations ?? [],
    };
  }
  return body;
}

async function upsertPreferences(userId: string, body: unknown) {
  try {
    const normalized = normalizePreferencesBody(body);
    const parsed = jobPreferencesSchema.safeParse(normalized);
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
    if (error) {
      const msg = error.message || '';
      console.error('DB error saving preferences:', msg);
      const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
      return NextResponse.json(
        { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
        { status: isNetwork ? 503 : 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Preferences upsert error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    return upsertPreferences(userId, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}

/** Accept POST for clients that send preferences via POST (same as PUT). */
export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    return upsertPreferences(userId, body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('POST /api/preferences error:', msg);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}
