import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type Period = 'lastDay' | 'month' | 'quarter' | 'ytd';

type GroupData = {
  volume: number;
  fundingCost: number;
  fx: number;
  deals: Array<{
    group: string | null;
    vendor_supplier: string;
    deal_date: string | null;
    volume: number;
    fundingCost: number;
    pctCost: number | null;
    pctTotalCost: number | null;
    fx: number | null;
  }>;
};

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
      return NextResponse.json({ sides: [] });
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

    const rows = await query<Record<string, unknown>>(
      `SELECT d.id, d.side, d.deal_date, d.vendor_supplier,
        d.amount_received_usd,
        d.amount_payed_usd,
        d.trade_contract_margin_usd,
        d.fx,
        c."group",
        c.type
      FROM deals d
      LEFT JOIN clients c ON c.upload_id = d.upload_id
        AND UPPER(TRIM(c.company_name)) = UPPER(TRIM(d.vendor_supplier))
      WHERE d.upload_id = $1
        AND (d.status IS NULL OR LOWER(d.status) NOT LIKE '%cancelled%')
        AND d.deal_date >= $2::date
        AND d.deal_date <= $3::date
        AND UPPER(TRIM(d.side)) IN ('EXPORT', 'FOREX', 'AGENT')`,
      [uploadId, dateFrom, dateTo]
    );

    const sideData = new Map<string, Map<string, Map<string, GroupData>>>();

    for (const r of rows) {
      const side = String(r.side ?? '').toUpperCase().trim();
      if (!['EXPORT', 'FOREX', 'AGENT'].includes(side)) continue;

      const type = r.type != null ? String(r.type).trim() || null : null; // type from clients join
      const typeKey = type ?? '—';
      const received = Number(r.amount_received_usd) || 0;
      const payed = Number(r.amount_payed_usd) || 0;
      const margin = Number(r.trade_contract_margin_usd) || 0;
      const dealDate = r.deal_date ? String(r.deal_date).slice(0, 10) : null;
      const vendorSupplier = String(r.vendor_supplier ?? '').trim() || '—';
      const group = r.group != null ? String(r.group).trim() || null : null;
      const groupKey = group ?? '—';
      const fx = r.fx != null ? Number(r.fx) : null;

      const volume = received !== 0 ? received : payed;
      const fundingCost = margin;
      const fxVal = fx ?? 0;
      const pctCost = volume !== 0 ? (fundingCost / volume) * 100 : null;
      const pctTotalCost = volume !== 0 ? ((fundingCost + fxVal) / volume) * 100 : null;

      const sideMap = sideData.get(side) ?? new Map<string, Map<string, GroupData>>();
      const typeMap = sideMap.get(typeKey) ?? new Map<string, GroupData>();
      const groupMap = typeMap.get(groupKey) ?? { volume: 0, fundingCost: 0, fx: 0, deals: [] };
      groupMap.volume += volume;
      groupMap.fundingCost += fundingCost;
      groupMap.fx += fx ?? 0;
      groupMap.deals.push({
        group,
        vendor_supplier: vendorSupplier,
        deal_date: dealDate,
        volume: Math.round(volume * 100) / 100,
        fundingCost: Math.round(fundingCost * 100) / 100,
        pctCost: pctCost != null ? Math.round(pctCost * 100) / 100 : null,
        pctTotalCost: pctTotalCost != null ? Math.round(pctTotalCost * 100) / 100 : null,
        fx: fx != null ? Math.round(fx * 100) / 100 : null,
      });
      typeMap.set(groupKey, groupMap);
      sideMap.set(typeKey, typeMap);
      sideData.set(side, sideMap);
    }

    const result = Array.from(sideData.entries()).map(([side, typeMap]) => {
      let sideVolume = 0;
      let sideFundingCost = 0;
      let sideFx = 0;
      const types = Array.from(typeMap.entries()).map(([typeKey, groupMap]) => {
        let typeVolume = 0;
        let typeFundingCost = 0;
        let typeFx = 0;
        const groups = Array.from(groupMap.entries()).map(([groupKey, g]) => {
          const pctCost = g.volume !== 0 ? (g.fundingCost / g.volume) * 100 : null;
          const pctTotalCost = g.volume !== 0 ? ((g.fundingCost + g.fx) / g.volume) * 100 : null;
          typeVolume += g.volume;
          typeFundingCost += g.fundingCost;
          typeFx += g.fx;
          sideVolume += g.volume;
          sideFundingCost += g.fundingCost;
          sideFx += g.fx;
          return {
            group: groupKey === '—' ? null : groupKey,
            volume: Math.round(g.volume * 100) / 100,
            fundingCost: Math.round(g.fundingCost * 100) / 100,
            pctCost: pctCost != null ? Math.round(pctCost * 100) / 100 : null,
            pctTotalCost: pctTotalCost != null ? Math.round(pctTotalCost * 100) / 100 : null,
            fx: Math.round(g.fx * 100) / 100,
            deals: g.deals.sort((a, b) => (a.deal_date ?? '').localeCompare(b.deal_date ?? '')),
          };
        });
        groups.sort((a, b) => (a.group ?? '—').localeCompare(b.group ?? '—'));
        const pctCost = typeVolume !== 0 ? (typeFundingCost / typeVolume) * 100 : null;
        const pctTotalCost = typeVolume !== 0 ? ((typeFundingCost + typeFx) / typeVolume) * 100 : null;
        return {
          type: typeKey === '—' ? null : typeKey,
          volume: Math.round(typeVolume * 100) / 100,
          fundingCost: Math.round(typeFundingCost * 100) / 100,
          pctCost: pctCost != null ? Math.round(pctCost * 100) / 100 : null,
          pctTotalCost: pctTotalCost != null ? Math.round(pctTotalCost * 100) / 100 : null,
          fx: Math.round(typeFx * 100) / 100,
          groups,
        };
      });
      types.sort((a, b) => (a.type ?? '—').localeCompare(b.type ?? '—'));
      const pctCost = sideVolume !== 0 ? (sideFundingCost / sideVolume) * 100 : null;
      const pctTotalCost = sideVolume !== 0 ? ((sideFundingCost + sideFx) / sideVolume) * 100 : null;
      return {
        side,
        volume: Math.round(sideVolume * 100) / 100,
        fundingCost: Math.round(sideFundingCost * 100) / 100,
        infrastructureCost: 0,
        pctCost: pctCost != null ? Math.round(pctCost * 100) / 100 : null,
        pctTotalCost: pctTotalCost != null ? Math.round(pctTotalCost * 100) / 100 : null,
        fx: Math.round(sideFx * 100) / 100,
        types,
      };
    });

    result.sort((a, b) => {
      const order = ['EXPORT', 'AGENT', 'FOREX'];
      return order.indexOf(a.side) - order.indexOf(b.side);
    });

    return NextResponse.json({ sides: result });
  } catch (e) {
    console.error('Side profit YTD error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
