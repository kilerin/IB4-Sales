import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { calculateSetPnl } from '@/lib/set-pnl-calc';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const closedSetsRes = await query<{ closed_sets_count: number | null }>(
      'SELECT closed_sets_count FROM uploads WHERE id = $1',
      [uploadId]
    );
    const closedSetsCount = closedSetsRes[0]?.closed_sets_count ?? 999;

    const rows = await query<Record<string, unknown>>(
      `SELECT d.set_id, d.side, d.deal_date, d.vendor_supplier,
        d.amount_payed_usd, d.amount_received_usd,
        d.trade_contract_margin_usd, d.fx,
        d.le_we_pay, d.our_bank,
        c.type AS client_type
      FROM deals d
      LEFT JOIN clients c ON c.upload_id = d.upload_id
        AND UPPER(TRIM(c.company_name)) = UPPER(TRIM(d.vendor_supplier))
      WHERE d.upload_id = $1
        AND d.set_id IS NOT NULL
        AND d.set_id <= $2
        AND (d.status IS NULL OR LOWER(d.status) NOT LIKE '%cancelled%')`,
      [uploadId, closedSetsCount]
    );

    const result = calculateSetPnl(
      rows as import('@/lib/set-pnl-calc').SetPnlRow[],
      closedSetsCount
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error('Set P&L error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
