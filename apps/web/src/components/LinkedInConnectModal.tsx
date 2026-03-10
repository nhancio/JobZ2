'use client'

import { useState, useRef, useEffect } from 'react'
import { Linkedin, X, CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  onClose: () => void
  onConnected: () => void
}

export default function LinkedInConnectModal({ onClose, onConnected }: Props) {
  const [status, setStatus]   = useState<'idle' | 'open' | 'syncing' | 'done' | 'error'>('idle')
  const [err, setErr]         = useState('')
  const popupRef              = useRef<Window | null>(null)
  const pollRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll for popup being closed by the user
  useEffect(() => {
    if (status !== 'open') return
    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(pollRef.current!)
        sync()
      }
    }, 800)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [status])

  function openPopup() {
    const left = Math.round(window.screenX + (window.outerWidth - 500) / 2)
    const top  = Math.round(window.screenY + (window.outerHeight - 700) / 2)
    const popup = window.open(
      'https://www.linkedin.com/login',
      'linkedin-login',
      `popup,width=500,height=700,left=${left},top=${top}`
    )
    if (!popup) {
      setErr('Popup was blocked. Please allow popups for this site and try again.')
      return
    }
    popupRef.current = popup
    setStatus('open')
  }

  async function sync() {
    // Close the popup if still open
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    setStatus('syncing')
    setErr('')
    try {
      const res  = await fetch('/api/linkedin/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error ?? 'Failed to connect. Please try again.')
        setStatus('error')
        return
      }
      setStatus('done')
      setTimeout(() => { onConnected(); onClose() }, 1500)
    } catch {
      setErr('Network error. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl">

        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0077b5]/15 flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-[#0077b5]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Connect LinkedIn</h2>
              <p className="text-zinc-500 text-xs">Opens in your browser — uses your saved passwords</p>
            </div>
          </div>
          {status !== 'syncing' && (
            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">

          {status === 'idle' && (
            <>
              <p className="text-sm text-zinc-400 leading-relaxed">
                A LinkedIn popup will open in your browser. Sign in with your saved passwords — it closes automatically once you're in.
              </p>
              <button
                onClick={openPopup}
                className="w-full py-2.5 bg-[#0077b5] hover:bg-[#006396] text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Linkedin className="w-4 h-4" />
                Open LinkedIn Login
              </button>
            </>
          )}

          {status === 'open' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-zinc-800/60 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <p className="text-sm text-zinc-300">Sign in to the LinkedIn popup that just opened</p>
              </div>
              <p className="text-xs text-zinc-500 text-center">
                The popup will sync automatically when you close it, or click below.
              </p>
              <button
                onClick={sync}
                className="w-full py-2.5 bg-[#0077b5] hover:bg-[#006396] text-white font-semibold text-sm rounded-xl transition-colors"
              >
                I'm signed in — Sync now
              </button>
            </div>
          )}

          {status === 'syncing' && (
            <div className="text-center py-6">
              <Loader2 className="w-8 h-8 text-[#0077b5] animate-spin mx-auto mb-4" />
              <p className="text-sm text-white font-medium">Syncing your session…</p>
              <p className="text-xs text-zinc-500 mt-1.5">This may take a few seconds</p>
            </div>
          )}

          {status === 'error' && (
            <>
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl p-3">{err}</p>
              <button
                onClick={openPopup}
                className="w-full py-2.5 bg-[#0077b5] hover:bg-[#006396] text-white font-semibold text-sm rounded-xl transition-colors"
              >
                Try Again
              </button>
            </>
          )}

          {status === 'done' && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">Connected!</p>
                <p className="text-xs text-emerald-400 mt-0.5">LinkedIn session saved — ready to auto-apply.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
