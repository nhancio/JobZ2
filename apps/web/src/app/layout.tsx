import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobZ2 — Auto Apply',
  description: 'Upload your resume and auto-apply to matching LinkedIn jobs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
