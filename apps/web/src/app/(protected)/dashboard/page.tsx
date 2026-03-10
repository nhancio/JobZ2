import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { redirect } from 'next/navigation'
import { getAdminDb } from '@/lib/firebase/admin'
import NewAutoApplyButton from '@/components/NewAutoApplyButton'
import LinkedInConnectBanner from '@/components/LinkedInConnectBanner'
import { Clock, CheckCircle, XCircle, TrendingUp, Zap } from 'lucide-react'

export const revalidate = 0

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')
  const userId = session.userId!

  const db   = getAdminDb()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Fetch all user data — single-field where queries only (no composite indexes needed)
  const [appliedJobsSnap, autoJobsSnap, resumesSnap, legacyResumeDoc, linkedinDoc] = await Promise.all([
    db.collection('applied_jobs').where('user_id', '==', userId).get().catch(() => null),
    db.collection('auto_apply_jobs').where('user_id', '==', userId).get().catch(() => null),
    db.collection('resumes').where('user_id', '==', userId).get().catch(() => null),
    db.collection('resumes').doc(userId).get().catch(() => null),
    db.collection('linkedin_sessions').doc(userId).get().catch(() => null),
  ])

  const allApplied   = appliedJobsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) as any[] ?? []
  const allAutoJobs  = autoJobsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) as any[] ?? []
  const linkedinSess = linkedinDoc?.exists ? linkedinDoc.data() : null

  // Merge resumes from both new format (by user_id field) and legacy (doc ID = userId)
  const resumesByField = resumesSnap?.docs.map(d => ({ id: d.id, ...d.data() })) as any[] ?? []
  const allResumes: any[] = [...resumesByField]
  if (legacyResumeDoc?.exists && !allResumes.some(r => r.id === userId)) {
    allResumes.unshift({ id: legacyResumeDoc.id, ...legacyResumeDoc.data() })
  }
  const resume = allResumes[0] ?? null

  // Compute stats in JS — no index required
  const appliedToday  = allApplied.filter(j => j.status === 'applied' && j.applied_at >= today.toISOString()).length
  const totalApplied  = allApplied.filter(j => j.status === 'applied').length
  const sortedJobs    = allAutoJobs.sort((a: any, b: any) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const runningJobs   = sortedJobs.filter((j: any) => j.status === 'running').slice(0, 3)
  const recentJobs    = sortedJobs.slice(0, 5)
  const recentApplied = allApplied.sort((a: any, b: any) => (b.applied_at ?? '').localeCompare(a.applied_at ?? '')).slice(0, 6)
  const allRuns       = sortedJobs.slice(0, 10)

  const linkedinConnected = linkedinSess?.is_valid === true

  const resumeOptions = allResumes.map(r => ({
    id:          r.id as string,
    name:        (r.file_name ?? r.name ?? 'Resume') as string,
    resume_json: r.resume_json as any ?? undefined,
  }))

  const completedRuns   = allRuns.filter(r => r.status === 'completed')
  const totalFoundAll   = completedRuns.reduce((s: number, r: any) => s + (r.total_found ?? 0), 0)
  const totalAppliedAll = completedRuns.reduce((s: number, r: any) => s + (r.total_applied ?? 0), 0)
  const successRate     = totalFoundAll > 0 ? Math.round((totalAppliedAll / totalFoundAll) * 100) : 0

  const isActive = runningJobs.length > 0

  return (
    <div className="space-y-8">

      {/* ── Hero ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d1f18] via-[#0a1a14] to-[#070b0b] border border-emerald-900/30 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Run in progress
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-white">Hi, {(session.user?.name ?? session.user?.email ?? 'there').split(' ')[0]} 👋</h1>
            <p className="text-zinc-400">Your job search is on autopilot.</p>
          </div>
          <NewAutoApplyButton resumes={resumeOptions} />
        </div>

        {/* Inline stats */}
        <div className="relative z-10 mt-8 grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-800/40 rounded-xl overflow-hidden border border-zinc-800/40">
          {[
            { label: 'Applied today',   value: appliedToday,          highlight: true  },
            { label: 'Total applied',   value: totalApplied,          highlight: false },
            { label: 'Active runs',     value: runningJobs.length,    highlight: false },
            { label: 'Success rate',    value: `${successRate}%`,     highlight: false },
          ].map(s => (
            <div key={s.label} className="bg-[#0a1710]/60 px-5 py-4">
              <p className={`text-2xl font-bold ${s.highlight ? 'text-emerald-400' : 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── LinkedIn connect banner ── */}
      <LinkedInConnectBanner connected={linkedinConnected} />

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Recent runs — wider */}
        <div className="xl:col-span-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
            <h2 className="font-semibold text-white text-sm">Recent Runs</h2>
            {completedRuns.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{successRate}%</span> overall success
              </div>
            )}
          </div>

          {recentJobs.length > 0 ? (
            <div className="divide-y divide-zinc-800/40">
              {recentJobs.map((job: any) => (
                <div key={job.id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-800/20 transition-colors">
                  <RunStatusDot status={job.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium">
                        {job.total_applied ?? 0} applied
                        <span className="text-zinc-600 font-normal"> / {job.total_found ?? 0} found</span>
                      </p>
                      {job.config?.location && (
                        <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">{job.config.location}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(job.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  {job.status === 'running' && (
                    <div className="w-20 flex-shrink-0">
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-600 text-right mt-0.5">{job.progress}%</p>
                    </div>
                  )}
                  <RunStatusBadge status={job.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-3">
                <Zap className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm">No runs yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Click &ldquo;New auto-apply job&rdquo; above to start.</p>
            </div>
          )}
        </div>

        {/* Recently applied — narrower */}
        <div className="xl:col-span-2 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <h2 className="font-semibold text-white text-sm">Recently Applied</h2>
          </div>

          {recentApplied.length > 0 ? (
            <div className="divide-y divide-zinc-800/40">
              {recentApplied.map((j: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0 uppercase">
                    {j.company?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate font-medium">{j.job_title}</p>
                    <p className="text-xs text-zinc-600 truncate">{j.company}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    j.status === 'applied' ? 'bg-emerald-400' :
                    j.status === 'failed'  ? 'bg-red-400'     : 'bg-zinc-600'
                  }`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <CheckCircle className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">No applications yet.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function RunStatusDot({ status }: { status: string }) {
  const cls: Record<string, string> = {
    running:   'bg-amber-400 animate-pulse',
    completed: 'bg-emerald-400',
    failed:    'bg-red-400',
    pending:   'bg-zinc-500',
  }
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls[status] ?? cls.pending}`} />
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running:   'text-amber-400  bg-amber-400/10  border-amber-400/20',
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    failed:    'text-red-400    bg-red-400/10    border-red-400/20',
    pending:   'text-zinc-400   bg-zinc-800      border-zinc-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize border flex-shrink-0 ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}
