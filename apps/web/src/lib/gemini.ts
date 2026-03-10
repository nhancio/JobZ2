import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ResumeData {
  name: string
  email: string
  phone: string
  skills: string[]
  job_titles: string[]
  experience_level: 'entry' | 'mid' | 'senior' | 'executive'
  years_of_experience: number
  preferred_locations: string[]
  education: Array<{
    degree: string
    school: string
    year?: string
  }>
  work_experience: Array<{
    company: string
    title: string
    duration: string
    description?: string
  }>
  summary: string
}

const SYSTEM_PROMPT = `You are a professional resume parser. Extract structured information from resume text.
Return ONLY a valid JSON object — no markdown, no code fences, no extra text.`

const USER_PROMPT = (text: string) => `
Parse this resume and return a JSON object with exactly these fields:

{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "skills": ["skill1", "skill2"],
  "job_titles": ["Most Recent Title", "Alternative Title"],
  "experience_level": "entry|mid|senior|executive",
  "years_of_experience": 5,
  "preferred_locations": ["City, State", "Remote"],
  "education": [{ "degree": "BS Computer Science", "school": "University", "year": "2020" }],
  "work_experience": [{ "company": "Acme", "title": "Engineer", "duration": "Jan 2022 - Present", "description": "..." }],
  "summary": "2-sentence professional summary"
}

Rules:
- experience_level: entry=0-2yr, mid=3-5yr, senior=6-10yr, executive=10+yr
- job_titles: 2-3 roles this person is qualified for
- preferred_locations: infer from current city, always add "Remote"
- Return ONLY the JSON object

RESUME:
${text}
`

async function callGemini(userMessage: string): Promise<ResumeData> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userMessage)
  const raw = result.response.text().trim()
  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(json) as ResumeData
}

/** Parse a PDF buffer directly — extracts text first via pdf-parse, then calls Gemini */
export async function parseResumeWithGemini(
  fileBuffer: Buffer,
  mimeType: 'application/pdf' | 'text/plain'
): Promise<ResumeData> {
  let text = ''
  if (mimeType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const result = await pdfParse(fileBuffer)
    text = result.text
  } else {
    text = fileBuffer.toString('utf-8')
  }
  return callGemini(USER_PROMPT(text))
}

/** Parse plain text extracted from DOCX (via mammoth) */
export async function parseResumeTextWithGemini(plainText: string): Promise<ResumeData> {
  return callGemini(USER_PROMPT(plainText))
}
