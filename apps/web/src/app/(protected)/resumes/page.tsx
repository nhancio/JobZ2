import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { redirect } from 'next/navigation'
import { getAdminDb } from '@/lib/firebase/admin'
import ResumeUploader from '@/components/ResumeUploader'
import ResumeEditor from '@/components/ResumeEditor'
import { FileText, CheckCircle, UploadCloud } from 'lucide-react'

export const revalidate = 0

export default async function ResumesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')
  const userId = session.userId!

  const db = getAdminDb()
  const resumeDoc = await db.collection('resumes').doc(userId).get()
  const resume = resumeDoc.exists ? { id: resumeDoc.id, ...resumeDoc.data() } as any : null

  const parsed = resume?.resume_json as any

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-zinc-800/60 pb-5">
        <h1 className="text-2xl font-bold text-white">Resume</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Upload once — AI extracts your skills, job titles, and locations automatically.
        </p>
      </div>

      {resume ? (
        <div className="space-y-5">
          {/* File card */}
          <div className="flex items-center gap-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{resume.file_name ?? 'resume.pdf'}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Uploaded {new Date(resume.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
            </div>
            <a href={resume.resume_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex-shrink-0">
              View file
            </a>
          </div>

          {/* Parsed data */}
          {parsed && (
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-white">Parsed Data</h2>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-lg">AI-extracted · editable</span>
              </div>
              <ResumeEditor initialData={parsed} />
            </div>
          )}

          {/* Replace */}
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <UploadCloud className="w-4 h-4 text-zinc-400" />
              <h3 className="font-medium text-white text-sm">Replace Resume</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Uploading a new file overwrites your current resume and re-parses everything.
            </p>
            <ResumeUploader existingResumeId={resume.id} />
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Upload Your Resume</h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto">
              PDF or DOCX. We'll extract your skills, job titles, and locations to find matching LinkedIn Easy Apply jobs.
            </p>
          </div>
          <ResumeUploader />
        </div>
      )}
    </div>
  )
}
