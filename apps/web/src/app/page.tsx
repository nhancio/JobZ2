import Link from 'next/link';
import { Briefcase } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-primary-50">
      <div className="text-center space-y-6 max-w-lg">
        <div className="flex justify-center">
          <Briefcase className="w-16 h-16 text-primary-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900">JobZ2</h1>
        <p className="text-slate-600">
          AI-powered job auto apply. Store resumes, match jobs with AI, and apply to LinkedIn Easy
          Apply automatically.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
