/**
 * Example API test (run with npm test from apps/web).
 * @jest-environment node
 */
import { GET } from './route';

describe('GET /api/health', () => {
  it('returns 200 and status ok', async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('jobz2-web');
  });
});
