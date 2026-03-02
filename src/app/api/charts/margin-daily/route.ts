import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<{ date: string; total: string }>(`
      SELECT 
        deal_date::text AS date,
        COALESCE(SUM(trade_contract_margin_usd), 0)::text AS total
      FROM deals
      WHERE upload_id = $1
        AND side = 'IMPORT'
        AND (status IS NULL OR LOWER(status) NOT LIKE '%cancelled%')
        AND deal_date >= (SELECT DATE_TRUNC('year', CURRENT_DATE)::date)
      GROUP BY deal_date
      ORDER BY deal_date
    `, [uploadId]);

    return NextResponse.json(rows.map((r) => ({ date: r.date, total: parseFloat(r.total) })));
  } catch (e) {
    console.error('Margin daily chart error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
