import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import db from '../config/database';
import { User, UserPublic, ApiResponse } from '../types';
import { JwtPayload } from '../middleware/auth';
import { ConflictError, UnauthorizedError, NotFoundError } from '../middleware/errorHandler';

const BCRYPT_ROUNDS = 12;

function toPublicUser(user: User): UserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

function generateTokens(user: User) {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<ApiResponse<{ user: UserPublic; access_token: string; refresh_token: string }>> {
  const existing = await db.query<User>(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('An account with this email already exists');
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { rows } = await db.query<User>(
    `INSERT INTO users (email, password, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email.toLowerCase(), hashed, firstName, lastName]
  );

  const user = rows[0];
  const { accessToken, refreshToken } = generateTokens(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  return {
    success: true,
    data: {
      user: toPublicUser(user),
      access_token: accessToken,
      refresh_token: refreshToken,
    },
    message: 'Account created successfully',
  };
}

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<{ user: UserPublic; access_token: string; refresh_token: string }>> {
  const { rows } = await db.query<User>(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
    [email.toLowerCase()]
  );

  const user = rows[0];
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const { accessToken, refreshToken } = generateTokens(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  return {
    success: true,
    data: {
      user: toPublicUser(user),
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<ApiResponse<{ access_token: string }>> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const { rows: tokenRows } = await db.query(
    'SELECT id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [refreshToken]
  );

  if (tokenRows.length === 0) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  const { rows } = await db.query<User>(
    'SELECT * FROM users WHERE id = $1 AND is_active = TRUE',
    [payload.sub]
  );

  if (rows.length === 0) {
    throw new NotFoundError('User');
  }

  const user = rows[0];
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'] }
  );

  return {
    success: true,
    data: { access_token: accessToken },
  };
}

export async function logout(refreshToken: string): Promise<ApiResponse> {
  await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  return { success: true, message: 'Logged out successfully' };
}

export async function getProfile(userId: string): Promise<ApiResponse<{ user: UserPublic }>> {
  const { rows } = await db.query<User>(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('User');
  }

  return {
    success: true,
    data: { user: toPublicUser(rows[0]) },
  };
}
