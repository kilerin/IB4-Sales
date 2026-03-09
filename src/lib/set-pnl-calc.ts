/** Pure calculation logic for SET P&L — extracted for testing */

export interface SetPnlRow {
  set_id: number | null;
  side: string | null;
  deal_date: string | null;
  amount_payed_usd: number | null;
  amount_received_usd: number | null;
  trade_contract_margin_usd: number | null;
  fx: number | null;
  le_we_pay: string | null;
  our_bank: string | null;
  client_type: string | null;
}

export interface SetPnlResult {
  set_id: number;
  dateLabel: string;
  dateMin: string | null;
  dateMax: string | null;
  importProfit: number;
  importLoss: number;
  exportProfit: number;
  exportCost: number;
  loan: number;
  totalSales: number;
  fxImport: number;
  fxExport: number;
  fxPosition: number;
  fxForex: number;
  fxOther: number;
  totalFx: number;
  brokerFxProfit: number;
  brokerFxCost: number;
  agent: number;
  totalInfraCost: number;
  opex: number;
  grandTotal: number;
}

const toDateStr = (v: unknown): string | null => {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDdMmm = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = String(d ?? 1).padStart(2, '0');
  const mon = monthNames[(m ?? 1) - 1] ?? 'Jan';
  return `${day}.${mon}`;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function calculateSetPnl(
  rows: SetPnlRow[],
  closedSetsCount: number
): { sets: SetPnlResult[]; setIds: number[]; firstSet: number; lastSet: number } {
  const filtered = rows.filter(
    (r) =>
      r.set_id != null &&
      Number(r.set_id) > 0 &&
      Number(r.set_id) <= closedSetsCount
  );

  const setIds = [...new Set(filtered.map((r) => Number(r.set_id)!))].sort((a, b) => b - a);
  const setDateRange = new Map<number, { min: string; max: string }>();

  for (const r of filtered) {
    const sid = Number(r.set_id)!;
    const d = toDateStr(r.deal_date);
    if (d) {
      const cur = setDateRange.get(sid);
      if (!cur) setDateRange.set(sid, { min: d, max: d });
      else {
        if (d < cur.min) cur.min = d;
        if (d > cur.max) cur.max = d;
      }
    }
  }

  const setData = new Map<
    number,
    {
      importProfit: number;
      importLoss: number;
      exportProfit: number;
      exportCost: number;
      loan: number;
      totalSales: number;
      fxImport: number;
      fxExport: number;
      fxPosition: number;
      fxForex: number;
      fxOther: number;
      totalFx: number;
      brokerFxProfit: number;
      brokerFxCost: number;
      agent: number;
      totalInfraCost: number;
      opex: number;
      grandTotal: number;
    }
  >();

  for (const sid of setIds) {
    setData.set(sid, {
      importProfit: 0,
      importLoss: 0,
      exportProfit: 0,
      exportCost: 0,
      loan: 0,
      totalSales: 0,
      fxImport: 0,
      fxExport: 0,
      fxPosition: 0,
      fxForex: 0,
      fxOther: 0,
      totalFx: 0,
      brokerFxProfit: 0,
      brokerFxCost: 0,
      agent: 0,
      totalInfraCost: 0,
      opex: 0,
      grandTotal: 0,
    });
  }

  for (const r of filtered) {
    const sid = Number(r.set_id)!;
    const data = setData.get(sid)!;
    const side = String(r.side ?? '').toUpperCase().trim();
    const margin = Number(r.trade_contract_margin_usd) ?? 0;
    const fxVal = Number(r.fx) ?? 0;
    const clientType = r.client_type != null ? String(r.client_type).toUpperCase().trim() : '';
    const isBroker = clientType === 'BROKER';
    const leWePay = r.le_we_pay != null ? String(r.le_we_pay).toUpperCase().trim() : '';
    const ourBank = r.our_bank != null ? String(r.our_bank).toUpperCase().trim() : '';
    const dealDate = r.deal_date ? String(r.deal_date).slice(0, 10) : '';
    const payed = Number(r.amount_payed_usd) ?? 0;
    const received = Number(r.amount_received_usd) ?? 0;

    if (side === 'IMPORT') {
      if (margin > 0) data.importProfit += margin;
      else if (margin < 0) data.importLoss += margin;
      data.fxImport += fxVal;
    } else if (side === 'EXPORT') {
      if (margin > 0) data.exportProfit += margin;
      else if (margin < 0) data.exportCost += margin;
      if (isBroker) {
        if (fxVal > 0) data.brokerFxProfit += fxVal;
        else if (fxVal < 0) data.brokerFxCost += fxVal;
      } else {
        data.fxExport += fxVal;
      }
    } else if (side === 'LOAN') {
      data.loan += margin;
      data.fxOther += fxVal;
    } else if (side === 'POSITION') {
      data.fxPosition += fxVal;
    } else if (side === 'FOREX') {
      data.fxForex += fxVal;
    } else if (side === 'AGENT') {
      data.agent += margin;
      data.fxOther += fxVal;
    } else {
      data.fxOther += fxVal;
    }
  }

  for (const [, data] of setData) {
    data.totalSales = data.importProfit + data.importLoss + data.exportProfit + data.exportCost + data.loan;
    data.totalFx = data.fxImport + data.fxExport + data.fxPosition + data.fxForex + data.fxOther;
    data.totalInfraCost = data.brokerFxProfit + data.brokerFxCost + data.agent;
    data.grandTotal = data.totalSales + data.totalFx + data.totalInfraCost + data.opex;
  }

  const sets: SetPnlResult[] = setIds.map((sid) => {
    const d = setData.get(sid)!;
    const range = setDateRange.get(sid);
    const dateLabel = range
      ? range.min === range.max
        ? formatDdMmm(range.min)
        : `${formatDdMmm(range.min)}-${formatDdMmm(range.max)}`
      : `Set ${sid}`;
    return {
      set_id: sid,
      dateLabel,
      dateMin: range?.min ?? null,
      dateMax: range?.max ?? null,
      importProfit: round(d.importProfit),
      importLoss: round(d.importLoss),
      exportProfit: round(d.exportProfit),
      exportCost: round(d.exportCost),
      loan: round(d.loan),
      totalSales: round(d.totalSales),
      fxImport: round(d.fxImport),
      fxExport: round(d.fxExport),
      fxPosition: round(d.fxPosition),
      fxForex: round(d.fxForex),
      fxOther: round(d.fxOther),
      totalFx: round(d.totalFx),
      brokerFxProfit: round(d.brokerFxProfit),
      brokerFxCost: round(d.brokerFxCost),
      agent: round(d.agent),
      totalInfraCost: round(d.totalInfraCost),
      opex: round(d.opex),
      grandTotal: round(d.grandTotal),
    };
  });

  return {
    sets,
    setIds,
    firstSet: setIds[0] ?? 0,
    lastSet: setIds[setIds.length - 1] ?? 0,
  };
}
