import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { redirect } from 'next/navigation'
import { getAdminDb } from '@/lib/firebase/admin'
import AppliedJobsClient from '@/components/AppliedJobsClient'

export const revalidate = 0

export default async function AppliedPage() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')
  const userId = session.userId!

  const db   = getAdminDb()
  const snap = await db.collection('applied_jobs').where('user_id', '==', userId).get().catch(() => null)
  const jobs = (snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [])
    .sort((a: any, b: any) => (b.applied_at ?? '').localeCompare(a.applied_at ?? ''))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Applied Jobs</h1>
        <p className="text-zinc-400 text-sm mt-1">Every job the automation has touched — filterable and exportable.</p>
      </div>
      <AppliedJobsClient jobs={jobs as any[]} />
    </div>
  )
}
