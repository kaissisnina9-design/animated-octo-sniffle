import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, first_name, last_name } = req.body;
    const result = await authService.register(email, password, first_name, last_name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refresh_token } = req.body;
    const result = await authService.refreshAccessToken(refresh_token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refresh_token } = req.body;
    const result = await authService.logout(refresh_token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.getProfile(req.user!.sub);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
