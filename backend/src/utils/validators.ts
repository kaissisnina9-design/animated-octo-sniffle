import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

export const warehouseSchema = z.object({
  name: z.string().min(1).max(255),
  location: z.string().max(500).optional(),
  manager_id: z.string().uuid().optional(),
});

export const rowSchema = z.object({
  row_label: z.string().min(1).max(100),
  capacity: z.number().int().nonnegative(),
  current_count: z.number().int().nonnegative().optional().default(0),
  status: z.enum(['active', 'inactive', 'maintenance']).optional().default('active'),
  notes: z.string().optional(),
});

export const alertResolveSchema = z.object({
  resolution_note: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const updateProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

// Alias for backward compatibility
export const updatePasswordSchema = changePasswordSchema;

export const adminUpdateUserSchema = z.object({
  role: z.enum(['admin', 'manager', 'operator', 'viewer']).optional(),
  is_active: z.boolean().optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
});

export const auditLogQuerySchema = paginationSchema.extend({
  user_id: z.string().uuid('Invalid user_id format').optional(),
  action: z.string().min(1).max(255).optional(),
  entity_type: z.string().min(1).max(100).optional(),
  entity_id: z.string().uuid('Invalid entity_id format').optional(),
  from: z.string().datetime({ offset: true, message: 'from must be an ISO 8601 datetime' }).optional(),
  to: z.string().datetime({ offset: true, message: 'to must be an ISO 8601 datetime' }).optional(),
});
