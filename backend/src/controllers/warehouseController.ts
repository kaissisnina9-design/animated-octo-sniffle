import { Request, Response, NextFunction } from 'express';
import * as warehouseService from '../services/warehouseService';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = req.query as { page: string; limit: string };
    const result = await warehouseService.listWarehouses(Number(page), Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await warehouseService.getWarehouse(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, location, manager_id } = req.body;
    const result = await warehouseService.createWarehouse(name, location, manager_id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await warehouseService.updateWarehouse(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await warehouseService.deleteWarehouse(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
