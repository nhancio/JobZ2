import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { redirect } from 'next/navigation'
import { getAdminDb } from '@/lib/firebase/admin'
import JobsClient from '@/components/JobsClient'
import LinkedInConnectBanner from '@/components/LinkedInConnectBanner'

export const revalidate = 0

export default async function JobsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')
  const userId = session.userId!

  const db = getAdminDb()
  const [jobsSnap, linkedinDoc] = await Promise.all([
    db.collection('auto_apply_jobs').where('user_id', '==', userId).get().catch(() => null),
    db.collection('linkedin_sessions').doc(userId).get().catch(() => null),
  ])

  const jobs = (jobsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [])
    .sort((a: any, b: any) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 20)
  const session_ = linkedinDoc.exists ? linkedinDoc.data() : null

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800/60 pb-5">
        <h1 className="text-2xl font-bold text-white">Auto-Apply Jobs</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Each run searches LinkedIn and submits Easy Apply forms on your behalf.
        </p>
      </div>

      {!session_?.is_valid && <LinkedInConnectBanner />}

      <JobsClient initialJobs={jobs as any[]} hasLinkedIn={!!session_?.is_valid} />
    </div>
  )
}
