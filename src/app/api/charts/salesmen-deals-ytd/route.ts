import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const rows = await query<{ manager: string; deals_count: string }>(`
      SELECT 
        COALESCE(manager, 'Unassigned') AS manager,
        COUNT(*)::text AS deals_count
      FROM deals
      WHERE upload_id = $1
        AND deal_date IS NOT NULL
        AND deal_date >= (SELECT DATE_TRUNC('year', CURRENT_DATE)::date)
      GROUP BY manager
      ORDER BY COUNT(*) DESC
    `, [uploadId]);

    const data = rows.map((r) => ({
      salesman: r.manager,
      dealsCount: parseInt(r.deals_count, 10),
    }));

    return NextResponse.json(data);
  } catch (e) {
    console.error('Salesmen deals YTD error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
