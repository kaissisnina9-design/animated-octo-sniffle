import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuditLog } from '../types';

export const auditLog = (action: string, entityType?: string) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next();
    // Fire-and-forget: log after handler completes
    setImmediate(async () => {
      try {
        const entityId =
          req.params.id || req.params.warehouseId || req.params.rowId || null;
        await db.query<AuditLog>(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user?.sub ?? null,
            action,
            entityType ?? null,
            entityId ?? null,
            JSON.stringify({ method: req.method, path: req.path }),
            req.ip ?? null,
          ]
        );
      } catch (err) {
        console.error('Audit log error:', err);
      }
    });
  };
