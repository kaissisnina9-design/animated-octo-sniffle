import db from '../config/database';
import { AuditLog, PaginatedResult, ApiResponse } from '../types';

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  from?: string;
  to?: string;
}

export async function listAuditLogs(
  filters: AuditLogFilters,
  page: number,
  limit: number
): Promise<ApiResponse<PaginatedResult<AuditLog>>> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.user_id) {
    conditions.push(`user_id = $${idx++}`);
    values.push(filters.user_id);
  }
  if (filters.action) {
    conditions.push(`action = $${idx++}`);
    values.push(filters.action);
  }
  if (filters.entity_type) {
    conditions.push(`entity_type = $${idx++}`);
    values.push(filters.entity_type);
  }
  if (filters.entity_id) {
    conditions.push(`entity_id = $${idx++}`);
    values.push(filters.entity_id);
  }
  if (filters.from) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`created_at <= $${idx++}`);
    values.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countValues = [...values];
  const limitValues = [...values, limit, offset];

  const [{ rows: countRows }, { rows: data }] = await Promise.all([
    db.query<{ count: string }>(`SELECT COUNT(*) FROM audit_logs ${where}`, countValues),
    db.query<AuditLog>(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      limitValues
    ),
  ]);

  const total = parseInt(countRows[0].count, 10);

  return {
    success: true,
    data: { data, total, page, limit, total_pages: Math.ceil(total / limit) },
  };
}
