import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }
  const type = file.type || '';
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid file type. Use PDF, DOC, DOCX or TXT.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(path, buffer, { contentType: type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message.includes('fetch') || uploadError.message.includes('timeout') ? 'Cannot reach storage. Use a network that can reach Supabase or run Supabase locally (see README).' : uploadError.message },
        { status: 503 }
      );
    }

    await supabase
      .from('resumes')
      .update({ is_active: false })
      .eq('user_id', userId);

    const { data: resume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        name: file.name,
        resume_url: path,
        file_path: path,
        resume_json: {},
        is_active: true,
        content: {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message.includes('fetch') || insertError.message.includes('timeout') ? 'Cannot reach database. Use a network that can reach Supabase or run Supabase locally (see README).' : insertError.message },
        { status: 503 }
      );
    }
    return NextResponse.json(resume);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = /fetch failed|timeout|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      { error: isNetwork ? 'Cannot reach Supabase. Use a different network or run Supabase locally (see README).' : msg },
      { status: isNetwork ? 503 : 500 }
    );
  }
}
