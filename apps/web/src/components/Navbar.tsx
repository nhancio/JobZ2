'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Rocket, LogOut, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export interface NavUser {
  name: string | null
  email: string | null
  image: string | null
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/resumes',   label: 'Resume'    },
  { href: '/jobs',      label: 'Jobs'      },
  { href: '/applied',   label: 'Applied'   },
]

export default function Navbar({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const displayName = user.name ?? user.email ?? 'User'
  const firstName   = displayName.split(' ')[0]
  const avatar      = user.image ?? undefined

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#070b0b]/95 backdrop-blur-md border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <Rocket className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">JobZ2</span>
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-zinc-800" />

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 flex-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800/60 transition-colors"
          >
            {avatar ? (
              <img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-700" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[11px] font-bold">
                {firstName[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-zinc-300 hidden sm:block">{firstName}</span>
            <ChevronDown className={clsx('w-3.5 h-3.5 text-zinc-600 transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
