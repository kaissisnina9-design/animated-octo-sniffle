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

export async function updateProfile(
  userId: string,
  updates: { first_name?: string; last_name?: string; email?: string }
): Promise<ApiResponse<{ user: UserPublic }>> {
  if (updates.email) {
    const { rows: existing } = await db.query<User>(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [updates.email.toLowerCase(), userId]
    );
    if (existing.length > 0) {
      throw new ConflictError('An account with this email already exists');
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.first_name !== undefined) {
    fields.push(`first_name = $${paramIndex++}`);
    values.push(updates.first_name);
  }
  if (updates.last_name !== undefined) {
    fields.push(`last_name = $${paramIndex++}`);
    values.push(updates.last_name);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email.toLowerCase());
  }

  if (fields.length === 0) {
    const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) throw new NotFoundError('User');
    return { success: true, data: { user: toPublicUser(rows[0]) } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const { rows } = await db.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (rows.length === 0) throw new NotFoundError('User');

  return { success: true, data: { user: toPublicUser(rows[0]) }, message: 'Profile updated' };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ApiResponse> {
  const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [userId]);

  if (rows.length === 0) throw new NotFoundError('User');

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

  // Revoke all existing refresh tokens so other sessions are logged out
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

  return { success: true, message: 'Password changed successfully' };
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

  if (rows.length === 0) throw new NotFoundError('User');

  return { success: true, data: { user: toPublicUser(rows[0]) } };
}

export async function adminUpdateUser(
  id: string,
  updates: { role?: UserRole; is_active?: boolean; first_name?: string; last_name?: string }
): Promise<ApiResponse<{ user: UserPublic }>> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(updates.role);
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }
  if (updates.first_name !== undefined) {
    fields.push(`first_name = $${paramIndex++}`);
    values.push(updates.first_name);
  }
  if (updates.last_name !== undefined) {
    fields.push(`last_name = $${paramIndex++}`);
    values.push(updates.last_name);
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await db.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (rows.length === 0) throw new NotFoundError('User');

  return { success: true, data: { user: toPublicUser(rows[0]) }, message: 'User updated' };
}

export async function deactivateUser(id: string): Promise<ApiResponse> {
  const { rowCount } = await db.query(
    'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE',
    [id]
  );

  if (rowCount === 0) throw new NotFoundError('User');

  // Revoke all refresh tokens for the deactivated user
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);

  return { success: true, message: 'User deactivated' };
}
