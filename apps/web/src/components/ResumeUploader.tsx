'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  existingResumeId?: string
}

type State = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'

export default function ResumeUploader({ existingResumeId }: Props) {
  const [state, setState]   = useState<State>('idle')
  const [message, setMsg]   = useState('')
  const [dragging, setDrag] = useState(false)
  const inputRef            = useRef<HTMLInputElement>(null)
  const router              = useRouter()

  async function upload(file: File) {
    if (!file) return

    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(file.type)) {
      setState('error')
      setMsg('Only PDF and DOCX files are supported.')
      return
    }

    setState('uploading')
    setMsg('Uploading your resume…')

    const form = new FormData()
    form.append('file', file)
    if (existingResumeId) form.append('existingId', existingResumeId)

    setState('parsing')
    setMsg('Parsing resume with Gemini AI…')

    const res  = await fetch('/api/resumes', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setState('error')
      setMsg(data.error ?? 'Upload failed. Please try again.')
      return
    }

    setState('done')
    setMsg('Resume parsed successfully!')
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  const busy = state === 'uploading' || state === 'parsing'

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          dragging && 'border-emerald-400 bg-emerald-500/10',
          !dragging && state === 'idle'  && 'border-zinc-700 hover:border-zinc-500',
          !dragging && state === 'done'  && 'border-emerald-500/50 bg-emerald-500/5',
          !dragging && state === 'error' && 'border-red-500/50 bg-red-500/5',
          busy && 'border-emerald-500/50 bg-emerald-500/5 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={onFileChange}
          className="hidden"
          disabled={busy}
        />

        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm text-emerald-300">{message}</p>
          </div>
        ) : state === 'done' ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
            <p className="text-sm text-emerald-400">{message}</p>
          </div>
        ) : state === 'error' ? (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400">{message}</p>
            <button
              onClick={e => { e.stopPropagation(); setState('idle') }}
              className="text-xs text-zinc-400 underline hover:text-zinc-200"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-zinc-500" />
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Drop your resume here, or <span className="text-emerald-400">browse</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">PDF or DOCX · Max 10 MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
