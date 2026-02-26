import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function PUT(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: resume } = await supabase
    .from('resumes')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await supabase.from('resumes').update({ is_active: false }).eq('user_id', userId);
  const { error } = await supabase.from('resumes').update({ is_active: true }).eq('id', id).eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
