import { Request, Response, NextFunction } from 'express';
import * as auditLogService from '../services/auditLogService';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, user_id, action, entity_type, entity_id, from, to } = req.query as {
      page: string;
      limit: string;
      user_id?: string;
      action?: string;
      entity_type?: string;
      entity_id?: string;
      from?: string;
      to?: string;
    };

    const result = await auditLogService.listAuditLogs(
      { user_id, action, entity_type, entity_id, from, to },
      Number(page),
      Number(limit)
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
};
