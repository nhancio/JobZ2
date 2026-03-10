'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Plus, X, Loader2, CheckCircle } from 'lucide-react'
import type { ResumeData } from '@/lib/gemini'

interface Props {
  initialData: ResumeData
}

export default function ResumeEditor({ initialData }: Props) {
  const router = useRouter()
  const [data, setData]       = useState<ResumeData>({ ...initialData })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [skillInput, setSkillInput]   = useState('')
  const [titleInput, setTitleInput]   = useState('')
  const [locInput, setLocInput]       = useState('')

  function update(field: keyof ResumeData, value: any) {
    setSaved(false)
    setData(prev => ({ ...prev, [field]: value }))
  }

  function addTag(field: 'skills' | 'job_titles' | 'preferred_locations', val: string, setter: (v: string) => void) {
    const trimmed = val.trim()
    if (!trimmed) return
    const arr = (data[field] as string[]) ?? []
    if (!arr.includes(trimmed)) update(field, [...arr, trimmed])
    setter('')
  }

  function removeTag(field: 'skills' | 'job_titles' | 'preferred_locations', val: string) {
    update(field, ((data[field] as string[]) ?? []).filter((x: string) => x !== val))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/resumes/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_json: data }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); router.refresh() }
  }

  return (
    <div className="space-y-5">
      {/* Basic fields */}
      <div className="grid grid-cols-2 gap-4">
        {(['name', 'email', 'phone'] as const).map(field => (
          <div key={field} className={field === 'name' ? 'col-span-2' : ''}>
            <label className="text-xs text-zinc-500 uppercase tracking-wider">{field}</label>
            <input
              value={(data[field] as string) ?? ''}
              onChange={e => update(field, e.target.value)}
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wider">Experience Level</label>
          <select value={data.experience_level ?? 'mid'} onChange={e => update('experience_level', e.target.value)}
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
            {['entry', 'mid', 'senior', 'executive'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wider">Years of Experience</label>
          <input type="number" min={0} max={50} value={data.years_of_experience ?? 0}
            onChange={e => update('years_of_experience', Number(e.target.value))}
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
        </div>
      </div>

      {/* Job titles */}
      <TagField
        label="Target Job Titles" color="indigo"
        tags={data.job_titles ?? []} input={titleInput} setInput={setTitleInput}
        onAdd={() => addTag('job_titles', titleInput, setTitleInput)}
        onRemove={v => removeTag('job_titles', v)}
        placeholder="e.g. Frontend Engineer"
      />

      {/* Skills */}
      <TagField
        label="Skills" color="violet"
        tags={data.skills ?? []} input={skillInput} setInput={setSkillInput}
        onAdd={() => addTag('skills', skillInput, setSkillInput)}
        onRemove={v => removeTag('skills', v)}
        placeholder="e.g. React, TypeScript"
      />

      {/* Locations */}
      <TagField
        label="Preferred Locations" color="emerald"
        tags={data.preferred_locations ?? []} input={locInput} setInput={setLocInput}
        onAdd={() => addTag('preferred_locations', locInput, setLocInput)}
        onRemove={v => removeTag('preferred_locations', v)}
        placeholder="e.g. Remote, New York"
      />

      {/* Summary */}
      <div>
        <label className="text-xs text-zinc-500 uppercase tracking-wider">Summary</label>
        <textarea value={data.summary ?? ''} onChange={e => update('summary', e.target.value)} rows={3}
          className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}

function TagField({ label, color, tags, input, setInput, onAdd, onRemove, placeholder }: {
  label: string; color: 'indigo' | 'violet' | 'emerald'
  tags: string[]; input: string; setInput: (v: string) => void
  onAdd: () => void; onRemove: (v: string) => void; placeholder: string
}) {
  const colors = {
    indigo:  'bg-indigo-500/15 text-indigo-300',
    violet:  'bg-violet-500/15 text-violet-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
  }
  return (
    <div>
      <label className="text-xs text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2 mt-1 mb-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()} placeholder={placeholder}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500" />
        <button onClick={onAdd} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-zinc-300">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <span key={t} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${colors[color]}`}>
            {t}
            <button onClick={() => onRemove(t)} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
    </div>
  )
}
