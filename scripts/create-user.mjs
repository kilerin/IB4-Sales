/**
 * Создать первого пользователя.
 * Usage: node --env-file=.env scripts/create-user.mjs <login> <password>
 * Or: node scripts/create-user.mjs <login> <password>
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const [login, password] = process.argv.slice(2);
if (!login || !password) {
  console.error('Usage: node scripts/create-user.mjs <login> <password>');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Пароль должен быть минимум 6 символов');
  process.exit(1);
}

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
  const email = login.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash',
    [email, hash]
  );
  console.log(`Пользователь ${email} создан (или пароль обновлён)`);
} catch (e) {
  console.error('Ошибка:', e);
  process.exit(1);
} finally {
  await pool.end();
}
