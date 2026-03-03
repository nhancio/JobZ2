import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createResumeSchema } from '@/lib/schemas';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      const msg = error.message || '';
      const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
      return NextResponse.json(
        { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
        { status: isNetwork ? 503 : 500 }
      );
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const parsed = createResumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        content: parsed.data.content ?? {},
        is_default: parsed.data.is_default ?? false,
      })
      .select()
      .single();
    if (error) {
      const msg = error.message || '';
      const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
      return NextResponse.json(
        { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
        { status: isNetwork ? 503 : 500 }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach database. Use local Supabase (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}
