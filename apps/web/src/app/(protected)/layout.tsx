import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import Navbar from '@/components/Navbar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')

  const navUser = {
    name:  session.user?.name  ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
  }

  return (
    <div className="min-h-screen bg-[#070b0b]">
      <Navbar user={navUser} />
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        {children}
      </main>
    </div>
  )
}
