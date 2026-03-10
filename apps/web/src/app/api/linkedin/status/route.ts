export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const db  = getAdminDb()
  const doc = await db.collection('linkedin_sessions').doc(userId).get()
  const data = doc.exists ? doc.data() : null

  return NextResponse.json({ connected: !!data?.is_valid, session: data ? { id: doc.id, ...data } : null })
}

export async function DELETE(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const db = getAdminDb()
  await db.collection('linkedin_sessions').doc(userId).update({ is_valid: false })

  return NextResponse.json({ success: true })
}
