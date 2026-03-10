export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'
import { captureLinkedInSession } from '@/lib/linkedin-automation'

export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  let cookies: Awaited<ReturnType<typeof captureLinkedInSession>>
  try {
    cookies = await captureLinkedInSession(3 * 60 * 1000)
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error('LinkedIn session capture error:', msg)
    return NextResponse.json({ error: `Failed to open LinkedIn login window: ${msg}` }, { status: 500 })
  }

  if (!cookies) {
    return NextResponse.json(
      { error: 'Login timed out. Please try again and log in within 3 minutes.' },
      { status: 408 }
    )
  }

  try {
    const db  = getAdminDb()
    const now = new Date().toISOString()
    const cleanCookies = JSON.parse(JSON.stringify(cookies))
    await db.collection('linkedin_sessions').doc(userId).set({
      user_id:      userId,
      cookies_json: cleanCookies,
      is_valid:     true,
      updated_at:   now,
    }, { merge: true })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DB error saving linkedin session:', err)
    return NextResponse.json({ error: `DB error: ${err?.message}` }, { status: 500 })
  }
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.userId!

  const db  = getAdminDb()
  const doc = await db.collection('linkedin_sessions').doc(userId).get()
  const data = doc.exists ? { id: doc.id, ...doc.data() } : null

  return NextResponse.json({ session: data })
}
