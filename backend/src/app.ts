import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import warehouseRoutes from './routes/warehouses';
import rowRoutes from './routes/rows';
import alertRoutes from './routes/alerts';

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Compression
  app.use(compression());

  // Logging
  if (config.NODE_ENV !== 'test') {
    app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limiting
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please try again later.' },
    })
  );

  // Health check
  app.get('/health', async (_req: Request, res: Response) => {
    const { db } = await import('./config/database');
    const dbOk = await db.healthCheck();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'healthy' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  const API_PREFIX = '/api/v1';
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/warehouses`, warehouseRoutes);
  app.use(`${API_PREFIX}/warehouses/:warehouseId/rows`, rowRoutes);
  app.use(`${API_PREFIX}/alerts`, alertRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
