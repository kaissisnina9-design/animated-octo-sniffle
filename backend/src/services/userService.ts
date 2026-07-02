import bcrypt from 'bcryptjs';
import db from '../config/database';
import { User, UserPublic, UserRole, PaginatedResult, ApiResponse } from '../types';
import { NotFoundError, ConflictError, UnauthorizedError } from '../middleware/errorHandler';

const BCRYPT_ROUNDS = 12;

function toPublicUser(user: User): UserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export async function listUsers(
  page: number,
  limit: number
): Promise<ApiResponse<PaginatedResult<UserPublic>>> {
  const offset = (page - 1) * limit;

  const [{ rows: countRows }, { rows: data }] = await Promise.all([
    db.query<{ count: string }>('SELECT COUNT(*) FROM users'),
    db.query<User>(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    ),
  ]);

  const total = parseInt(countRows[0].count, 10);

  return {
    success: true,
    data: {
      data: data.map(toPublicUser),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(id: string): Promise<ApiResponse<{ user: UserPublic }>> {
  const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);

  if (rows.length === 0) {
    throw new NotFoundError('User');
  }

  return { success: true, data: { user: toPublicUser(rows[0]) } };
}

export async function updateMyProfile(
  userId: string,
  updates: Partial<Pick<User, 'first_name' | 'last_name'>>
): Promise<ApiResponse<{ user: UserPublic }>> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.first_name !== undefined) {
    fields.push(`first_name = $${idx++}`);
    values.push(updates.first_name);
  }
  if (updates.last_name !== undefined) {
    fields.push(`last_name = $${idx++}`);
    values.push(updates.last_name);
  }

  if (fields.length === 0) {
    return getUserById(userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const { rows } = await db.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    throw new NotFoundError('User');
  }

  return { success: true, data: { user: toPublicUser(rows[0]) } };
}

export async function updateMyPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ApiResponse> {
  const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [userId]);

  if (rows.length === 0) {
    throw new NotFoundError('User');
  }

  const user = rows[0];
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.query(
    'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
    [hashed, userId]
  );

  // Revoke all refresh tokens so existing sessions are invalidated
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

  return { success: true, message: 'Password updated successfully' };
}

export async function adminUpdateUser(
  id: string,
  updates: Partial<Pick<User, 'first_name' | 'last_name' | 'is_active'> & { role: UserRole }>
): Promise<ApiResponse<{ user: UserPublic }>> {
  const { rows: existing } = await db.query<User>('SELECT id FROM users WHERE id = $1', [id]);

  if (existing.length === 0) {
    throw new NotFoundError('User');
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const allowedFields = ['first_name', 'last_name', 'role', 'is_active'] as const;
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx++}`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await db.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  return { success: true, data: { user: toPublicUser(rows[0]) } };
}

export async function deactivateUser(id: string, requesterId: string): Promise<ApiResponse> {
  if (id === requesterId) {
    throw new ConflictError('Cannot deactivate your own account');
  }

  const { rowCount } = await db.query(
    'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
    [id]
  );

  if (rowCount === 0) {
    throw new NotFoundError('User');
  }

  // Revoke all refresh tokens so the deactivated user is logged out immediately
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);

  return { success: true, message: 'User deactivated' };
}
