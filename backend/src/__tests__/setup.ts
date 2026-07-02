// Set required environment variables for tests before any module is loaded
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'rowsentry_test';
process.env.DB_USER = 'rowsentry_user';
process.env.DB_PASSWORD = 'testpassword';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
