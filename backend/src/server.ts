import { createApp } from './app';
import { config } from './config/env';
import db from './config/database';

const app = createApp();

async function start() {
  try {
    const dbOk = await db.healthCheck();
    if (!dbOk) {
      throw new Error('Cannot connect to the database');
    }

    const server = app.listen(config.PORT, () => {
      console.log(
        `🚀 ${config.APP_NAME} API running on port ${config.PORT} [${config.NODE_ENV}]`
      );
    });

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received — shutting down gracefully…`);
      server.close(async () => {
        await db.end();
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
