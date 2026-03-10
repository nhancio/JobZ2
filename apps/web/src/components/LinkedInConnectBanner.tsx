'use client'

import { useState } from 'react'
import { Linkedin, CheckCircle } from 'lucide-react'
import LinkedInConnectModal from './LinkedInConnectModal'

interface Props {
  connected?: boolean
}

export default function LinkedInConnectBanner({ connected = false }: Props) {
  const [showModal, setShowModal]   = useState(false)
  const [isConnected, setConnected] = useState(connected)

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">LinkedIn Connected</p>
          <p className="text-xs text-emerald-400/80 mt-0.5">Session active — ready to auto-apply</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-[#060f1e] border border-[#0077b5]/25 rounded-xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#0077b5]/15 flex items-center justify-center flex-shrink-0">
          <Linkedin className="w-5 h-5 text-[#0077b5]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Connect LinkedIn to start applying</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            One-time setup — your session is saved for all future runs.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-[#0077b5] hover:bg-[#006396] text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          Connect
        </button>
      </div>

      {showModal && (
        <LinkedInConnectModal
          onClose={() => setShowModal(false)}
          onConnected={() => { setConnected(true); window.location.reload() }}
        />
      )}
    </>
  )
}
