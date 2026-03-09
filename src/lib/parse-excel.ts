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
  /** LE WE PAY — для Admin fee (VST) */
  le_we_pay: string | null;
  /** OUR BANK, колонка U — для Admin fee (CZB, CHZH) */
  our_bank: string | null;
}

export interface ParsedClient {
  company_name: string;
  group: string | null;
  /** Родительская группа: когда group = company_name (дочерняя компания), использовать parent_group */
  parent_group: string | null;
  type: string | null;
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
    const s = String(val).trim();
    // yyyy-mm-dd (ISO, приоритет)
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      const [, y, m, d] = iso;
      const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
      if (!isNaN(date.getTime())) return date;
    }
    // dd.mm.yyyy or dd/mm/yyyy
    const dmY = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (dmY) {
      const [, d, m, y] = dmY;
      const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
      if (!isNaN(date.getTime())) return date;
    }
    // mm/dd/yyyy (US)
    const mDY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mDY) {
      const [, m, d, y] = mDY;
      const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
      if (!isNaN(date.getTime())) return date;
    }
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
    const arr = XLSX.utils.sheet_to_json(dealsSheet, { header: 1, defval: null }) as unknown[][];
    const header = (arr[0] ?? []) as unknown[];
    const statusIdx = header.findIndex((h) => String(h).toLowerCase().includes('status'));
    const sideIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('SIDE'));
    const dateIdx = header.findIndex((h) => h && String(h).toUpperCase().replace(/\s/g, '') === 'DEALDATE');
    const dateIdxAlt = header.findIndex((h) => h && String(h).toUpperCase().includes('DEAL') && String(h).toUpperCase().includes('DATE'));
    const dateCol = dateIdx >= 0 ? dateIdx : dateIdxAlt >= 0 ? dateIdxAlt : 4;
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
    const normalizeHeader = (s: string) => s.replace(/\s+/g, ' ').replace(/\u00A0/g, ' ').trim();
    const marginIdx = header.findIndex(
      (h) => h && normalizeHeader(String(h)) === 'TRADE CONTRACT MARGIN USD'
    );
    const marginCol = marginIdx >= 0 ? marginIdx : 49; // fallback: column AX
    const pctMarginIdx = header.findIndex((h) => String(h ?? '').toUpperCase().includes('%MARGIN') || String(h ?? '').includes('% MARGIN'));
    const pctMarginCol = pctMarginIdx >= 0 ? pctMarginIdx : 25; // fallback: column Z
    const fxIdx = header.findIndex((h) => String(h ?? '').toUpperCase().includes('TOTAL FX TRADING PNL'));
    const fxCol = fxIdx >= 0 ? fxIdx : 65; // fallback: column BN
    const leWePayIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('LE WE PAY'));
    const ourBankIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('OUR BANK'));
    const ourBankCol = ourBankIdx >= 0 ? ourBankIdx : 20; // column U

    let inSet = false;
    let currentSetId = 1;
    for (let i = 1; i < arr.length; i++) {
      const row = arr[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;

      const rowStr = row.map((c) => String(c ?? '')).join(' ');
      if (rowStr.includes('PIPELINE DELIMITER')) {
        if (inSet) closedSetsCount++;
        inSet = false; // чтобы финальный if (inSet) после цикла не сработал
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
        deal_date: toDate(row[dateCol]),
        vendor_supplier: vendor,
        amount_payed_usd: toNum(row[payedIdx]),
        amount_received_usd: toNum(row[receivedIdx]),
        trade_contract_margin_usd: toNum(row[marginCol]),
        pct_margin: toNum(row[pctMarginCol]),
        fx: toNum(row[fxCol]),
        set_id: currentSetId,
        le_we_pay: leWePayIdx >= 0 ? toString(row[leWePayIdx]) : null,
        our_bank: toString(row[ourBankCol]),
      };
      deals.push(deal);
    }
    if (inSet) closedSetsCount++;
  }

  const clientsSheet = wb.Sheets['CLIENTS'] || wb.Sheets['Clients'] || wb.Sheets[wb.SheetNames.find((n) => /client/i.test(n)) ?? wb.SheetNames[0]];
  if (clientsSheet) {
    const arr = XLSX.utils.sheet_to_json(clientsSheet, { header: 1, defval: null }) as unknown[][];
    const header = (arr[0] ?? []) as unknown[];
    const companyIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('COMPANY NAME'));
    const groupIdx = header.findIndex((h) => h && String(h).toUpperCase() === 'GROUP');
    const parentGroupIdx = header.findIndex((h) => h && (String(h).toUpperCase() === 'PARENT GROUP' || String(h).toUpperCase() === 'PARENT'));
    const typeIdx = header.findIndex((h) => h && (String(h).toUpperCase() === 'TYPE' || String(h).toUpperCase().includes('DEAL TYPE')));
    const managerIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('MANAGER'));

    for (let i = 1; i < arr.length; i++) {
      const row = arr[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;
      const company = toString(row[companyIdx]);
      const manager = toString(row[managerIdx]);
      const group = toString(row[groupIdx]);
      const parentGroup = parentGroupIdx >= 0 ? toString(row[parentGroupIdx]) : null;
      const type = typeIdx >= 0 ? toString(row[typeIdx]) : null;
      if (!company) continue;
      clients.push({ company_name: company, group, parent_group: parentGroup, type, manager });
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
