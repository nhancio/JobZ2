export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'
import { parseResumeWithGemini, parseResumeTextWithGemini } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const formData = await request.formData()
  const file     = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const isPdf  = file.type === 'application/pdf'
  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  if (!isPdf && !isDocx) {
    return NextResponse.json({ error: 'Only PDF and DOCX files are supported' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // ── 1. Parse with Gemini (from in-memory buffer) ─────────────────────
    let resumeJson
    if (isPdf) {
      resumeJson = await parseResumeWithGemini(buffer, 'application/pdf')
    } else {
      const mammoth = await import('mammoth')
      const { value: plainText } = await mammoth.extractRawText({ buffer })
      resumeJson = await parseResumeTextWithGemini(plainText)
    }

    // ── 2. Save / update in Firestore (no Storage — Spark plan) ──────────
    const db = getAdminDb()
    const now = new Date().toISOString()
    const resumeRef = db.collection('resumes').doc(userId)
    const existing  = await resumeRef.get()

    await resumeRef.set({
      user_id:     userId,
      resume_url:  null,   // Storage not available on Spark plan
      resume_json: resumeJson,
      file_name:   file.name,
      updated_at:  now,
      ...(existing.exists ? {} : { created_at: now }),
    }, { merge: true })

    return NextResponse.json({ success: true, resumeJson })
  } catch (err: any) {
    console.error('Resume upload/parse error:', err)
    return NextResponse.json({ error: err?.message ?? 'Failed to process resume' }, { status: 500 })
  }
}
