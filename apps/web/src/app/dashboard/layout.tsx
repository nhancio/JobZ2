import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
  const email = (profile as { email?: string } | null)?.email;

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav user={{ id: userId, email: email ?? undefined }} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
