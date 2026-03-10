import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase/admin';

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

  try {
    const now = new Date().toISOString();
    const db  = getAdminDb();

    // Deactivate previous resumes for this user
    const prevSnap = await db.collection('resumes').where('user_id', '==', userId).where('is_active', '==', true).get();
    const batch = db.batch();
    prevSnap.docs.forEach(d => batch.update(d.ref, { is_active: false }));
    await batch.commit();

    // Insert new resume record (no Storage on Spark plan — file stored as metadata only)
    const resumeRef = db.collection('resumes').doc();
    await resumeRef.set({
      user_id:     userId,
      name:        file.name,
      resume_url:  null,
      file_path:   null,
      resume_json: {},
      is_active:   true,
      content:     {},
      created_at:  now,
      updated_at:  now,
    });

    return NextResponse.json({ id: resumeRef.id, user_id: userId, name: file.name, resume_url: null, is_active: true, created_at: now });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Resume upload error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
