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

function makeToken(sub: string, role: UserRole, email = 'test@test.com'): string {
  return jwt.sign({ sub, email, role }, TEST_SECRET, { expiresIn: '1h' });
}

function bearerHeader(token: string): Record<string, string> {
  return { Authorization: 'Bearer ' + token };
}

const mockLog = {
  id: '00000000-0000-0000-0000-000000000040',
  user_id: '00000000-0000-0000-0000-000000000001',
  action: 'CREATE_ROW',
  entity_type: 'row',
  entity_id: '00000000-0000-0000-0000-000000000020',
  details: { method: 'POST', path: '/rows' },
  ip_address: '127.0.0.1',
  created_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/audit-logs — list audit logs', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(403);
  });

  it('returns 403 for manager role', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set(bearerHeader(makeToken('manager-uuid', 'manager')));
    expect(res.status).toBe(403);
  });

  it('returns 403 for operator role', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set(bearerHeader(makeToken('operator-uuid', 'operator')));
    expect(res.status).toBe(403);
  });

  it('returns paginated audit logs for admin', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockLog], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data[0].action).toBe('CREATE_ROW');
    expect(res.body.data.total).toBe(1);
  });

  it('accepts valid optional filter params', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockLog], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/audit-logs')
      .query({
        action: 'CREATE_ROW',
        entity_type: 'row',
        user_id: '00000000-0000-0000-0000-000000000001',
        entity_id: '00000000-0000-0000-0000-000000000020',
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-12-31T23:59:59.000Z',
      })
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 422 for invalid user_id filter', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?user_id=not-a-uuid')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid from datetime', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?from=not-a-date')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid entity_id filter', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?entity_id=bad-uuid')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));
    expect(res.status).toBe(422);
  });
});
