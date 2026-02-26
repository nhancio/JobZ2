'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Briefcase, LayoutDashboard, FileText, ListTodo, CheckCircle2, Settings, LogOut } from 'lucide-react';

export default function DashboardNav({ user }: { user: { id: string; email?: string } }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/resumes', label: 'Resumes', icon: FileText },
    { href: '/dashboard/jobs', label: 'Jobs', icon: ListTodo },
    { href: '/dashboard/applied', label: 'Applied', icon: CheckCircle2 },
    { href: '/dashboard/preferences', label: 'Preferences', icon: Settings },
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-900">
          <Briefcase className="h-8 w-8 text-primary-600" />
          <span className="font-semibold">JobZ2</span>
        </Link>
        <nav className="flex items-center gap-6">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <span className="text-sm text-slate-500">{user.email ?? ''}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
