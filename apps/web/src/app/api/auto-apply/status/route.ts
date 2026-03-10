export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = request.nextUrl.searchParams.get('job_id')
  const db    = getAdminDb()

  if (jobId) {
    const doc = await db.collection('auto_apply_jobs').doc(jobId).get()
    if (!doc.exists || doc.data()?.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ id: doc.id, ...doc.data() })
  }

  const snap = await db.collection('auto_apply_jobs').where('user_id', '==', userId).get()
  if (snap.empty) return NextResponse.json(null)
  const latest = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
  return NextResponse.json(latest)
}
