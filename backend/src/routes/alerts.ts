import { Router } from 'express';
import * as alertController from '../controllers/alertController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationSchema, uuidParamSchema } from '../utils/validators';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);

router.get('/', validate(paginationSchema, 'query'), alertController.list);
router.get('/:id', validate(uuidParamSchema, 'params'), alertController.get);

router.post(
  '/:id/resolve',
  authorize('admin', 'manager', 'operator'),
  validate(uuidParamSchema, 'params'),
  auditLog('RESOLVE_ALERT', 'alert'),
  alertController.resolve
);

export default router;
