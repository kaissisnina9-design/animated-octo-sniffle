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

const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000010';
const ROW_ID = '00000000-0000-0000-0000-000000000020';
const BASE = `/api/v1/warehouses/${WAREHOUSE_ID}/rows`;

const mockRow = {
  id: ROW_ID,
  warehouse_id: WAREHOUSE_ID,
  row_label: 'A1',
  capacity: 100,
  current_count: 50,
  status: 'active',
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/warehouses/:warehouseId/rows — list rows', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it('returns paginated rows for authenticated user', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as any);

    const res = await request(app)
      .get(BASE)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data[0].row_label).toBe('A1');
  });
});

describe('GET /api/v1/warehouses/:warehouseId/rows/:id', () => {
  it('returns 422 for invalid row UUID', async () => {
    const res = await request(app)
      .get(`${BASE}/not-a-uuid`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(422);
  });

  it('returns 404 when row does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .get(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(404);
  });

  it('returns row for authenticated user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as any);

    const res = await request(app)
      .get(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.data.row.row_label).toBe('A1');
  });
});

describe('POST /api/v1/warehouses/:warehouseId/rows — create row', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post(BASE).send({ row_label: 'B1', capacity: 50 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    const res = await request(app)
      .post(BASE)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ row_label: 'B1', capacity: 50 });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid body', async () => {
    const res = await request(app)
      .post(BASE)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ row_label: '' });
    expect(res.status).toBe(422);
  });

  it('returns 409 when row label already exists in warehouse', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: ROW_ID }], rowCount: 1 } as any);

    const res = await request(app)
      .post(BASE)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ row_label: 'A1', capacity: 100 });

    expect(res.status).toBe(409);
  });

  it('creates row for operator', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as any);

    const res = await request(app)
      .post(BASE)
      .set(bearerHeader(makeToken('operator-uuid', 'operator')))
      .send({ row_label: 'A1', capacity: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.row.row_label).toBe('A1');
  });
});

describe('PUT /api/v1/warehouses/:warehouseId/rows/:id — update row', () => {
  it('returns 403 for viewer role', async () => {
    const res = await request(app)
      .put(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ capacity: 200 });
    expect(res.status).toBe(403);
  });

  it('returns 404 when row does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .put(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ capacity: 200 });

    expect(res.status).toBe(404);
  });

  it('updates row for operator', async () => {
    const updated = { ...mockRow, capacity: 200 };
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as any);

    const res = await request(app)
      .put(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('operator-uuid', 'operator')))
      .send({ capacity: 200 });

    expect(res.status).toBe(200);
    expect(res.body.data.row.capacity).toBe(200);
  });
});

describe('DELETE /api/v1/warehouses/:warehouseId/rows/:id — delete row', () => {
  it('returns 403 for operator role', async () => {
    const res = await request(app)
      .delete(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('operator-uuid', 'operator')));
    expect(res.status).toBe(403);
  });

  it('returns 404 when row does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .delete(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(404);
  });

  it('deletes row for manager', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await request(app)
      .delete(`${BASE}/${ROW_ID}`)
      .set(bearerHeader(makeToken('manager-uuid', 'manager')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
