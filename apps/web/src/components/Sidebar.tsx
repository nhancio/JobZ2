'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  CheckCircle,
  LogOut,
  Rocket,
} from 'lucide-react'
import clsx from 'clsx'

export interface SidebarUser {
  name: string | null
  email: string | null
  image: string | null
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/resumes',   label: 'Resumes',   icon: FileText },
  { href: '/jobs',      label: 'Jobs',       icon: Briefcase },
  { href: '/applied',   label: 'Applied',    icon: CheckCircle },
]

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()

  const displayName = user.name ?? user.email ?? 'User'
  const avatar      = user.image ?? undefined

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#080d0d] border-r border-zinc-800/60 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800/60">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
          <Rocket className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white tracking-tight">JobZ2</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 mb-3">
          {avatar ? (
            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400
                     hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
