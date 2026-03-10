'use client'

import { useState, useMemo } from 'react'
import { ExternalLink, CheckCircle, XCircle, MinusCircle, Search, Download, Filter } from 'lucide-react'

interface AppliedJob {
  id: string
  company: string
  job_title: string
  location?: string
  status: 'applied' | 'failed' | 'skipped'
  applied_at: string
  job_url?: string
  match_score?: number
  skip_reason?: string
}

interface Props {
  jobs: AppliedJob[]
}

type StatusFilter = 'all' | 'applied' | 'failed' | 'skipped'

export default function AppliedJobsClient({ jobs }: Props) {
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatus]       = useState<StatusFilter>('all')
  const [sortBy, setSortBy]             = useState<'date' | 'score' | 'company'>('date')

  const filtered = useMemo(() => {
    let list = jobs
    if (statusFilter !== 'all') list = list.filter(j => j.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j =>
        j.company.toLowerCase().includes(q) ||
        j.job_title.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'score') return (b.match_score ?? 0) - (a.match_score ?? 0)
      if (sortBy === 'company') return a.company.localeCompare(b.company)
      return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
    })
  }, [jobs, search, statusFilter, sortBy])

  const applied = jobs.filter(j => j.status === 'applied').length
  const failed  = jobs.filter(j => j.status === 'failed').length
  const skipped = jobs.filter(j => j.status === 'skipped').length
  const successRate = applied + failed > 0 ? Math.round((applied / (applied + failed)) * 100) : 0

  function exportCSV() {
    const header = 'Company,Role,Location,Status,Match Score,Applied At,Job URL'
    const rows = filtered.map(j =>
      [j.company, j.job_title, j.location ?? '', j.status, j.match_score ?? '', new Date(j.applied_at).toLocaleDateString(), j.job_url ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'applied-jobs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle className="w-5 h-5 text-emerald-400" />} value={applied} label="Applied" color="emerald" />
        <StatCard icon={<XCircle className="w-5 h-5 text-red-400" />}         value={failed}  label="Failed"  color="red"     />
        <StatCard icon={<MinusCircle className="w-5 h-5 text-zinc-400" />}    value={skipped} label="Skipped" color="zinc"    />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{successRate}%</p>
          <p className="text-xs text-zinc-400">Success Rate</p>
          <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${successRate}%` }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search company, role…"
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {(['all', 'applied', 'failed', 'skipped'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500">
            <option value="date">Date</option>
            <option value="score">Match Score</option>
            <option value="company">Company</option>
          </select>
        </div>

        <button onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
          <Download className="w-4 h-4" />
          CSV
        </button>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Company</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-left px-5 py-3 font-medium">Location</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Score</th>
                  <th className="text-left px-5 py-3 font-medium">Applied</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors" title={j.skip_reason}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
                          {j.company[0]?.toUpperCase()}
                        </div>
                        <span className="text-zinc-200 font-medium truncate max-w-[140px]">{j.company}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300 truncate max-w-[160px]">{j.job_title}</td>
                    <td className="px-5 py-3.5 text-zinc-500 truncate max-w-[120px]">{j.location ?? '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={j.status} /></td>
                    <td className="px-5 py-3.5">
                      {j.match_score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${j.match_score >= 60 ? 'bg-emerald-500' : j.match_score >= 30 ? 'bg-amber-500' : 'bg-zinc-600'}`}
                              style={{ width: `${j.match_score}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400">{j.match_score}</span>
                        </div>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(j.applied_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {j.job_url && (
                        <a href={j.job_url} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-zinc-800 text-xs text-zinc-500">
            Showing {filtered.length} of {jobs.length} applications
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No results match your filters.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-zinc-400">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied: 'bg-emerald-500/15 text-emerald-400',
    failed:  'bg-red-500/15 text-red-400',
    skipped: 'bg-zinc-700 text-zinc-400',
  }
  return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${map[status] ?? map.skipped}`}>{status}</span>
}
