import db from '../config/database';
import { Row, PaginatedResult, ApiResponse } from '../types';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';

export async function listRows(
  warehouseId: string,
  page: number,
  limit: number
): Promise<ApiResponse<PaginatedResult<Row>>> {
  const offset = (page - 1) * limit;

  const [{ rows: countRows }, { rows: data }] = await Promise.all([
    db.query<{ count: string }>(
      'SELECT COUNT(*) FROM rows WHERE warehouse_id = $1',
      [warehouseId]
    ),
    db.query<Row>(
      'SELECT * FROM rows WHERE warehouse_id = $1 ORDER BY row_label ASC LIMIT $2 OFFSET $3',
      [warehouseId, limit, offset]
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

export async function getRow(
  warehouseId: string,
  rowId: string
): Promise<ApiResponse<{ row: Row }>> {
  const { rows } = await db.query<Row>(
    'SELECT * FROM rows WHERE id = $1 AND warehouse_id = $2',
    [rowId, warehouseId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Row');
  }

  return { success: true, data: { row: rows[0] } };
}

export async function createRow(
  warehouseId: string,
  rowLabel: string,
  capacity: number,
  currentCount: number,
  status: Row['status'],
  notes?: string
): Promise<ApiResponse<{ row: Row }>> {
  const existing = await db.query<Row>(
    'SELECT id FROM rows WHERE warehouse_id = $1 AND row_label = $2',
    [warehouseId, rowLabel]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError(`Row label "${rowLabel}" already exists in this warehouse`);
  }

  const { rows } = await db.query<Row>(
    `INSERT INTO rows (warehouse_id, row_label, capacity, current_count, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [warehouseId, rowLabel, capacity, currentCount, status, notes ?? null]
  );

  return {
    success: true,
    data: { row: rows[0] },
    message: 'Row created',
  };
}

export async function updateRow(
  warehouseId: string,
  rowId: string,
  updates: Partial<Pick<Row, 'row_label' | 'capacity' | 'current_count' | 'status' | 'notes'>>
): Promise<ApiResponse<{ row: Row }>> {
  const { rows: existing } = await db.query<Row>(
    'SELECT * FROM rows WHERE id = $1 AND warehouse_id = $2',
    [rowId, warehouseId]
  );

  if (existing.length === 0) {
    throw new NotFoundError('Row');
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const allowedFields = ['row_label', 'capacity', 'current_count', 'status', 'notes'] as const;
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${paramIndex++}`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) {
    return { success: true, data: { row: existing[0] } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(rowId);

  const { rows } = await db.query<Row>(
    `UPDATE rows SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return { success: true, data: { row: rows[0] } };
}

export async function deleteRow(
  warehouseId: string,
  rowId: string
): Promise<ApiResponse> {
  const { rowCount } = await db.query(
    'DELETE FROM rows WHERE id = $1 AND warehouse_id = $2',
    [rowId, warehouseId]
  );

  if (rowCount === 0) {
    throw new NotFoundError('Row');
  }

  return { success: true, message: 'Row deleted' };
}
