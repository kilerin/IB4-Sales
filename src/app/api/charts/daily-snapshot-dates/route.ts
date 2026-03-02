import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<{ date: string }>(`
      SELECT DISTINCT TO_CHAR(deal_date, 'YYYY-MM-DD') AS date
      FROM deals
      WHERE upload_id = $1
        AND deal_date IS NOT NULL
      ORDER BY date
    `, [uploadId]);

    return NextResponse.json(rows.map((r) => r.date));
  } catch (e) {
    console.error('Daily snapshot dates error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
