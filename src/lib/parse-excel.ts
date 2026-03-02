import * as XLSX from 'xlsx';

export interface ParsedDeal {
  status: string | null;
  side: string | null;
  deal_date: Date | null;
  vendor_supplier: string | null;
  amount_payed_usd: number | null;
  amount_received_usd: number | null;
  trade_contract_margin_usd: number | null;
  /** %MARGIN из колонки Z */
  pct_margin: number | null;
  /** TOTAL FX TRADING PNL USD, колонка BN */
  fx: number | null;
  /** Индекс сета (1-based), группа сделок между пустыми строками */
  set_id: number;
}

export interface ParsedClient {
  company_name: string;
  group: string | null;
  manager: string | null;
}

export interface ParseResult {
  deals: ParsedDeal[];
  clients: ParsedClient[];
  /** Количество закрытых сетов (группы сделок до PIPELINE DELIMITER, разделённые пустыми строками) */
  closedSetsCount: number;
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'number' && val > 0) {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === 'string') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function toNum(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const n = parseFloat(String(val).replace(/\s/g, ''));
  return isNaN(n) ? null : n;
}

function toString(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s || null;
}

export function parseExcel(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const deals: ParsedDeal[] = [];
  const clients: ParsedClient[] = [];
  let closedSetsCount = 0;

  const dealsSheet = wb.Sheets['DEALS'] || wb.Sheets['Deals'] || wb.Sheets[wb.SheetNames[0]];
  if (dealsSheet) {
    const arr = XLSX.utils.sheet_to_json<Record<string, unknown>>(dealsSheet, { header: 1, defval: null });
    const header = (arr[0] as unknown[]) || [];
    const statusIdx = header.findIndex((h) => String(h).toLowerCase().includes('status'));
    const sideIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('SIDE'));
    const dateIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('DEAL DATE'));
    const vendorIdx = header.findIndex((h) => h && String(h).includes('VENDOR') && String(h).includes('SUPPLIER'));
    const idx = (fn: (h: unknown) => boolean, fallback: number) => {
      const i = header.findIndex(fn);
      return i >= 0 ? i : fallback;
    };
    const payedIdx = idx((h) => {
      const s = String(h ?? '');
      return s.includes('AMOUNT TO BE PAYED') && s.includes('USD') && !s.includes('MANUAL') && !s.includes('FINAL') && !s.includes('CALCULATED');
    }, 45);
    const receivedIdx = idx((h) => {
      const s = String(h ?? '');
      return s.includes('AMOUNT TO BE RECEIVED') && s.includes('USD') && !s.includes('MANUAL') && !s.includes('FINAL') && !s.includes('CALCULATED');
    }, 46);
    const marginIdx = idx((h) => {
      const s = String(h ?? '');
      return s.includes('TRADE CONTRACT MARGIN') && s.includes('USD') && !s.includes('MANUAL');
    }, 49);
    const pctMarginIdx = header.findIndex((h) => String(h ?? '').toUpperCase().includes('%MARGIN') || String(h ?? '').includes('% MARGIN'));
    const pctMarginCol = pctMarginIdx >= 0 ? pctMarginIdx : 25; // fallback: column Z
    const fxIdx = header.findIndex((h) => String(h ?? '').toUpperCase().includes('TOTAL FX TRADING PNL'));
    const fxCol = fxIdx >= 0 ? fxIdx : 65; // fallback: column BN

    let inSet = false;
    let currentSetId = 1;
    for (let i = 1; i < arr.length; i++) {
      const row = arr[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;

      const rowStr = row.map((c) => String(c ?? '')).join(' ');
      if (rowStr.includes('PIPELINE DELIMITER')) {
        if (inSet) closedSetsCount++;
        break;
      }

      const status = toString(row[statusIdx]);
      const side = toString(row[sideIdx]);
      const vendor = toString(row[vendorIdx]);
      const isEmpty = !status && !side && !vendor;

      if (isEmpty) {
        if (inSet) {
          closedSetsCount++;
          inSet = false;
          currentSetId++;
        }
        continue;
      }

      inSet = true;
      const deal: ParsedDeal = {
        status,
        side,
        deal_date: toDate(row[dateIdx]),
        vendor_supplier: vendor,
        amount_payed_usd: toNum(row[payedIdx]),
        amount_received_usd: toNum(row[receivedIdx]),
        trade_contract_margin_usd: toNum(row[marginIdx]),
        pct_margin: toNum(row[pctMarginCol]),
        fx: toNum(row[fxCol]),
        set_id: currentSetId,
      };
      deals.push(deal);
    }
    if (inSet) closedSetsCount++;
  }

  const clientsSheet = wb.Sheets['CLIENTS'] || wb.Sheets['Clients'] || wb.Sheets[wb.SheetNames.find((n) => /client/i.test(n)) ?? wb.SheetNames[0]];
  if (clientsSheet) {
    const arr = XLSX.utils.sheet_to_json<Record<string, unknown>>(clientsSheet, { header: 1, defval: null });
    const header = (arr[0] as unknown[]) || [];
    const companyIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('COMPANY NAME'));
    const groupIdx = header.findIndex((h) => h && String(h).toUpperCase() === 'GROUP');
    const managerIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('MANAGER'));

    for (let i = 1; i < arr.length; i++) {
      const row = arr[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;
      const company = toString(row[companyIdx]);
      const manager = toString(row[managerIdx]);
      const group = toString(row[groupIdx]);
      if (!company) continue;
      clients.push({ company_name: company, group, manager });
    }
  }

  return { deals, clients, closedSetsCount };
}

export function joinDealsWithManagers(deals: ParsedDeal[], clients: ParsedClient[]): (ParsedDeal & { manager: string | null })[] {
  const map = new Map<string, string>();
  for (const c of clients) {
    const k = c.company_name.trim().toUpperCase();
    if (c.manager && !map.has(k)) map.set(k, c.manager);
  }
  return deals.map((d) => ({
    ...d,
    manager: (d.vendor_supplier && map.get(d.vendor_supplier.trim().toUpperCase())) ?? null,
  }));
}
