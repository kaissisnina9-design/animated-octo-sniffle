import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { UserRole } from '../types';

// Mock DB — __esModule: true ensures default import resolves correctly
jest.mock('../config/database', () => ({
  __esModule: true,
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

import db from '../config/database';

const mockDb = db as jest.Mocked<typeof db>;

const app = createApp();

// Sign real tokens using the test secret set by CI env vars
const TEST_SECRET = process.env.JWT_SECRET!;

function makeToken(sub: string, role: UserRole, email = 'test@test.com'): string {
  return jwt.sign({ sub, email, role }, TEST_SECRET, { expiresIn: '1h' });
}

function bearerHeader(token: string): Record<string, string> {
  return { Authorization: 'Bearer ' + token };
}

const mockUser = {
  id: 'user-uuid',
  email: 'user@test.com',
  password: 'hashed',
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'viewer',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/users — list users', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(403);
  });

  it('returns paginated users for admin', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/users')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data[0].email).toBe('user@test.com');
    expect(res.body.data.data[0].password).toBeUndefined();
  });
});

describe('GET /api/v1/users/:id', () => {
  it('returns 422 for invalid UUID', async () => {
    const res = await request(app)
      .get('/api/v1/users/not-a-uuid')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));
    expect(res.status).toBe(422);
  });

  it('returns 404 when user does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .get('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(404);
  });

  it('returns user for admin', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('user@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });
});

describe('GET /api/v1/users/me — get own profile', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('returns profile for authenticated user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('user@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });
});

describe('PATCH /api/v1/users/me — update own profile', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).patch('/api/v1/users/me').send({ first_name: 'Bob' });
    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid body', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ first_name: '' });
    expect(res.status).toBe(422);
  });

  it('updates profile for authenticated user', async () => {
    const updated = { ...mockUser, first_name: 'Bob' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as any);

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ first_name: 'Bob' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.first_name).toBe('Bob');
  });

  it('returns 422 for invalid email in body', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/users/me/password — change password', () => {
  it('returns 422 for missing fields', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ current_password: 'old' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/users/:id — admin update user', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .patch('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ role: 'manager' });
    expect(res.status).toBe(403);
  });

  it('updates user role for admin', async () => {
    const updated = { ...mockUser, role: 'manager' };
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .patch('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ role: 'manager' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('manager');
  });
});

describe('DELETE /api/v1/users/:id — deactivate user', () => {
  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .delete('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(403);
  });

  it('returns 409 when admin tries to deactivate themselves', async () => {
    const adminId = '00000000-0000-0000-0000-000000000099';
    const res = await request(app)
      .delete('/api/v1/users/' + adminId)
      .set(bearerHeader(makeToken(adminId, 'admin')));
    expect(res.status).toBe(409);
  });

  it('deactivates user for admin', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .delete('/api/v1/users/00000000-0000-0000-0000-000000000001')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
