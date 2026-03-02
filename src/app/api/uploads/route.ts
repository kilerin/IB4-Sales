import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface UploadRecord {
  id: number;
  filename: string;
  uploaded_at: string;
  file_size: number | null;
  closed_sets_count: number | null;
}

export async function GET() {
  try {
    const rows = await query<UploadRecord>(
      'SELECT id, filename, uploaded_at, file_size, closed_sets_count FROM uploads ORDER BY uploaded_at DESC'
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error('Uploads list error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
