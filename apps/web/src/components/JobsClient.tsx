'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Square, Briefcase } from 'lucide-react'
import clsx from 'clsx'

interface CurrentJob { title: string; company: string; step: string }

interface AutoApplyJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  total_found: number
  total_applied: number
  created_at: string
  logs: string[]
  config?: { jobTitles?: string[]; location?: string; maxJobs?: number }
  current_job?: CurrentJob | null
}

function logColor(line: string): string {
  if (line.includes('✅') || line.includes('Applied successfully')) return 'text-emerald-400'
  if (line.includes('❌') || line.includes('Failed') || line.includes('ERROR')) return 'text-red-400'
  if (line.includes('⏭') || line.includes('Skipped')) return 'text-amber-400'
  if (line.includes('⛔') || line.includes('Cancelled')) return 'text-red-400'
  if (line.includes('🎯') || line.includes('🏁') || line.includes('✅')) return 'text-emerald-400'
  if (line.includes('⚠')) return 'text-amber-400'
  return 'text-zinc-500'
}

export default function JobsClient({ initialJobs, hasLinkedIn }: { initialJobs: AutoApplyJob[]; hasLinkedIn: boolean }) {
  const [jobs, setJobs]    = useState<AutoApplyJob[]>(initialJobs)
  const [expanded, setExp] = useState<Record<string, boolean>>({})
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({})
  const searchParams = useSearchParams()
  const activeRunId  = searchParams.get('run')

  const fetchLatest = useCallback(async () => {
    const res  = await fetch('/api/auto-apply/list')
    const data = await res.json()
    if (res.ok) setJobs(data.jobs)
  }, [])

  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending')
    if (!hasRunning) return
    const id = setInterval(fetchLatest, 2500)
    return () => clearInterval(id)
  }, [jobs, fetchLatest])

  useEffect(() => {
    if (activeRunId) setExp(prev => ({ ...prev, [activeRunId]: true }))
  }, [activeRunId])

  async function handleCancel(jobId: string) {
    setCancelling(prev => ({ ...prev, [jobId]: true }))
    await fetch(`/api/auto-apply/${jobId}/cancel`, { method: 'POST' })
    fetchLatest()
    setCancelling(prev => ({ ...prev, [jobId]: false }))
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No runs yet. Click &ldquo;New auto-apply job&rdquo; on the dashboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => {
        const open     = !!expanded[job.id]
        const isActive = job.status === 'running' || job.status === 'pending'
        const logs     = Array.isArray(job.logs) ? job.logs : []
        const cfg      = job.config ?? {}

        return (
          <div key={job.id} className={clsx('bg-zinc-900 border rounded-xl overflow-hidden transition-all', isActive ? 'border-emerald-500/30' : 'border-zinc-800')}>

            {/* Live "currently applying to" card */}
            {isActive && job.current_job && (
              <div className="px-5 pt-4 pb-0">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{job.current_job.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{job.current_job.company} · {job.current_job.step}</p>
                  </div>
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
                </div>
              </div>
            )}

            {/* Header row */}
            <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExp(prev => ({ ...prev, [job.id]: !prev[job.id] }))}>
              <StatusIcon status={job.status} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white">Auto-Apply Run</p>
                  <StatusChip status={job.status} />
                  {cfg.location && <span className="text-xs text-zinc-600">· {cfg.location}</span>}
                  {cfg.jobTitles && cfg.jobTitles.length > 0 && (
                    <span className="text-xs text-zinc-600 truncate max-w-[200px]">· {cfg.jobTitles.join(', ')}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {new Date(job.created_at).toLocaleString()} · Applied <strong className="text-zinc-300">{job.total_applied}</strong> / {job.total_found} found
                </p>
              </div>

              {isActive && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-24">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
                    </div>
                    <p className="text-xs text-zinc-500 text-right mt-0.5">{job.progress}%</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleCancel(job.id) }}
                    disabled={cancelling[job.id]}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
                    title="Cancel run"
                  >
                    {cancelling[job.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                    Stop
                  </button>
                </div>
              )}

              {open ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
            </div>

            {/* Log viewer */}
            {open && logs.length > 0 && (
              <div className="border-t border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Logs</p>
                <div className="space-y-0.5 max-h-72 overflow-y-auto font-mono">
                  {logs.map((line, i) => {
                    const ts   = line.match(/^\[([^\]]+)\]/)?.[1] ?? ''
                    const msg  = line.replace(/^\[[^\]]+\]\s*/, '')
                    return (
                      <div key={i} className="flex gap-2 text-xs leading-relaxed">
                        <span className="text-zinc-700 flex-shrink-0 select-none w-20 truncate">{ts.split('T')[1]?.slice(0, 8)}</span>
                        <span className={logColor(line)}>{msg}</span>
                      </div>
                    )
                  })}
                  {isActive && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                      <span className="text-xs text-emerald-400">Running…</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':   return <Loader2 className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
    case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
    case 'failed':    return <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
    default:          return <Clock className="w-5 h-5 text-zinc-500 flex-shrink-0" />
  }
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', {
      'bg-amber-500/15 text-amber-400':     status === 'running',
      'bg-emerald-500/15 text-emerald-400': status === 'completed',
      'bg-red-500/15 text-red-400':         status === 'failed',
      'bg-zinc-700 text-zinc-400':          status === 'pending',
    })}>
      {status}
    </span>
  )
}
