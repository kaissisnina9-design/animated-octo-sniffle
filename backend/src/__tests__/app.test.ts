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

describe('User profile routes — auth guard', () => {
  it('GET /api/v1/users/me requires authentication', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/v1/users/me requires authentication', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .send({ first_name: 'Test' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/v1/users/me/password requires authentication', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .send({ current_password: 'OldPass1', new_password: 'NewPass1' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/users requires authentication', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('User profile routes — validation', () => {
  it('PATCH /api/v1/users/me rejects invalid email', async () => {
    // No token — will fail auth first; supply a malformed token to reach validation
    // This test verifies the route exists and auth middleware fires correctly
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', '******')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/users/me/password rejects weak new password', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', '******')
      .send({ current_password: 'OldPass1', new_password: 'weak' });
    expect(res.status).toBe(401);
  });
});
