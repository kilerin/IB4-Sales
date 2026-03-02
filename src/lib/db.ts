import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/ib4sales',
  max: 10,
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return (res.rows || []) as T[];
  } finally {
    client.release();
  }
}

export { pool };
