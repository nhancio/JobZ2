import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_SERVER  ?? 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function sendRunSummaryEmail(opts: {
  to: string
  totalApplied: number
  totalFound: number
  appliedJobs: Array<{ company: string; job_title: string; location?: string; job_url?: string }>
}) {
  const { to, totalApplied, totalFound, appliedJobs } = opts

  const rows = appliedJobs
    .slice(0, 30)
    .map(j => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#d4d4d8">${j.company}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#d4d4d8">${j.job_title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#a1a1aa">${j.location ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #27272a">
          ${j.job_url ? `<a href="${j.job_url}" style="color:#818cf8">View</a>` : '—'}
        </td>
      </tr>`)
    .join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;padding:32px;border-radius:12px;max-width:700px">
      <h2 style="margin:0 0 8px;color:#fff">Auto-Apply Run Complete 🎉</h2>
      <p style="color:#a1a1aa;margin:0 0 24px">Applied to <strong style="color:#818cf8">${totalApplied}</strong> out of ${totalFound} jobs found.</p>
      <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#27272a">
            <th style="text-align:left;padding:10px 12px;color:#71717a;font-size:12px;text-transform:uppercase">Company</th>
            <th style="text-align:left;padding:10px 12px;color:#71717a;font-size:12px;text-transform:uppercase">Role</th>
            <th style="text-align:left;padding:10px 12px;color:#71717a;font-size:12px;text-transform:uppercase">Location</th>
            <th style="text-align:left;padding:10px 12px;color:#71717a;font-size:12px;text-transform:uppercase">Link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${appliedJobs.length > 30 ? `<p style="color:#71717a;font-size:12px;margin-top:12px">...and ${appliedJobs.length - 30} more</p>` : ''}
      <p style="color:#52525b;font-size:12px;margin-top:24px">Sent by Lagentry Auto-Apply</p>
    </div>`

  await transporter.sendMail({
    from:    `"Lagentry" <${process.env.SMTP_USERNAME}>`,
    to,
    subject: `✅ Applied to ${totalApplied} jobs — Auto-Apply Complete`,
    html,
  })
}
