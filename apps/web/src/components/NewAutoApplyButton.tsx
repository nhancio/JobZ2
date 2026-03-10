'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import AutoApplyConfigModal, { type AutoApplyConfig, type ResumeOption } from './AutoApplyConfigModal'
import LinkedInConnectModal from './LinkedInConnectModal'

interface Props {
  resumes?: ResumeOption[]
}

export default function NewAutoApplyButton({ resumes = [] }: Props) {
  const [showModal, setShowModal]       = useState(false)
  const [showLinkedIn, setShowLinkedIn] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const router = useRouter()

  async function handleStart(config: AutoApplyConfig) {
    setLoading(true)
    setShowModal(false)
    setError(null)

    const res = await fetch('/api/auto-apply/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitles:        config.jobTitles,
        location:         config.location,
        maxJobs:          config.maxJobs,
        companyBlocklist: config.companyBlocklist,
        minMatchScore:    config.minMatchScore,
        resumeId:         config.resumeId,
        inlineSkills:     config.inlineSkills,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      const msg = data.error ?? 'Failed to start auto-apply'
      if (res.status === 400 && msg.toLowerCase().includes('linkedin')) {
        setShowLinkedIn(true)
      } else {
        setError(msg)
      }
      setLoading(false)
      return
    }

    router.push(`/jobs?run=${data.jobId}`)
    router.refresh()
  }

  return (
    <div>
      {error && <p className="text-red-400 text-xs mb-2 text-right">{error}</p>}

      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                   bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm
                   transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {loading ? 'Starting…' : '+ New auto-apply job'}
      </button>

      {showModal && (
        <AutoApplyConfigModal
          onStart={handleStart}
          onClose={() => setShowModal(false)}
          resumes={resumes}
        />
      )}

      {showLinkedIn && (
        <LinkedInConnectModal
          onClose={() => setShowLinkedIn(false)}
          onConnected={() => window.location.reload()}
        />
      )}
    </div>
  )
}
