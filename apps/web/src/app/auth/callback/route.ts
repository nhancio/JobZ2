import { NextResponse } from 'next/server'

// NextAuth handles OAuth callbacks at /api/auth/callback/google automatically.
// This route is kept for backwards compatibility with any old redirect URLs.
export async function GET() {
  return NextResponse.redirect(new URL('/dashboard', process.env.NEXTAUTH_URL ?? 'http://localhost:5000'))
}
