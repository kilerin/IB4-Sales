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
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(100)`);
  console.log('Added type column to clients');
  await pool.query(`ALTER TABLE deals DROP COLUMN IF EXISTS type`);
  console.log('Dropped type column from deals (if existed)');
  console.log('Migration done.');
} catch (e) {
  console.error('Migration error:', e);
  process.exit(1);
} finally {
  await pool.end();
}
