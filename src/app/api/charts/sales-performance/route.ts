import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface SalesPerDayRow {
  date: string;
  manager: string | null;
  deals_count: string;
  amount_payed: string;
  amount_received: string;
  margin: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<SalesPerDayRow>(`
      SELECT 
        deal_date::text AS date,
        COALESCE(manager, 'Unassigned') AS manager,
        COUNT(*)::text AS deals_count,
        COALESCE(SUM(amount_payed_usd), 0)::text AS amount_payed,
        COALESCE(SUM(amount_received_usd), 0)::text AS amount_received,
        COALESCE(SUM(trade_contract_margin_usd), 0)::text AS margin
      FROM deals
      WHERE upload_id = $1
        AND deal_date IS NOT NULL
      GROUP BY deal_date, manager
      ORDER BY deal_date, manager
    `, [uploadId]);

    const byManager = new Map<string, { date: string; dealsCount: number; amountPayed: number; amountReceived: number; margin: number }[]>();
    for (const r of rows) {
      const m = r.manager || 'Unassigned';
      if (!byManager.has(m)) byManager.set(m, []);
      byManager.get(m)!.push({
        date: r.date,
        dealsCount: parseInt(r.deals_count, 10),
        amountPayed: parseFloat(r.amount_payed),
        amountReceived: parseFloat(r.amount_received),
        margin: parseFloat(r.margin),
      });
    }

    const managers = Array.from(byManager.keys()).sort();
    const dates = [...new Set(rows.map((r) => r.date))].sort();

    return NextResponse.json({
      managers,
      dates,
      byManager: Object.fromEntries(byManager),
      raw: rows.map((r) => ({
        date: r.date,
        manager: r.manager || 'Unassigned',
        dealsCount: parseInt(r.deals_count, 10),
        amountPayed: parseFloat(r.amount_payed),
        amountReceived: parseFloat(r.amount_received),
        margin: parseFloat(r.margin),
      })),
    });
  } catch (e) {
    console.error('Sales performance error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
