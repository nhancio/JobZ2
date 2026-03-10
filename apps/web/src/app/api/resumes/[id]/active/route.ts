export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { getAdminDb } from '@/lib/firebase/admin'

export async function PUT(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // For single-resume-per-user model, doc ID == userId
  // Verify the requested id matches the user's resume
  const db = getAdminDb()
  const resumeDoc = await db.collection('resumes').doc(userId).get()

  if (!resumeDoc.exists || resumeDoc.id !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await db.collection('resumes').doc(userId).update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
