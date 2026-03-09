/**
 * Run migration: add type to clients, remove from deals.
 * Usage: node --env-file=.env scripts/migrate.mjs
 * Or: DATABASE_URL=... node scripts/migrate.mjs
 */
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/ib4sales',
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Users table ready');
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(100)`);
  console.log('Added type column to clients');
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_group VARCHAR(100)`);
  console.log('Added parent_group column to clients');
  await pool.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS le_we_pay VARCHAR(50)`);
  await pool.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS our_bank VARCHAR(50)`);
  console.log('Added le_we_pay, our_bank columns to deals');
  await pool.query(`ALTER TABLE deals DROP COLUMN IF EXISTS type`);
  console.log('Dropped type column from deals (if existed)');
  console.log('Migration done.');
} catch (e) {
  console.error('Migration error:', e);
  process.exit(1);
} finally {
  await pool.end();
}
