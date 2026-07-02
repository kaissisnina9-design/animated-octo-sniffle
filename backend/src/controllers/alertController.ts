import { Request, Response, NextFunction } from 'express';
import * as alertService from '../services/alertService';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouseId = (req.query.warehouse_id as string) || null;
    const onlyUnresolved = req.query.unresolved === 'true';
    const { page, limit } = req.query as { page: string; limit: string };
    const result = await alertService.listAlerts(warehouseId, onlyUnresolved, Number(page), Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await alertService.getAlert(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resolve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await alertService.resolveAlert(req.params.id, req.user!.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
