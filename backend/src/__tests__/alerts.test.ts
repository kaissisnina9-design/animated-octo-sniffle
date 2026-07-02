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

const ALERT_ID = '00000000-0000-0000-0000-000000000030';

const mockAlert = {
  id: ALERT_ID,
  row_id: '00000000-0000-0000-0000-000000000020',
  warehouse_id: '00000000-0000-0000-0000-000000000010',
  alert_type: 'CAPACITY_WARNING',
  severity: 'high',
  message: 'Row A1 is near capacity',
  is_resolved: false,
  resolved_by: null,
  resolved_at: null,
  created_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/alerts — list alerts', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/alerts');
    expect(res.status).toBe(401);
  });

  it('returns paginated alerts for authenticated user', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockAlert], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/alerts')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data[0].alert_type).toBe('CAPACITY_WARNING');
  });

  it('returns only unresolved alerts when ?unresolved=true', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockAlert], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/alerts?unresolved=true')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.data.data[0].is_resolved).toBe(false);
  });
});

describe('GET /api/v1/alerts/:id', () => {
  it('returns 422 for invalid UUID', async () => {
    const res = await request(app)
      .get('/api/v1/alerts/not-a-uuid')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(422);
  });

  it('returns 404 when alert does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .get(`/api/v1/alerts/${ALERT_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(404);
  });

  it('returns alert for authenticated user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockAlert], rowCount: 1 } as any);

    const res = await request(app)
      .get(`/api/v1/alerts/${ALERT_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.data.alert.alert_type).toBe('CAPACITY_WARNING');
  });
});

describe('POST /api/v1/alerts/:id/resolve — resolve alert', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post(`/api/v1/alerts/${ALERT_ID}/resolve`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    const res = await request(app)
      .post(`/api/v1/alerts/${ALERT_ID}/resolve`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/alerts/not-a-uuid/resolve')
      .set(bearerHeader(makeToken('operator-uuid', 'operator')));
    expect(res.status).toBe(422);
  });

  it('returns 404 when alert does not exist or already resolved', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .post(`/api/v1/alerts/${ALERT_ID}/resolve`)
      .set(bearerHeader(makeToken('operator-uuid', 'operator')));

    expect(res.status).toBe(404);
  });

  it('resolves alert for operator', async () => {
    const resolved = {
      ...mockAlert,
      is_resolved: true,
      resolved_by: 'operator-uuid',
      resolved_at: new Date(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [resolved], rowCount: 1 } as any);

    const res = await request(app)
      .post(`/api/v1/alerts/${ALERT_ID}/resolve`)
      .set(bearerHeader(makeToken('operator-uuid', 'operator')));

    expect(res.status).toBe(200);
    expect(res.body.data.alert.is_resolved).toBe(true);
    expect(res.body.message).toBe('Alert resolved');
  });
});
