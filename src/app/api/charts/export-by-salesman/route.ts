import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type Period = 'lastDay' | 'month' | 'quarter' | 'ytd';

function getDateRangeFromAnchor(anchorDate: string, period: Period): { dateFrom: string; dateTo: string } | null {
  const [y, m, d] = anchorDate.split('-').map(Number);
  const month0 = (m ?? 1) - 1;
  const year = y ?? new Date().getFullYear();

  if (period === 'month') {
    const lastDay = new Date(year, month0 + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      dateFrom: `${year}-${pad(month0 + 1)}-01`,
      dateTo: `${year}-${pad(month0 + 1)}-${pad(lastDay.getDate())}`,
    };
  }
  if (period === 'quarter') {
    const q = Math.floor(month0 / 3) + 1;
    const firstMonth = (q - 1) * 3;
    const lastDay = new Date(year, firstMonth + 3, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      dateFrom: `${year}-${pad(firstMonth + 1)}-01`,
      dateTo: `${year}-${pad(firstMonth + 3)}-${pad(lastDay.getDate())}`,
    };
  }
  if (period === 'ytd') {
    return {
      dateFrom: `${year}-01-01`,
      dateTo: anchorDate,
    };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  const period = (searchParams.get('period') || 'ytd') as Period;
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const maxDateRows = await query<{ max_date: string | null }>(
      `SELECT TO_CHAR(MAX(deal_date), 'YYYY-MM-DD') AS max_date
       FROM deals WHERE upload_id = $1 AND deal_date IS NOT NULL
         AND (status IS NULL OR LOWER(status) NOT LIKE '%cancelled%')`,
      [uploadId]
    );
    const maxDate = maxDateRows[0]?.max_date;

    if (!maxDate) {
      return NextResponse.json({ rows: [], totalExport: 0 });
    }

    let dateFrom: string;
    let dateTo: string;

    if (period === 'lastDay') {
      dateFrom = maxDate;
      dateTo = maxDate;
    } else {
      const range = getDateRangeFromAnchor(maxDate, period);
      if (!range) {
        return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
      }
      dateFrom = range.dateFrom;
      dateTo = range.dateTo;
    }

    const rows = await query<{ manager: string | null; volume: number }>(
      `SELECT COALESCE(d.manager, '—') AS manager,
        SUM(CASE WHEN COALESCE(d.amount_received_usd, 0) != 0 THEN d.amount_received_usd ELSE COALESCE(d.amount_payed_usd, 0) END) AS volume
       FROM deals d
       WHERE d.upload_id = $1
         AND (d.status IS NULL OR LOWER(d.status) NOT LIKE '%cancelled%')
         AND d.deal_date >= $2::date
         AND d.deal_date <= $3::date
         AND UPPER(TRIM(d.side)) IN ('EXPORT', 'AGENT', 'FOREX')
       GROUP BY d.manager
       ORDER BY volume DESC NULLS LAST`,
      [uploadId, dateFrom, dateTo]
    );

    const totalExport = rows.reduce((s, r) => s + Number(r.volume ?? 0), 0);
    const result = rows.map((r) => {
      const vol = Number(r.volume ?? 0);
      return {
        salesman: r.manager ?? '—',
        exportVolume: Math.round(vol * 100) / 100,
        pctOfTotal: totalExport > 0 ? Math.round((vol / totalExport) * 10000) / 100 : 0,
      };
    });

    return NextResponse.json({ rows: result, totalExport: Math.round(totalExport * 100) / 100 });
  } catch (e) {
    console.error('Export by salesman error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
