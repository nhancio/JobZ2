import {
  autoApplyJobSchema,
  createResumeSchema,
  jobPreferencesSchema,
} from '../schemas';

describe('autoApplyJobSchema', () => {
  it('accepts valid job URL and optional fields', () => {
    const result = autoApplyJobSchema.safeParse({
      job_url: 'https://linkedin.com/jobs/view/123',
      job_title: 'Engineer',
      company_name: 'Acme',
      dry_run: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.job_url).toBe('https://linkedin.com/jobs/view/123');
      expect(result.data.dry_run).toBe(true);
    }
  });

  it('rejects invalid URL', () => {
    const result = autoApplyJobSchema.safeParse({
      job_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('defaults dry_run to true', () => {
    const result = autoApplyJobSchema.safeParse({
      job_url: 'https://example.com/job',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dry_run).toBe(true);
    }
  });
});

describe('createResumeSchema', () => {
  it('accepts valid name and content', () => {
    const result = createResumeSchema.safeParse({
      name: 'My Resume',
      content: { summary: 'Test' },
      is_default: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createResumeSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('jobPreferencesSchema', () => {
  it('accepts valid preferences and clamps match_threshold', () => {
    const result = jobPreferencesSchema.safeParse({
      keywords: ['React'],
      locations: ['Remote'],
      match_threshold: 80,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.match_threshold).toBe(80);
      expect(result.data.keywords).toEqual(['React']);
    }
  });

  it('rejects match_threshold > 100', () => {
    const result = jobPreferencesSchema.safeParse({
      match_threshold: 101,
    });
    expect(result.success).toBe(false);
  });
});
