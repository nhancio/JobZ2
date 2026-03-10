export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const db   = getAdminDb()
  const snap = await db.collection('auto_apply_jobs').where('user_id', '==', userId).get()
  const jobs = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 20)
  return NextResponse.json({ jobs })
}
