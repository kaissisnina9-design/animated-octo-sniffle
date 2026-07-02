import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { UserRole } from '../types';

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

const TEST_SECRET = process.env.JWT_SECRET!;
const TEST_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

function makeToken(sub: string, role: UserRole, email = 'test@test.com'): string {
  return jwt.sign({ sub, email, role }, TEST_SECRET, { expiresIn: '1h' });
}

function makeRefreshToken(sub: string, role: UserRole, email = 'test@test.com'): string {
  return jwt.sign({ sub, email, role }, TEST_REFRESH_SECRET, { expiresIn: '7d' });
}

function bearerHeader(token: string): Record<string, string> {
  return { Authorization: 'Bearer ' + token };
}

const mockUser = {
  id: 'user-uuid',
  email: 'user@test.com',
  password: '$2a$12$hashedpassword',
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

describe('POST /api/v1/auth/register', () => {
  it('returns 422 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'Password1', first_name: 'Jane', last_name: 'Doe' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for weak password (no uppercase)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'jane@test.com', password: 'password1', first_name: 'Jane', last_name: 'Doe' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for weak password (no number)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'jane@test.com', password: 'Password', first_name: 'Jane', last_name: 'Doe' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'jane@test.com', password: 'Password1' });
    expect(res.status).toBe(422);
  });

  it('returns 409 when email already exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'user@test.com', password: 'Password1', first_name: 'Jane', last_name: 'Doe' });

    expect(res.status).toBe(409);
  });

  it('creates account and returns tokens', async () => {
    mockDb.query
      // check existing email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      // insert user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any)
      // insert refresh token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'user@test.com', password: 'Password1', first_name: 'Jane', last_name: 'Doe' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('user@test.com');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 422 for missing body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'Password1' });
    expect(res.status).toBe(422);
  });

  it('returns 401 for unknown email', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password1' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    // bcrypt hash of "WrongPass1" won't match the stored mock hash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns 422 for missing refresh_token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(422);
  });

  it('returns 401 for an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'not.a.valid.jwt' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when refresh token has been revoked', async () => {
    const refreshToken = makeRefreshToken('user-uuid', 'viewer');

    // token not found in DB (revoked)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(401);
  });

  it('returns new access token for valid refresh token', async () => {
    const refreshToken = makeRefreshToken('user-uuid', 'viewer');

    mockDb.query
      // token exists in DB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ id: 'token-row-id' }], rowCount: 1 } as any)
      // fetch user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access_token).toBeDefined();
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 422 for missing refresh_token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(422);
  });

  it('succeeds and deletes refresh token', async () => {
    const refreshToken = makeRefreshToken('user-uuid', 'viewer');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Logged out successfully');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user no longer exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(bearerHeader(makeToken('gone-uuid', 'viewer')));

    expect(res.status).toBe(404);
  });

  it('returns profile for authenticated user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(bearerHeader(makeToken('user-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('user@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });
});
