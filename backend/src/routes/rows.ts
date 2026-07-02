import { Router } from 'express';
import * as rowController from '../controllers/rowController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { rowSchema, paginationSchema } from '../utils/validators';
import { auditLog } from '../middleware/auditLog';
import { z } from 'zod';

const router = Router({ mergeParams: true });

const warehouseRowParamSchema = z.object({
  warehouseId: z.string().uuid(),
  id: z.string().uuid().optional(),
});

router.use(authenticate);

router.get('/', validate(paginationSchema, 'query'), rowController.list);
router.get(
  '/:id',
  validate(warehouseRowParamSchema, 'params'),
  rowController.get
);

router.post(
  '/',
  authorize('admin', 'manager', 'operator'),
  validate(rowSchema),
  auditLog('CREATE_ROW', 'row'),
  rowController.create
);

router.put(
  '/:id',
  authorize('admin', 'manager', 'operator'),
  validate(warehouseRowParamSchema, 'params'),
  validate(rowSchema.partial()),
  auditLog('UPDATE_ROW', 'row'),
  rowController.update
);

router.delete(
  '/:id',
  authorize('admin', 'manager'),
  validate(warehouseRowParamSchema, 'params'),
  auditLog('DELETE_ROW', 'row'),
  rowController.remove
);

export default router;
