'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Rocket, Loader2, Chrome, Zap, Search, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      setError('Failed to sign in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#050808]">

      {/* ── Left: Branding panel ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 bg-gradient-to-br from-[#071410] via-[#081a12] to-[#050808] border-r border-zinc-800/40 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/6 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Rocket className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">JobZ2</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">AI-powered job search</span>
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Apply to 100+ jobs<br />
              <span className="text-emerald-400">while you sleep.</span>
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
              Upload your resume once. JobZ2 reads it, finds matching Easy Apply jobs on LinkedIn, and applies automatically.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-3">
            {[
              { icon: Search,       text: 'Searches LinkedIn for matching jobs' },
              { icon: Zap,          text: 'Fills and submits Easy Apply forms'  },
              { icon: CheckCircle2, text: 'Tracks every application automatically' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-sm text-zinc-300">{text}</p>
              </div>
            ))}
          </div>

          {/* Stat strip */}
          <div className="flex gap-8 pt-2">
            {[
              { value: '100+', label: 'Jobs per run' },
              { value: '3 min', label: 'Setup time'  },
              { value: '24/7',  label: 'Runs anytime' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-700 relative z-10">© 2025 JobZ2</p>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">JobZ2</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="text-zinc-500 text-sm mt-1.5">Sign in to continue to your dashboard.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl
                       bg-white text-zinc-900 font-semibold text-sm
                       hover:bg-zinc-100 active:bg-zinc-200 transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed
                       shadow-lg shadow-black/20"
          >
            {loading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Chrome className="w-5 h-5" />
            }
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Steps */}
          <div className="space-y-3 pt-2">
            <p className="text-xs text-zinc-600 uppercase tracking-wider font-medium">How it works</p>
            {[
              { n: '1', t: 'Upload your resume (PDF or DOCX)' },
              { n: '2', t: 'Connect your LinkedIn account once'  },
              { n: '3', t: 'Start a run — AI handles the rest'   },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {s.n}
                </span>
                <p className="text-sm text-zinc-400">{s.t}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-700 text-center pt-4">
            By signing in you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}
