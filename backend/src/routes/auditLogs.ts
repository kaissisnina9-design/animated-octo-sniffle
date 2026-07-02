import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLogQuerySchema } from '../utils/validators';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('admin'),
  validate(auditLogQuerySchema, 'query'),
  auditLogController.list
);

export default router;
