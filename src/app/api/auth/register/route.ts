import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { login, password } = body;
    if (!login || typeof login !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: 'login и password обязательны' }, { status: 400 });
    }
    const email = login.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Логин не может быть пустым' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Пароль минимум 6 символов' }, { status: 400 });

    const existing = await query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Пользователь с таким логином уже существует' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      [email, password_hash]
    );
    return NextResponse.json({ ok: true, message: 'Пользователь создан' });
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
