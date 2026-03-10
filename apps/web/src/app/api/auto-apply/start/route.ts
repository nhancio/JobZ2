export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { getAdminDb } from '@/lib/firebase/admin'
import { runAutoApply, type AutoApplyProgress, type LinkedInCookie, type AutoApplyConfig } from '@/lib/linkedin-automation'
import type { ResumeData } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.userId!

    // Parse config from request body
    let config: AutoApplyConfig
    let resumeId: string | undefined
    let inlineSkills: string[] | undefined
    try {
      const body = await request.json().catch(() => ({}))
      config = {
        jobTitles:        body.jobTitles                          ?? [],
        locations:        Array.isArray(body.locations) ? body.locations : [],
        maxJobs:          body.maxJobs                           ?? 25,
        companyBlocklist: body.companyBlocklist                  ?? [],
        minMatchScore:    body.minMatchScore                     ?? 0,
      }
      resumeId     = body.resumeId     ?? undefined
      inlineSkills = body.inlineSkills ?? undefined
    } catch {
      config = { jobTitles: [], locations: [], maxJobs: 25, companyBlocklist: [], minMatchScore: 0 }
    }

    const db = getAdminDb()

    // Fetch the right resume: by explicit resumeId, by legacy doc(userId), or none
    const [linkedinDoc, prefsDoc] = await Promise.all([
      db.collection('linkedin_sessions').doc(userId).get(),
      db.collection('user_preferences').doc(userId).get(),
    ])

    let resumeDoc = resumeId
      ? await db.collection('resumes').doc(resumeId).get()
      : await db.collection('resumes').doc(userId).get()
    const linkedinData = linkedinDoc.exists ? linkedinDoc.data() : null
    if (!linkedinData?.is_valid) {
      return NextResponse.json({ error: 'LinkedIn not connected. Please connect first.' }, { status: 400 })
    }

    const prefs = prefsDoc.exists ? prefsDoc.data() : null

    // Fill from resume when config fields are empty — resume is the source of truth
    if (resumeDoc.exists) {
      const rj = resumeDoc.data()?.resume_json as any
      if (!config.jobTitles.length && rj?.job_titles?.length)
        config.jobTitles = rj.job_titles.slice(0, 5)
      if (!config.locations.length && rj?.preferred_locations?.length)
        config.locations = rj.preferred_locations.slice(0, 4)
    }

    // Merge saved preferences only for fields still empty
    if (prefs) {
      if (!config.jobTitles.length && prefs.default_job_titles?.length)       config.jobTitles = prefs.default_job_titles
      if (!config.locations.length && prefs.default_locations?.length)        config.locations = prefs.default_locations
      if (config.maxJobs === 25 && prefs.default_max_jobs)                    config.maxJobs   = prefs.default_max_jobs
      if (config.minMatchScore === 0 && prefs.min_match_score)                config.minMatchScore = prefs.min_match_score
      if (!config.companyBlocklist.length && prefs.company_blocklist?.length) config.companyBlocklist = prefs.company_blocklist
    }

    const now    = new Date().toISOString()
    const jobRef = db.collection('auto_apply_jobs').doc()
    await jobRef.set({
      user_id:    userId,
      status:     'running',
      progress:   0,
      logs:       ['Job started. Launching automation…'],
      config,
      job_url:    '',
      created_at: now,
      updated_at: now,
    })

    const jobId      = jobRef.id
    // Build resume data: from doc if available, else minimal inline data
    const resumeData: ResumeData = resumeDoc.exists
      ? (resumeDoc.data()!.resume_json as ResumeData)
      : {
          name: '', email: '', phone: '',
          skills: inlineSkills ?? [],
          job_titles: config.jobTitles,
          experience_level: 'mid',
          years_of_experience: 0,
          preferred_locations: config.locations,
          education: [], work_experience: [], summary: '',
        }
    const cookies    = linkedinData.cookies_json as LinkedInCookie[]
    const notifyEmail = prefs?.notification_email ?? null

    async function persistProgress(p: AutoApplyProgress) {
      await jobRef.update({
        progress:      p.progress,
        total_found:   p.total_found,
        total_applied: p.total_applied,
        logs:          p.logs,
        updated_at:    new Date().toISOString(),
      })

      for (const r of p.results) {
        const existing = await db.collection('applied_jobs')
          .where('auto_apply_job_id', '==', jobId)
          .get()
        const alreadyExists = existing.docs.some(d => d.data().job_url === (r.job_url ?? ''))

        if (!alreadyExists) {
          await db.collection('applied_jobs').add({
            user_id:          userId,
            auto_apply_job_id: jobId,
            company:          r.company,
            job_title:        r.job_title,
            location:         r.location,
            job_url:          r.job_url,
            status:           r.status,
            match_score:      r.match_score,
            skip_reason:      r.skip_reason,
            applied_at:       new Date().toISOString(),
            created_at:       new Date().toISOString(),
          })
        }
      }
    }

    ;(async () => {
      try {
        const final = await runAutoApply(cookies, resumeData, persistProgress, config, jobId)
        await jobRef.update({
          status:        'completed',
          progress:      100,
          total_found:   final.total_found,
          total_applied: final.total_applied,
          logs:          final.logs,
          updated_at:    new Date().toISOString(),
        })

        if (notifyEmail) {
          try {
            const { sendRunSummaryEmail } = await import('@/lib/email')
            const appliedJobs = final.results.filter(r => r.status === 'applied')
            await sendRunSummaryEmail({ to: notifyEmail, totalApplied: final.total_applied, totalFound: final.total_found, appliedJobs })
          } catch (emailErr) { console.error('Email notification failed:', emailErr) }
        }
      } catch (err: any) {
        const errMsg = err?.message ?? String(err)
        await jobRef.update({ status: 'failed', error: errMsg, logs: [`FATAL ERROR: ${errMsg}`], updated_at: new Date().toISOString() })
        await db.collection('linkedin_sessions').doc(userId).update({ is_valid: false })
      }
    })()

    return NextResponse.json({ jobId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('POST /api/auto-apply/start error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
