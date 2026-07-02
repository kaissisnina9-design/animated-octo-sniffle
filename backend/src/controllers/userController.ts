import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await userService.getUserById(req.user!.sub);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = req.query as { page: string; limit: string };
    const result = await userService.listUsers(Number(page), Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await userService.getUserById(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.updateMyProfile(req.user!.sub, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { current_password, new_password } = req.body;
    const result = await userService.updateMyPassword(req.user!.sub, current_password, new_password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const adminUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.adminUpdateUser(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const deactivate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.deactivateUser(req.params.id, req.user!.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
