import { z } from 'zod';

export const createResumeSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  content: z.record(z.unknown()).default({}),
  is_default: z.boolean().optional().default(false),
});

export const updateResumeSchema = createResumeSchema.partial();

export const jobPreferencesSchema = z.object({
  keywords: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remote_only: z.boolean().default(false),
  min_salary: z.number().int().min(0).nullable().optional(),
  industries: z.array(z.string()).default([]),
  experience_level: z.array(z.string()).default([]),
  match_threshold: z.number().int().min(0).max(100).default(70),
});

export const autoApplyJobSchema = z.object({
  job_url: z.string().url('Invalid URL'),
  job_title: z.string().max(500).optional().nullable(),
  company_name: z.string().max(300).optional().nullable(),
  resume_id: z.string().uuid().optional().nullable(),
  dry_run: z.boolean().optional().default(true),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
export type JobPreferencesInput = z.infer<typeof jobPreferencesSchema>;
export type AutoApplyJobInput = z.infer<typeof autoApplyJobSchema>;
