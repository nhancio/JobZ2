import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

const GEMINI_PROMPT = `Extract the following from this resume as JSON only. Reply with nothing else but valid JSON in this exact shape:
{
  "skills": ["skill1", "skill2"],
  "job_titles": ["title1", "title2"],
  "experience_level": "entry" | "mid" | "senior" | "lead" | "executive",
  "preferred_locations": ["City", "Remote", "Country"]
}
Use empty arrays or null if not found. job_titles = roles they held or target roles. preferred_locations = where they want to work.`;

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body     = await request.json().catch(() => ({}));
  const resumeId = typeof body.resume_id === 'string' ? body.resume_id : null;
  if (!resumeId) {
    return NextResponse.json({ error: 'resume_id required' }, { status: 400 });
  }

  const db  = getAdminDb();
  const doc = await db.collection('resumes').doc(resumeId).get();

  if (!doc.exists || doc.data()?.user_id !== userId) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }

  const resume   = doc.data()!;
  const filePath = (resume.file_path || resume.resume_url) as string;
  if (!filePath) {
    return NextResponse.json({ error: 'Resume file not found' }, { status: 400 });
  }

  // Download from Firebase Storage
  let buffer: Buffer;
  try {
    const bucket   = getAdminStorage().bucket();
    // file_path is the GCS path; resume_url might be a full public URL
    const storagePath = filePath.startsWith('resumes/') ? filePath : filePath.replace(/^https:\/\/storage\.googleapis\.com\/[^/]+\//, '');
    const [fileData] = await bucket.file(storagePath).download();
    buffer = fileData;
  } catch (err) {
    console.error('Firebase Storage download error:', err);
    return NextResponse.json({ error: 'Could not download resume file' }, { status: 500 });
  }

  const base64   = buffer.toString('base64');
  const mimeType = (filePath.endsWith('.pdf') && 'application/pdf') ||
    (filePath.endsWith('.doc') && 'application/msword') ||
    (filePath.endsWith('.docx') && 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    'text/plain';

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
  }

  const genAI  = new GoogleGenerativeAI(apiKey);
  const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: GEMINI_PROMPT },
  ]);

  const text      = result.response.text()?.trim() ?? '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let resumeJson: Record<string, unknown> = {};
  if (jsonMatch) {
    try { resumeJson = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
  }
  if (!Array.isArray(resumeJson.skills))             resumeJson.skills = [];
  if (!Array.isArray(resumeJson.job_titles))         resumeJson.job_titles = [];
  if (!Array.isArray(resumeJson.preferred_locations)) resumeJson.preferred_locations = [];

  await db.collection('resumes').doc(resumeId).update({
    resume_json: resumeJson,
    updated_at:  new Date().toISOString(),
  });

  return NextResponse.json({ resume_json: resumeJson });
}
