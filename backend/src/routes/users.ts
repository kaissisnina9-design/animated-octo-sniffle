import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  paginationSchema,
  uuidParamSchema,
  updateProfileSchema,
  updatePasswordSchema,
  adminUpdateUserSchema,
} from '../utils/validators';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);

// Self-service routes (any authenticated user)
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);
router.patch('/me/password', validate(updatePasswordSchema), userController.updatePassword);

// Admin/manager read routes
router.get(
  '/',
  authorize('admin', 'manager'),
  validate(paginationSchema, 'query'),
  userController.list
);

router.get(
  '/:id',
  authorize('admin', 'manager'),
  validate(uuidParamSchema, 'params'),
  userController.get
);

// Admin-only write routes
router.patch(
  '/:id',
  authorize('admin'),
  validate(uuidParamSchema, 'params'),
  validate(adminUpdateUserSchema),
  auditLog('UPDATE_USER', 'user'),
  userController.adminUpdate
);

router.delete(
  '/:id',
  authorize('admin'),
  validate(uuidParamSchema, 'params'),
  auditLog('DEACTIVATE_USER', 'user'),
  userController.deactivate
);

export default router;
