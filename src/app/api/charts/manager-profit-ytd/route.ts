import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId required' }, { status: 400 });
  }

  try {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

    const rows = await query<Record<string, unknown>>(
      `SELECT id, set_id, side, manager, deal_date, vendor_supplier,
        amount_received_usd,
        trade_contract_margin_usd,
        pct_margin,
        fx
      FROM deals
      WHERE upload_id = $1
        AND (status IS NULL OR LOWER(status) NOT LIKE '%cancelled%')
        AND deal_date >= $2::date`,
      [uploadId, yearStart]
    );

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
      if (side !== 'IMPORT' && margin > 0) {
        nonImportMargin += margin;
      }
      if (side !== 'IMPORT') {
        nonImportFx += Number(r.fx) || 0;
      }
      totalFx += Number(r.fx) || 0;
    }

    // Per-manager aggregates + deal details (only IMPORT deals)
    const managerData = new Map<
      string,
      { importVolume: number; margin: number; fundingCost: number; fx: number; deals: Array<{
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

      const manager = String(r.manager ?? '').trim() || 'Unassigned';
      const received = Number(r.amount_received_usd) || 0;
      const margin = Number(r.trade_contract_margin_usd) || 0;
      const setId = Number(r.set_id) || 0;
      const dealDate = r.deal_date ? String(r.deal_date).slice(0, 10) : null;
      const vendorSupplier = String(r.vendor_supplier ?? '').trim() || '—';
      // %MARGIN из колонки Z — Excel хранит проценты как десятичные (1% = 0.01), умножаем на 100 для отображения
      const pctMarginRaw = r.pct_margin != null ? Number(r.pct_margin) : null;
      const pctMargin = pctMarginRaw != null ? pctMarginRaw * 100 : null;
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

      const cur = managerData.get(manager) ?? {
        importVolume: 0,
        margin: 0,
        fundingCost: 0,
        fx: 0,
        deals: [],
      };
      cur.importVolume += received;
      cur.margin += margin;
      cur.fundingCost += fundingCost;
      cur.fx += fx ?? 0;
      cur.deals.push({
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
      managerData.set(manager, cur);
    }

    const result = Array.from(managerData.entries()).map(([manager, d]) => {
      const infrastructureCost = 0;
      const dealProfit = d.margin + d.fundingCost + infrastructureCost;
      const pctProfit = d.importVolume !== 0 ? (dealProfit / d.importVolume) * 100 : null;
      // %MARGIN = TRADE CONTRACT MARGIN / AMOUNT TO BE RECEIVED USD
      const pctMargin = d.importVolume !== 0 ? (d.margin / d.importVolume) * 100 : null;

      return {
        manager,
        importVolume: Math.round(d.importVolume * 100) / 100,
        pctMargin: pctMargin != null ? Math.round(pctMargin * 100) / 100 : null,
        margin: Math.round(d.margin * 100) / 100,
        fundingCost: Math.round(d.fundingCost * 100) / 100,
        infrastructureCost,
        dealProfit: Math.round(dealProfit * 100) / 100,
        pctProfit: pctProfit != null ? Math.round(pctProfit * 100) / 100 : null,
        fx: Math.round(d.fx * 100) / 100,
        deals: d.deals.sort((a, b) => (a.deal_date ?? '').localeCompare(b.deal_date ?? '')),
      };
    });

    // Sort by manager name
    result.sort((a, b) => a.manager.localeCompare(b.manager));

    return NextResponse.json({
      managers: result,
      nonImportMargin: Math.round(nonImportMargin * 100) / 100,
      nonImportFx: Math.round(nonImportFx * 100) / 100,
      totalFx: Math.round(totalFx * 100) / 100,
    });
  } catch (e) {
    console.error('Manager profit YTD error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
