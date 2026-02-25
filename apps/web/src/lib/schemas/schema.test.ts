import { autoApplyJobSchema, jobPreferencesSchema } from './index';

describe('autoApplyJobSchema', () => {
  it('accepts valid job URL', () => {
    const result = autoApplyJobSchema.safeParse({
      job_url: 'https://www.linkedin.com/jobs/view/123',
      dry_run: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = autoApplyJobSchema.safeParse({
      job_url: 'not-a-url',
      dry_run: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('jobPreferencesSchema', () => {
  it('accepts valid match_threshold', () => {
    const result = jobPreferencesSchema.safeParse({ match_threshold: 70 });
    expect(result.success).toBe(true);
  });

  it('rejects match_threshold outside 0-100', () => {
    const result = jobPreferencesSchema.safeParse({ match_threshold: 150 });
    expect(result.success).toBe(false);
  });
});
