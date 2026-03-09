import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export interface DailySnapshotRow {
  salesman: string;
  group: string | null;
  vendor_supplier: string | null;
  deals_count: string;
  amount_payed: string;
  amount_received: string;
  margin: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  const date = searchParams.get('date');
  const side = (searchParams.get('side') || 'IMPORT').toUpperCase();
  if (!uploadId || !date) {
    return NextResponse.json({ error: 'uploadId and date required' }, { status: 400 });
  }

  try {
    const rows = await query<DailySnapshotRow>(`
      SELECT 
        COALESCE(d.manager, 'Unassigned') AS salesman,
        CASE
          WHEN c.parent_group IS NOT NULL AND c."group" IS NOT NULL AND UPPER(TRIM(COALESCE(c.company_name,''))) = UPPER(TRIM(COALESCE(c."group",''))) THEN c.parent_group
          WHEN UPPER(TRIM(COALESCE(d.vendor_supplier,''))) = 'TAIGA' AND UPPER(TRIM(COALESCE(c.company_name,''))) = UPPER(TRIM(COALESCE(c."group",''))) THEN 'EVRAZ'
          ELSE c."group"
        END AS "group",
        d.vendor_supplier,
        COUNT(*)::text AS deals_count,
        COALESCE(SUM(d.amount_payed_usd), 0)::text AS amount_payed,
        COALESCE(SUM(d.amount_received_usd), 0)::text AS amount_received,
        COALESCE(SUM(d.trade_contract_margin_usd), 0)::text AS margin
      FROM deals d
      LEFT JOIN clients c ON c.upload_id = d.upload_id
        AND UPPER(TRIM(c.company_name)) = UPPER(TRIM(d.vendor_supplier))
      WHERE d.upload_id = $1 AND d.deal_date = $2::date AND UPPER(TRIM(d.side)) = $3
      GROUP BY d.manager, d.vendor_supplier, c."group", c.parent_group, c.company_name
      ORDER BY salesman, "group", vendor_supplier
    `, [uploadId, date, side]);

    const data = rows.map((r) => {
      const payed = parseFloat(r.amount_payed);
      const margin = parseFloat(r.margin);
      const pct = payed !== 0 ? (margin / Math.abs(payed)) * 100 : null;
      return {
        salesman: r.salesman,
        group: r.group || '—',
        vendor: r.vendor_supplier || '—',
        dealsCount: parseInt(r.deals_count, 10),
        amountPayed: payed,
        amountReceived: parseFloat(r.amount_received),
        margin,
        pct: pct != null ? pct : null,
      };
    });

    return NextResponse.json(data);
  } catch (e) {
    console.error('Daily snapshot table error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
