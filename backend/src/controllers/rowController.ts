import { Request, Response, NextFunction } from 'express';
import * as rowService from '../services/rowService';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = req.query as { page: string; limit: string };
    const result = await rowService.listRows(req.params.warehouseId, Number(page), Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await rowService.getRow(req.params.warehouseId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { row_label, capacity, current_count, status, notes } = req.body;
    const result = await rowService.createRow(
      req.params.warehouseId,
      row_label,
      capacity,
      current_count,
      status,
      notes
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await rowService.updateRow(req.params.warehouseId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await rowService.deleteRow(req.params.warehouseId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
