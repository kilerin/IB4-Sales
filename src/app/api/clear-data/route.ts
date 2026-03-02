import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  try {
    await query('TRUNCATE deals, clients, uploads RESTART IDENTITY CASCADE');
    return NextResponse.json({ ok: true, message: 'Данные очищены' });
  } catch (e) {
    console.error('Clear data error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
