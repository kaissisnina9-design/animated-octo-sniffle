import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.getUserById(req.user!.sub);
    res.status(200).json(result);
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
    const { first_name, last_name, email } = req.body;
    const result = await userService.updateProfile(req.user!.sub, { first_name, last_name, email });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { current_password, new_password } = req.body;
    const result = await userService.changePassword(req.user!.sub, current_password, new_password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit } = req.query as { page: string; limit: string };
    const result = await userService.listUsers(Number(page), Number(limit));
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.getUserById(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const adminUpdateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role, is_active, first_name, last_name } = req.body;
    const result = await userService.adminUpdateUser(req.params.id, {
      role,
      is_active,
      first_name,
      last_name,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const deactivateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await userService.deactivateUser(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
