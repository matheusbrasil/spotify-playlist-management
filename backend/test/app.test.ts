import request from 'supertest';
import app from '../src/app';

describe('App', () => {
  it('returns ok for health endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
