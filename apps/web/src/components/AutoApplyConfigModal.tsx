'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Settings, Zap, MapPin, Building2, Target, Mail, FileText, AlertCircle } from 'lucide-react'

export interface AutoApplyConfig {
  jobTitles: string[]
  locations: string[]
  maxJobs: number
  companyBlocklist: string[]
  minMatchScore: number
  notificationEmail: string
  resumeId?: string
  inlineSkills?: string[]
}

export interface ResumeOption {
  id: string
  name: string
  resume_json?: {
    job_titles?: string[]
    preferred_locations?: string[]
    skills?: string[]
  }
}

interface Props {
  onStart: (config: AutoApplyConfig) => void
  onClose: () => void
  resumes?: ResumeOption[]
}

export default function AutoApplyConfigModal({ onStart, onClose, resumes = [] }: Props) {
  const hasResume   = resumes.length > 0
  const multiResume = resumes.length > 1

  const firstResume = resumes[0]
  const [selectedResumeId, setSelectedResumeId] = useState(firstResume?.id ?? '')

  const [jobTitles, setJobTitles]     = useState<string[]>(firstResume?.resume_json?.job_titles?.slice(0, 3) ?? [])
  const [titleInput, setTitleInput]   = useState('')
  const [locations, setLocations]     = useState<string[]>(firstResume?.resume_json?.preferred_locations?.slice(0, 4) ?? [])
  const [locationInput, setLocationInput] = useState('')
  const [maxJobs, setMaxJobs]         = useState(25)
  const [blocklist, setBlocklist]     = useState<string[]>([])
  const [blockInput, setBlockInput]   = useState('')
  const [minScore, setMinScore]       = useState(0)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [inlineSkills, setInlineSkills] = useState('')
  const [loading, setLoading]         = useState(false)

  // Load saved preferences
  useEffect(() => {
    fetch('/api/preferences').then(r => r.json()).then(data => {
      if (data.default_job_titles?.length && !jobTitles.length) setJobTitles(data.default_job_titles)
      if (data.default_locations?.length) setLocations(data.default_locations)
      else if (data.default_location)     setLocations([data.default_location])
      if (data.default_max_jobs)         setMaxJobs(data.default_max_jobs)
      if (data.company_blocklist?.length) setBlocklist(data.company_blocklist)
      if (data.min_match_score)          setMinScore(data.min_match_score)
      if (data.notification_email)       setNotifyEmail(data.notification_email)
    }).catch(() => {})
  }, [])

  function handleResumeChange(id: string) {
    setSelectedResumeId(id)
    const r = resumes.find(r => r.id === id)
    if (r?.resume_json?.job_titles?.length)           setJobTitles(r.resume_json.job_titles.slice(0, 3))
    if (r?.resume_json?.preferred_locations?.length)  setLocations(r.resume_json.preferred_locations.slice(0, 4))
  }

  function addLocation() {
    const l = locationInput.trim()
    if (l && !locations.includes(l)) { setLocations(p => [...p, l]); setLocationInput('') }
  }
  function removeLocation(l: string) { setLocations(p => p.filter(x => x !== l)) }

  function addTitle() {
    const t = titleInput.trim()
    if (t && !jobTitles.includes(t)) { setJobTitles(p => [...p, t]); setTitleInput('') }
  }
  function removeTitle(t: string) { setJobTitles(p => p.filter(x => x !== t)) }

  function addBlock() {
    const b = blockInput.trim()
    if (b && !blocklist.includes(b)) { setBlocklist(p => [...p, b]); setBlockInput('') }
  }
  function removeBlock(b: string) { setBlocklist(p => p.filter(x => x !== b)) }

  async function handleStart() {
    setLoading(true)
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        default_job_titles: jobTitles,
        default_locations: locations,
        default_max_jobs: maxJobs,
        company_blocklist: blocklist,
        min_match_score: minScore,
        notification_email: notifyEmail || null,
      }),
    }).catch(() => {})

    onStart({
      jobTitles,
      locations,
      maxJobs,
      companyBlocklist: blocklist,
      minMatchScore: minScore,
      notificationEmail: notifyEmail,
      resumeId: selectedResumeId || undefined,
      inlineSkills: !hasResume && inlineSkills.trim()
        ? inlineSkills.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Configure Run</h2>
              <p className="text-zinc-500 text-xs">Settings saved for next time</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Resume selector (multi-resume) */}
          {multiResume && (
            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5" /> Resume to Use
              </label>
              <select
                value={selectedResumeId}
                onChange={e => handleResumeChange(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {resumes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* No resume banner */}
          {!hasResume && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-300 font-medium">No resume uploaded</p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Your job titles and location below will be used to search.
                    Add skills to improve match scoring, or{' '}
                    <a href="/resumes" target="_blank" className="underline hover:text-amber-300">upload a resume →</a>
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Your Skills (comma-separated, optional)
                </label>
                <input
                  value={inlineSkills}
                  onChange={e => setInlineSkills(e.target.value)}
                  placeholder="e.g. React, TypeScript, Node.js"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Job Titles */}
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-3">
              <Target className="w-3.5 h-3.5" /> Job Titles to Search
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTitle()}
                placeholder="e.g. Frontend Engineer"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button onClick={addTitle} className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {jobTitles.map(t => (
                <span key={t} className="flex items-center gap-1.5 text-xs bg-emerald-500/15 text-emerald-300 px-2.5 py-1 rounded-lg">
                  {t}
                  <button onClick={() => removeTitle(t)} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {jobTitles.length === 0 && <p className="text-xs text-zinc-500">Add at least one job title to search</p>}
            </div>
          </div>

          {/* Locations */}
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-3">
              <MapPin className="w-3.5 h-3.5" /> Locations to Search
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLocation()}
                placeholder="e.g. New York, NY"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button onClick={addLocation} className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {locations.map(l => (
                <span key={l} className="flex items-center gap-1.5 text-xs bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg">
                  <MapPin className="w-3 h-3 text-zinc-400" />{l}
                  <button onClick={() => removeLocation(l)} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                </span>
              ))}
              {locations.length === 0 && <p className="text-xs text-zinc-500">Add at least one location</p>}
            </div>
          </div>

          {/* Max Applications */}
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5" /> Max Applications
            </label>
            <select
              value={maxJobs}
              onChange={e => setMaxJobs(Number(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} jobs</option>)}
            </select>
          </div>

          {/* Min match score */}
          <div>
            <label className="flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-2"><Target className="w-3.5 h-3.5" /> Min Match Score</span>
              <span className="text-emerald-400 font-semibold normal-case">{minScore}%</span>
            </label>
            <input
              type="range" min={0} max={80} step={5} value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Apply to everything</span>
              <span>Only strong matches</span>
            </div>
          </div>

          {/* Company blocklist */}
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-3">
              <Building2 className="w-3.5 h-3.5" /> Company Blocklist
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={blockInput}
                onChange={e => setBlockInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBlock()}
                placeholder="e.g. Staffing Agency Inc."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button onClick={addBlock} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {blocklist.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {blocklist.map(b => (
                  <span key={b} className="flex items-center gap-1.5 text-xs bg-red-500/10 text-red-400 px-2.5 py-1 rounded-lg">
                    {b}
                    <button onClick={() => removeBlock(b)} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Email notification */}
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-2">
              <Mail className="w-3.5 h-3.5" /> Email Summary on Completion
            </label>
            <input
              type="email"
              value={notifyEmail}
              onChange={e => setNotifyEmail(e.target.value)}
              placeholder="your@email.com (optional)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-700 rounded-xl text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading || jobTitles.length === 0 || locations.length === 0}
            title={jobTitles.length === 0 ? 'Add at least one job title' : locations.length === 0 ? 'Add at least one location' : undefined}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            {loading ? 'Starting…' : `Start — up to ${maxJobs} jobs`}
          </button>
        </div>
      </div>
    </div>
  )
}
