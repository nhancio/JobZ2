import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { logger } from './logger.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export async function getMatchScore(
  resumeSummary: string,
  jobTitle: string,
  jobDescription: string
): Promise<number> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Score 0-100 how well the resume matches the job. Reply with only a number.\n\nResume: ${resumeSummary.slice(0, 1500)}\n\nJob: ${jobTitle}\n${jobDescription.slice(0, 1500)}\nScore:`;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() ?? '';
    const num = parseInt(text.replace(/\D/g, '').slice(0, 3), 10);
    const score = Math.min(100, Math.max(0, Number.isNaN(num) ? 50 : num));
    logger.info('AI match score', { jobTitle, score });
    return score;
  } catch (err) {
    logger.error('Gemini failed', { error: String(err) });
    return 50;
  }
}
