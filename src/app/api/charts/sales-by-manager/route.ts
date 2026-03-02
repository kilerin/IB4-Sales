import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  const manager = searchParams.get('manager');
  if (!uploadId || !manager) {
    return NextResponse.json({ error: 'uploadId and manager required' }, { status: 400 });
  }

  try {
    const rows = await query<{ date: string; deals_count: string; amount_payed: string; amount_received: string; margin: string }>(`
      SELECT 
        deal_date::text AS date,
        COUNT(*)::text AS deals_count,
        COALESCE(SUM(amount_payed_usd), 0)::text AS amount_payed,
        COALESCE(SUM(amount_received_usd), 0)::text AS amount_received,
        COALESCE(SUM(trade_contract_margin_usd), 0)::text AS margin
      FROM deals
      WHERE upload_id = $1
        AND (manager = $2 OR (manager IS NULL AND $2 = 'Unassigned'))
        AND deal_date IS NOT NULL
      GROUP BY deal_date
      ORDER BY deal_date
    `, [uploadId, manager]);

    return NextResponse.json(
      rows.map((r) => ({
        date: r.date,
        dealsCount: parseInt(r.deals_count, 10),
        amountPayed: parseFloat(r.amount_payed),
        amountReceived: parseFloat(r.amount_received),
        margin: parseFloat(r.margin),
      }))
    );
  } catch (e) {
    console.error('Sales by manager error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
