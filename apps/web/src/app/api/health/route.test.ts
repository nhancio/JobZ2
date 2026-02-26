import { GET } from './route';

describe('GET /api/health', () => {
  it('returns 200 with status ok and service name', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', service: 'jobz2-web' });
    expect(typeof body.timestamp).toBe('string');
  });
});
