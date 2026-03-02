import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface MarginBySideRow {
  side: string;
  positive: string;
  negative: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<MarginBySideRow>(`
      SELECT 
        COALESCE(TRIM(side), 'Unassigned') AS side,
        COALESCE(SUM(CASE WHEN trade_contract_margin_usd > 0 THEN trade_contract_margin_usd ELSE 0 END), 0)::text AS positive,
        COALESCE(SUM(CASE WHEN trade_contract_margin_usd < 0 THEN trade_contract_margin_usd ELSE 0 END), 0)::text AS negative
      FROM deals
      WHERE upload_id = $1
        AND (status IS NULL OR LOWER(status) NOT LIKE '%cancelled%')
      GROUP BY side
      ORDER BY CASE UPPER(TRIM(COALESCE(side, '')))
        WHEN 'IMPORT' THEN 1
        WHEN 'EXPORT' THEN 2
        WHEN 'AGENT' THEN 3
        WHEN 'LOAN' THEN 4
        WHEN 'FOREX' THEN 5
        WHEN 'POSITION' THEN 6
        ELSE 7
      END, side
    `, [uploadId]);

    return NextResponse.json(
      rows.map((r) => ({
        side: r.side,
        positive: parseFloat(r.positive),
        negative: parseFloat(r.negative),
      }))
    );
  } catch (e) {
    console.error('Margin by side error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
