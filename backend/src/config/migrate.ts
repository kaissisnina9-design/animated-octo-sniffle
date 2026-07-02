import { Pool } from 'pg';
import { config } from './env';

const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
});

const migrations: { name: string; sql: string }[] = [
  {
    name: '001_initial_schema',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email       VARCHAR(255) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        first_name  VARCHAR(100) NOT NULL,
        last_name   VARCHAR(100) NOT NULL,
        role        VARCHAR(50)  NOT NULL DEFAULT 'viewer',
        is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       TEXT NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(255) NOT NULL,
        location    VARCHAR(500),
        manager_id  UUID REFERENCES users(id) ON DELETE SET NULL,
        is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rows (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        row_label     VARCHAR(100) NOT NULL,
        capacity      INTEGER NOT NULL DEFAULT 0,
        current_count INTEGER NOT NULL DEFAULT 0,
        status        VARCHAR(50) NOT NULL DEFAULT 'active',
        notes         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(warehouse_id, row_label)
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        row_id        UUID NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
        warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
        alert_type    VARCHAR(100) NOT NULL,
        severity      VARCHAR(50)  NOT NULL DEFAULT 'medium',
        message       TEXT NOT NULL,
        is_resolved   BOOLEAN     NOT NULL DEFAULT FALSE,
        resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
        resolved_at   TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100),
        entity_id   UUID,
        details     JSONB,
        ip_address  INET,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_rows_warehouse_id ON rows(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_row_id ON alerts(row_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts(is_resolved);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    `,
  },
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const migration of migrations) {
      const { rows } = await client.query(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [migration.name]
      );

      if (rows.length === 0) {
        console.log(`Applying migration: ${migration.name}`);
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [migration.name]
          );
          await client.query('COMMIT');
          console.log(`✅ Migration applied: ${migration.name}`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      } else {
        console.log(`⏭  Migration already applied: ${migration.name}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log('All migrations complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
