import db from '../config/database';
import { Alert, PaginatedResult, ApiResponse } from '../types';
import { NotFoundError } from '../middleware/errorHandler';

export async function listAlerts(
  warehouseId: string | null,
  onlyUnresolved: boolean,
  page: number,
  limit: number
): Promise<ApiResponse<PaginatedResult<Alert>>> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (warehouseId) {
    conditions.push(`warehouse_id = $${idx++}`);
    values.push(warehouseId);
  }
  if (onlyUnresolved) {
    conditions.push(`is_resolved = FALSE`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countValues = [...values];
  const limitValues = [...values, limit, offset];

  const [{ rows: countRows }, { rows: data }] = await Promise.all([
    db.query<{ count: string }>(`SELECT COUNT(*) FROM alerts ${where}`, countValues),
    db.query<Alert>(
      `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      limitValues
    ),
  ]);

  const total = parseInt(countRows[0].count, 10);

  return {
    success: true,
    data: { data, total, page, limit, total_pages: Math.ceil(total / limit) },
  };
}

export async function getAlert(id: string): Promise<ApiResponse<{ alert: Alert }>> {
  const { rows } = await db.query<Alert>('SELECT * FROM alerts WHERE id = $1', [id]);

  if (rows.length === 0) {
    throw new NotFoundError('Alert');
  }

  return { success: true, data: { alert: rows[0] } };
}

export async function resolveAlert(
  id: string,
  resolvedBy: string
): Promise<ApiResponse<{ alert: Alert }>> {
  const { rows } = await db.query<Alert>(
    `UPDATE alerts
     SET is_resolved = TRUE, resolved_by = $1, resolved_at = NOW()
     WHERE id = $2 AND is_resolved = FALSE
     RETURNING *`,
    [resolvedBy, id]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Alert or alert already resolved');
  }

  return { success: true, data: { alert: rows[0] }, message: 'Alert resolved' };
}

export async function createAlert(
  rowId: string,
  warehouseId: string,
  alertType: string,
  severity: Alert['severity'],
  message: string
): Promise<ApiResponse<{ alert: Alert }>> {
  const { rows } = await db.query<Alert>(
    `INSERT INTO alerts (row_id, warehouse_id, alert_type, severity, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [rowId, warehouseId, alertType, severity, message]
  );

  return { success: true, data: { alert: rows[0] }, message: 'Alert created' };
}
