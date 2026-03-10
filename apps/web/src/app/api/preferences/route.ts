export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const db  = getAdminDb()
  const doc = await db.collection('user_preferences').doc(userId).get()

  return NextResponse.json(doc.exists ? doc.data() : {})
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.userId!

    const body = await request.json().catch(() => ({}))
    const db   = getAdminDb()
    const now  = new Date().toISOString()

    await db.collection('user_preferences').doc(userId).set({
      user_id:            userId,
      company_blocklist:  body.company_blocklist  ?? [],
      default_job_titles: body.default_job_titles ?? [],
      default_location:   body.default_location   ?? 'Remote',
      default_max_jobs:   body.default_max_jobs    ?? 25,
      min_match_score:    body.min_match_score      ?? 0,
      notification_email: body.notification_email  ?? null,
      updated_at:         now,
    }, { merge: true })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/preferences error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
