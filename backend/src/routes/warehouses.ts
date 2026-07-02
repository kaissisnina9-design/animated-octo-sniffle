import { Router } from 'express';
import * as warehouseController from '../controllers/warehouseController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { warehouseSchema, paginationSchema, uuidParamSchema } from '../utils/validators';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate);

router.get('/', validate(paginationSchema, 'query'), warehouseController.list);
router.get('/:id', validate(uuidParamSchema, 'params'), warehouseController.get);

router.post(
  '/',
  authorize('admin', 'manager'),
  validate(warehouseSchema),
  auditLog('CREATE_WAREHOUSE', 'warehouse'),
  warehouseController.create
);

router.put(
  '/:id',
  authorize('admin', 'manager'),
  validate(uuidParamSchema, 'params'),
  validate(warehouseSchema.partial()),
  auditLog('UPDATE_WAREHOUSE', 'warehouse'),
  warehouseController.update
);

router.delete(
  '/:id',
  authorize('admin'),
  validate(uuidParamSchema, 'params'),
  auditLog('DELETE_WAREHOUSE', 'warehouse'),
  warehouseController.remove
);

export default router;
