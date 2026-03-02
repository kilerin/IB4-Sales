import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<{ date: string; manager: string; margin: string }>(`
      SELECT 
        deal_date::text AS date,
        COALESCE(manager, 'Unassigned') AS manager,
        COALESCE(SUM(trade_contract_margin_usd), 0)::text AS margin
      FROM deals
      WHERE upload_id = $1
        AND deal_date IS NOT NULL
        AND deal_date >= (SELECT DATE_TRUNC('year', CURRENT_DATE)::date)
      GROUP BY deal_date, manager
      ORDER BY date, manager
    `, [uploadId]);

    const ytd = new Map<string, number>();
    const lastDate = rows.length ? rows[rows.length - 1].date : null;
    const lastDay = new Map<string, number>();

    for (const r of rows) {
      const m = parseFloat(r.margin);
      ytd.set(r.manager, (ytd.get(r.manager) ?? 0) + m);
      if (r.date === lastDate) {
        lastDay.set(r.manager, (lastDay.get(r.manager) ?? 0) + m);
      }
    }

    const data = Array.from(ytd.entries())
      .map(([salesman, marginYtd]) => ({
        salesman,
        marginYtd,
        lastDayMargin: lastDay.get(salesman) ?? 0,
      }))
      .sort((a, b) => b.marginYtd - a.marginYtd);

    return NextResponse.json(data);
  } catch (e) {
    console.error('Salesmen margin YTD error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
