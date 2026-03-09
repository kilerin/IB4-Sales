import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** Debug: показать deal_date по сетам для проверки парсинга дат */
export async function GET(request: NextRequest) {
  const uploadId = request.nextUrl.searchParams.get('uploadId');
  if (!uploadId) return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  try {
    const rows = await query<{ set_id: number; deal_date: string | null }>(
      `SELECT set_id, deal_date::text FROM deals
       WHERE upload_id = $1 AND set_id IS NOT NULL
       ORDER BY set_id, deal_date LIMIT 50`,
      [uploadId]
    );
    return NextResponse.json({ sample: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
