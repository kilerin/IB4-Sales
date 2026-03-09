import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS type VARCHAR(100)`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS parent_group VARCHAR(100)`);
    await query(`ALTER TABLE deals DROP COLUMN IF EXISTS type`);
    return NextResponse.json({ ok: true, message: 'Migration applied' });
  } catch (e) {
    console.error('Migration error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
