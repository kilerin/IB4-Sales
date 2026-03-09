import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/** Debug: загрузите Excel, получите заголовки и значения margin для сета 177 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheet = wb.Sheets['DEALS'] || wb.Sheets['Deals'] || wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: 'DEALS sheet not found' }, { status: 400 });
    }

    const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
    const header = (arr[0] ?? []) as unknown[];

    const toNum = (val: unknown): number | null => {
      if (val == null) return null;
      if (typeof val === 'number' && !isNaN(val)) return val;
      const n = parseFloat(String(val).replace(/\s/g, ''));
      return isNaN(n) ? null : n;
    };
    const toString = (val: unknown): string | null => {
      if (val == null) return null;
      const s = String(val).trim();
      return s || null;
    };

    const sideIdx = header.findIndex((h) => h && String(h).toUpperCase().includes('SIDE'));
    const vendorIdx = header.findIndex((h) => h && String(h).includes('VENDOR') && String(h).includes('SUPPLIER'));

    const marginExactIdx = header.findIndex((h) => h && String(h).trim() === 'TRADE CONTRACT MARGIN USD');
    const marginCol = marginExactIdx >= 0 ? marginExactIdx : 49;

    const headersAroundMargin = header
      .map((h, i) => ({ i, col: indexToCol(i), value: h ? String(h) : '' }))
      .filter((x) => x.i >= 45 && x.i <= 55);

    let inSet = false;
    let currentSetId = 1;
    const set177Export: { vendor: string; margin: number; raw: unknown }[] = [];
    let exportCostSum = 0;

    for (let i = 1; i < arr.length; i++) {
      const row = arr[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;

      const rowStr = row.map((c) => String(c ?? '')).join(' ');
      if (rowStr.includes('PIPELINE DELIMITER')) break;

      const status = toString(row[header.findIndex((h) => String(h).toLowerCase().includes('status'))]);
      const side = toString(row[sideIdx]);
      const vendor = toString(row[vendorIdx]);
      const isEmpty = !status && !side && !vendor;

      if (isEmpty) {
        if (inSet) {
          inSet = false;
          currentSetId++;
        }
        continue;
      }
      inSet = true;

      if (currentSetId === 177 && side === 'EXPORT') {
        const margin = toNum(row[marginCol]) ?? 0;
        if (margin < 0) {
          set177Export.push({ vendor: vendor ?? '', margin, raw: row[marginCol] });
          exportCostSum += margin;
        }
      }
    }

    return NextResponse.json({
      marginCol,
      marginColLetter: indexToCol(marginCol),
      marginExactFound: marginExactIdx >= 0,
      headersAroundMargin,
      allMarginHeaders: header
        .map((h, i) => ({ i, col: indexToCol(i), value: String(h ?? '') }))
        .filter((x) => /TRADE.*MARGIN|MARGIN.*USD/i.test(x.value)),
      set177ExportDeals: set177Export,
      set177ExportCostSum: Math.round(exportCostSum * 100) / 100,
      expectedInExcel: -7835.69,
    });
  } catch (e) {
    console.error('Debug margin error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function indexToCol(i: number): string {
  let s = '';
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
