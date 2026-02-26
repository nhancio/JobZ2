import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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

  const body = await request.json().catch(() => ({}));
  const resumeId = typeof body.resume_id === 'string' ? body.resume_id : null;
  if (!resumeId) {
    return NextResponse.json({ error: 'resume_id required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: resume, error: fetchError } = await supabase
    .from('resumes')
    .select('id, resume_url, file_path, name')
    .eq('id', resumeId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }

  const path = (resume.file_path || resume.resume_url) as string;
  if (!path) {
    return NextResponse.json({ error: 'Resume file not found' }, { status: 400 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('resumes')
    .download(path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Could not download resume file' }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = buffer.toString('base64');
  const mimeType = (path.endsWith('.pdf') && 'application/pdf') ||
    (path.endsWith('.doc') && 'application/msword') ||
    (path.endsWith('.docx') && 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    'text/plain';

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
    { text: GEMINI_PROMPT },
  ]);

  const text = result.response.text()?.trim() ?? '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let resumeJson: Record<string, unknown> = {};
  if (jsonMatch) {
    try {
      resumeJson = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      resumeJson = { skills: [], job_titles: [], experience_level: null, preferred_locations: [] };
    }
  }
  if (!resumeJson.skills || !Array.isArray(resumeJson.skills)) resumeJson.skills = [];
  if (!resumeJson.job_titles || !Array.isArray(resumeJson.job_titles)) resumeJson.job_titles = [];
  if (!resumeJson.preferred_locations || !Array.isArray(resumeJson.preferred_locations)) resumeJson.preferred_locations = [];

  const { error: updateError } = await supabase
    .from('resumes')
    .update({ resume_json: resumeJson, updated_at: new Date().toISOString() })
    .eq('id', resumeId)
    .eq('user_id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ resume_json: resumeJson });
}
