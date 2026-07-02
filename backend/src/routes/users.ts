import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  updateProfileSchema,
  changePasswordSchema,
  adminUpdateUserSchema,
  paginationSchema,
  uuidParamSchema,
} from '../utils/validators';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Current user profile
router.get('/me', userController.getProfile);
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);
router.patch('/me/password', validate(changePasswordSchema), userController.changePassword);

// Admin / manager: list and view users
router.get(
  '/',
  authorize('admin', 'manager'),
  validate(paginationSchema, 'query'),
  userController.listUsers
);
router.get(
  '/:id',
  authorize('admin', 'manager'),
  validate(uuidParamSchema, 'params'),
  userController.getUserById
);

// Admin only: update or deactivate a user
router.patch(
  '/:id',
  authorize('admin'),
  validate(uuidParamSchema, 'params'),
  validate(adminUpdateUserSchema),
  userController.adminUpdateUser
);
router.delete(
  '/:id',
  authorize('admin'),
  validate(uuidParamSchema, 'params'),
  userController.deactivateUser
);

export default router;
