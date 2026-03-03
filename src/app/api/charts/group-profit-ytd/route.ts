import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  const month = searchParams.get('month'); // YYYY-MM or empty for full period
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const dateRangeRows = await query<{ min_date: string | null; max_date: string | null }>(
      `SELECT TO_CHAR(MIN(deal_date), 'YYYY-MM-DD') AS min_date,
              TO_CHAR(MAX(deal_date), 'YYYY-MM-DD') AS max_date
       FROM deals WHERE upload_id = $1 AND deal_date IS NOT NULL
         AND (status IS NULL OR LOWER(status) NOT LIKE '%cancelled%')`,
      [uploadId]
    );
    const minDate = dateRangeRows[0]?.min_date;
    const maxDate = dateRangeRows[0]?.max_date;

    if (!maxDate) {
      return NextResponse.json({ groups: [], months: [] });
    }

    let dateFrom: string;
    let dateTo: string;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      dateFrom = `${y}-${pad(m)}-01`;
      dateTo = `${y}-${pad(m)}-${pad(lastDay.getDate())}`;
    } else {
      dateFrom = minDate ?? maxDate;
      dateTo = maxDate;
    }

    const monthsRows = await query<{ month: string }>(
      `SELECT DISTINCT TO_CHAR(deal_date, 'YYYY-MM') AS month
       FROM deals WHERE upload_id = $1 AND deal_date IS NOT NULL
         AND (status IS NULL OR LOWER(status) NOT LIKE '%cancelled%')
       ORDER BY month`,
      [uploadId]
    );
    const months = monthsRows.map((r) => r.month);

    const rows = await query<Record<string, unknown>>(
      `SELECT d.id, d.set_id, d.side, d.deal_date, d.vendor_supplier,
        d.amount_received_usd,
        d.trade_contract_margin_usd,
        d.pct_margin,
        d.fx,
        c."group"
      FROM deals d
      LEFT JOIN clients c ON c.upload_id = d.upload_id
        AND UPPER(TRIM(c.company_name)) = UPPER(TRIM(d.vendor_supplier))
      WHERE d.upload_id = $1
        AND (d.status IS NULL OR LOWER(d.status) NOT LIKE '%cancelled%')
        AND d.deal_date >= $2::date
        AND d.deal_date <= $3::date`,
      [uploadId, dateFrom, dateTo]
    );

    const setImportTotal = new Map<number, number>();
    const setExportAgentBrokerMargin = new Map<number, number>();

    for (const r of rows) {
      const sid = Number(r.set_id) || 0;
      const side = String(r.side ?? '').toUpperCase().trim();
      const received = Number(r.amount_received_usd) || 0;
      const margin = Number(r.trade_contract_margin_usd) || 0;
      if (side === 'IMPORT') {
        setImportTotal.set(sid, (setImportTotal.get(sid) ?? 0) + received);
      }
      if (['EXPORT', 'AGENT', 'FOREX'].includes(side)) {
        setExportAgentBrokerMargin.set(sid, (setExportAgentBrokerMargin.get(sid) ?? 0) + margin);
      }
    }

    const groupData = new Map<
      string,
      { importVolume: number; margin: number; fundingCost: number; fx: number; deals: Array<{
        group: string | null;
        vendor_supplier: string;
        deal_date: string | null;
        importVolume: number;
        margin: number;
        pctMargin: number | null;
        fundingCost: number;
        dealProfit: number;
        pctProfit: number | null;
        fx: number | null;
      }> }
    >();

    for (const r of rows) {
      const side = String(r.side ?? '').toUpperCase().trim();
      if (side !== 'IMPORT') continue;

      const received = Number(r.amount_received_usd) || 0;
      const margin = Number(r.trade_contract_margin_usd) || 0;
      const setId = Number(r.set_id) || 0;
      const dealDate = r.deal_date ? String(r.deal_date).slice(0, 10) : null;
      const vendorSupplier = String(r.vendor_supplier ?? '').trim() || '—';
      const group = r.group != null ? String(r.group).trim() || null : null;
      const groupKey = group ?? '—';
      const pctMargin = received !== 0 ? (margin / received) * 100 : null;
      const fx = r.fx != null ? Number(r.fx) : null;

      const setImport = setImportTotal.get(setId) ?? 0;
      const setExportMargin = setExportAgentBrokerMargin.get(setId) ?? 0;
      let fundingCost = 0;
      if (setImport > 0 && setExportMargin !== 0) {
        fundingCost = (received / setImport) * setExportMargin;
      }
      const infrastructureCost = 0;
      const dealProfit = margin + fundingCost + infrastructureCost;
      const pctProfit = received !== 0 ? (dealProfit / received) * 100 : null;

      const cur = groupData.get(groupKey) ?? { importVolume: 0, margin: 0, fundingCost: 0, fx: 0, deals: [] };
      cur.importVolume += received;
      cur.margin += margin;
      cur.fundingCost += fundingCost;
      cur.fx += fx ?? 0;
      cur.deals.push({
        group,
        vendor_supplier: vendorSupplier,
        deal_date: dealDate,
        importVolume: Math.round(received * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        pctMargin: pctMargin,
        fundingCost: Math.round(fundingCost * 100) / 100,
        dealProfit: Math.round(dealProfit * 100) / 100,
        pctProfit: pctProfit != null ? Math.round(pctProfit * 100) / 100 : null,
        fx: fx != null ? Math.round(fx * 100) / 100 : null,
      });
      groupData.set(groupKey, cur);
    }

    const result = Array.from(groupData.entries()).map(([groupKey, g]) => {
      const infrastructureCost = 0;
      const dealProfit = g.margin + g.fundingCost + infrastructureCost;
      const pctProfit = g.importVolume !== 0 ? (dealProfit / g.importVolume) * 100 : null;
      const pctMargin = g.importVolume !== 0 ? (g.margin / g.importVolume) * 100 : null;
      return {
        group: groupKey === '—' ? null : groupKey,
        importVolume: Math.round(g.importVolume * 100) / 100,
        pctMargin: pctMargin != null ? Math.round(pctMargin * 100) / 100 : null,
        margin: Math.round(g.margin * 100) / 100,
        fundingCost: Math.round(g.fundingCost * 100) / 100,
        infrastructureCost: 0,
        dealProfit: Math.round(dealProfit * 100) / 100,
        pctProfit: pctProfit != null ? Math.round(pctProfit * 100) / 100 : null,
        fx: Math.round(g.fx * 100) / 100,
        deals: g.deals.sort((a, b) => (a.deal_date ?? '').localeCompare(b.deal_date ?? '')),
      };
    });

    result.sort((a, b) => (a.group ?? '—').localeCompare(b.group ?? '—'));

    return NextResponse.json({ groups: result, months });
  } catch (e) {
    console.error('Group profit YTD error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
