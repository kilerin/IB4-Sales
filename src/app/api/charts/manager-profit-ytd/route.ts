import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type Period = 'lastDay' | 'month' | 'quarter' | 'ytd';

function getDateRangeFromAnchor(anchorDate: string, period: Period): { dateFrom: string; dateTo: string } | null {
  const [y, m, d] = anchorDate.split('-').map(Number);
  const month0 = (m ?? 1) - 1;
  const year = y ?? new Date().getFullYear();

  if (period === 'month') {
    const firstDay = new Date(year, month0, 1);
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
      return NextResponse.json({
        managers: [],
        totalMargin: 0,
        nonImportMargin: 0,
        nonImportFx: 0,
        totalFx: 0,
      });
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
      `SELECT d.id, d.set_id, d.side, d.manager, d.deal_date, d.vendor_supplier,
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

    // TOTAL MARGIN: сумма положительной маржи по IMPORT и по EXPORT (и всем сторонам)
    let totalMargin = 0;
    // NON IMPORT MARGIN: сумма положительных TRADE CONTRACT MARGIN USD где SIDE <> IMPORT
    let nonImportMargin = 0;
    // NON IMPORT FX: сумма TOTAL FX TRADING PNL USD где SIDE <> IMPORT
    let nonImportFx = 0;
    // Total FX: сумма всех TOTAL FX TRADING PNL USD
    let totalFx = 0;

    // Per-set aggregates: total import (amount_received) and total export/agent/forex margin
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
      if (margin > 0) {
        totalMargin += margin;
      }
      if (side !== 'IMPORT' && margin > 0) {
        nonImportMargin += margin;
      }
      if (side !== 'IMPORT') {
        nonImportFx += Number(r.fx) || 0;
      }
      totalFx += Number(r.fx) || 0;
    }

    // Per-manager -> per-group aggregates (only IMPORT deals)
    const managerData = new Map<
      string,
      Map<string, { importVolume: number; margin: number; fundingCost: number; fx: number; deals: Array<{
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
    >
    >();

    for (const r of rows) {
      const side = String(r.side ?? '').toUpperCase().trim();
      if (side !== 'IMPORT') continue;

      const manager = String(r.manager ?? '').trim() || 'Unassigned';
      const received = Number(r.amount_received_usd) || 0;
      const margin = Number(r.trade_contract_margin_usd) || 0;
      const setId = Number(r.set_id) || 0;
      const dealDate = r.deal_date ? String(r.deal_date).slice(0, 10) : null;
      const vendorSupplier = String(r.vendor_supplier ?? '').trim() || '—';
      const group = r.group != null ? String(r.group).trim() || null : null;
      const groupKey = group ?? '—';
      // %CONTRACT MARGIN = (margin / importVolume) * 100
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

      const mgrMap = managerData.get(manager) ?? new Map();
      const grp = mgrMap.get(groupKey) ?? { importVolume: 0, margin: 0, fundingCost: 0, fx: 0, deals: [] };
      grp.importVolume += received;
      grp.margin += margin;
      grp.fundingCost += fundingCost;
      grp.fx += fx ?? 0;
      grp.deals.push({
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
      mgrMap.set(groupKey, grp);
      managerData.set(manager, mgrMap);
    }

    const result = Array.from(managerData.entries()).map(([manager, groupMap]) => {
      let dImportVolume = 0;
      let dMargin = 0;
      let dFundingCost = 0;
      let dFx = 0;
      const groups = Array.from(groupMap.entries()).map(([groupKey, g]) => {
        const infrastructureCost = 0;
        const dealProfit = g.margin + g.fundingCost + infrastructureCost;
        const pctProfit = g.importVolume !== 0 ? (dealProfit / g.importVolume) * 100 : null;
        const pctMargin = g.importVolume !== 0 ? (g.margin / g.importVolume) * 100 : null;
        dImportVolume += g.importVolume;
        dMargin += g.margin;
        dFundingCost += g.fundingCost;
        dFx += g.fx;
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
      groups.sort((a, b) => (a.group ?? '—').localeCompare(b.group ?? '—'));
      const infrastructureCost = 0;
      const dealProfit = dMargin + dFundingCost + infrastructureCost;
      const pctProfit = dImportVolume !== 0 ? (dealProfit / dImportVolume) * 100 : null;
      const pctMargin = dImportVolume !== 0 ? (dMargin / dImportVolume) * 100 : null;

      return {
        manager,
        importVolume: Math.round(dImportVolume * 100) / 100,
        pctMargin: pctMargin != null ? Math.round(pctMargin * 100) / 100 : null,
        margin: Math.round(dMargin * 100) / 100,
        fundingCost: Math.round(dFundingCost * 100) / 100,
        infrastructureCost,
        dealProfit: Math.round(dealProfit * 100) / 100,
        pctProfit: pctProfit != null ? Math.round(pctProfit * 100) / 100 : null,
        fx: Math.round(dFx * 100) / 100,
        groups,
      };
    });

    // Sort by manager name
    result.sort((a, b) => a.manager.localeCompare(b.manager));

    return NextResponse.json({
      managers: result,
      totalMargin: Math.round(totalMargin * 100) / 100,
      nonImportMargin: Math.round(nonImportMargin * 100) / 100,
      nonImportFx: Math.round(nonImportFx * 100) / 100,
      totalFx: Math.round(totalFx * 100) / 100,
    });
  } catch (e) {
    console.error('Manager profit YTD error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
