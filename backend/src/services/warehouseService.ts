import db from '../config/database';
import { Warehouse, PaginatedResult, ApiResponse } from '../types';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';

export async function listWarehouses(
  page: number,
  limit: number
): Promise<ApiResponse<PaginatedResult<Warehouse>>> {
  const offset = (page - 1) * limit;

  const [{ rows: countRows }, { rows: data }] = await Promise.all([
    db.query<{ count: string }>('SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE'),
    db.query<Warehouse>(
      'SELECT * FROM warehouses WHERE is_active = TRUE ORDER BY name ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    ),
  ]);

  const total = parseInt(countRows[0].count, 10);

  return {
    success: true,
    data: {
      data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
}

export async function getWarehouse(id: string): Promise<ApiResponse<{ warehouse: Warehouse }>> {
  const { rows } = await db.query<Warehouse>(
    'SELECT * FROM warehouses WHERE id = $1 AND is_active = TRUE',
    [id]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Warehouse');
  }

  return { success: true, data: { warehouse: rows[0] } };
}

export async function createWarehouse(
  name: string,
  location?: string,
  managerId?: string
): Promise<ApiResponse<{ warehouse: Warehouse }>> {
  const existing = await db.query<Warehouse>(
    'SELECT id FROM warehouses WHERE name = $1 AND is_active = TRUE',
    [name]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('A warehouse with this name already exists');
  }

  const { rows } = await db.query<Warehouse>(
    `INSERT INTO warehouses (name, location, manager_id) VALUES ($1, $2, $3) RETURNING *`,
    [name, location ?? null, managerId ?? null]
  );

  return {
    success: true,
    data: { warehouse: rows[0] },
    message: 'Warehouse created',
  };
}

export async function updateWarehouse(
  id: string,
  updates: Partial<Pick<Warehouse, 'name' | 'location' | 'manager_id'>>
): Promise<ApiResponse<{ warehouse: Warehouse }>> {
  const { rows: existing } = await db.query<Warehouse>(
    'SELECT * FROM warehouses WHERE id = $1 AND is_active = TRUE',
    [id]
  );

  if (existing.length === 0) {
    throw new NotFoundError('Warehouse');
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.location !== undefined) {
    fields.push(`location = $${paramIndex++}`);
    values.push(updates.location);
  }
  if (updates.manager_id !== undefined) {
    fields.push(`manager_id = $${paramIndex++}`);
    values.push(updates.manager_id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await db.query<Warehouse>(
    `UPDATE warehouses SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return { success: true, data: { warehouse: rows[0] } };
}

export async function deleteWarehouse(id: string): Promise<ApiResponse> {
  const { rowCount } = await db.query(
    'UPDATE warehouses SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE',
    [id]
  );

  if (rowCount === 0) {
    throw new NotFoundError('Warehouse');
  }

  return { success: true, message: 'Warehouse deleted' };
}
