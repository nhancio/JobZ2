export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const body = await request.json()

  try {
    const db = getAdminDb()
    await db.collection('resumes').doc(userId).update({
      resume_json: body.resume_json,
      updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Resume update error:', err)
    return NextResponse.json({ error: err?.message ?? 'Failed to update resume' }, { status: 500 })
  }
}
