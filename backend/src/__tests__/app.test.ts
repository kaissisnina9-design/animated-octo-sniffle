import request from 'supertest';
import { createApp } from '../app';

// Mock DB and auth service for unit tests
jest.mock('../config/database', () => ({
  default: {
    query: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    end: jest.fn(),
  },
  db: {
    query: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    end: jest.fn(),
  },
}));

const app = createApp();

describe('Health endpoint', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'healthy' });
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth routes — validation', () => {
  it('POST /api/v1/auth/register rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('POST /api/v1/auth/login rejects missing body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
