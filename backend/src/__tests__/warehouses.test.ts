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

const mockWarehouse = {
  id: WAREHOUSE_ID,
  name: 'Main Warehouse',
  location: 'Building A',
  manager_id: null,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/warehouses — list warehouses', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/warehouses');
    expect(res.status).toBe(401);
  });

  it('returns paginated warehouses for authenticated user', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockWarehouse], rowCount: 1 } as any);

    const res = await request(app)
      .get('/api/v1/warehouses')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data[0].name).toBe('Main Warehouse');
  });
});

describe('GET /api/v1/warehouses/:id', () => {
  it('returns 422 for invalid UUID', async () => {
    const res = await request(app)
      .get('/api/v1/warehouses/not-a-uuid')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));
    expect(res.status).toBe(422);
  });

  it('returns 404 when warehouse does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .get(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(404);
  });

  it('returns warehouse for authenticated user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [mockWarehouse], rowCount: 1 } as any);

    const res = await request(app)
      .get(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')));

    expect(res.status).toBe(200);
    expect(res.body.data.warehouse.name).toBe('Main Warehouse');
  });
});

describe('POST /api/v1/warehouses — create warehouse', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/warehouses').send({ name: 'New WH' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(bearerHeader(makeToken('viewer-uuid', 'viewer')))
      .send({ name: 'New WH' });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('returns 409 when warehouse name already exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: WAREHOUSE_ID }], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ name: 'Main Warehouse' });

    expect(res.status).toBe(409);
  });

  it('creates warehouse for admin', async () => {
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockWarehouse], rowCount: 1 } as any);

    const res = await request(app)
      .post('/api/v1/warehouses')
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ name: 'Main Warehouse', location: 'Building A' });

    expect(res.status).toBe(201);
    expect(res.body.data.warehouse.name).toBe('Main Warehouse');
  });
});

describe('PUT /api/v1/warehouses/:id — update warehouse', () => {
  it('returns 403 for operator role', async () => {
    const res = await request(app)
      .put(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('operator-uuid', 'operator')))
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when warehouse does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .put(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')))
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('updates warehouse for manager', async () => {
    const updated = { ...mockWarehouse, name: 'Updated Warehouse' };
    mockDb.query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [mockWarehouse], rowCount: 1 } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as any);

    const res = await request(app)
      .put(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('manager-uuid', 'manager')))
      .send({ name: 'Updated Warehouse' });

    expect(res.status).toBe(200);
    expect(res.body.data.warehouse.name).toBe('Updated Warehouse');
  });
});

describe('DELETE /api/v1/warehouses/:id — delete warehouse', () => {
  it('returns 403 for manager role', async () => {
    const res = await request(app)
      .delete(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('manager-uuid', 'manager')));
    expect(res.status).toBe(403);
  });

  it('returns 404 when warehouse does not exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const res = await request(app)
      .delete(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(404);
  });

  it('soft-deletes warehouse for admin', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const res = await request(app)
      .delete(`/api/v1/warehouses/${WAREHOUSE_ID}`)
      .set(bearerHeader(makeToken('admin-uuid', 'admin')));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
