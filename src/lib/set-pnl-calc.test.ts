import { describe, it, expect } from 'vitest';
import { calculateSetPnl, CUTOFF_DATE } from './set-pnl-calc';
import type { SetPnlRow } from './set-pnl-calc';

function row(overrides: Partial<SetPnlRow> & { set_id: number; side: string }): SetPnlRow {
  return {
    set_id: null,
    side: null,
    deal_date: null,
    amount_payed_usd: null,
    amount_received_usd: null,
    trade_contract_margin_usd: null,
    fx: null,
    le_we_pay: null,
    our_bank: null,
    client_type: null,
    ...overrides,
  };
}

describe('calculateSetPnl', () => {
  it('import profit: margin > 0 goes to importProfit', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: 1000, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].importProfit).toBe(1000);
    expect(sets[0].importLoss).toBe(0);
  });

  it('import loss: margin < 0 goes to importLoss', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: -500, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].importProfit).toBe(0);
    expect(sets[0].importLoss).toBe(-500);
  });

  it('export profit and cost', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'EXPORT', trade_contract_margin_usd: 200, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'EXPORT', trade_contract_margin_usd: -150, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].exportProfit).toBe(200);
    expect(sets[0].exportCost).toBe(-150);
  });

  it('totalSales = importProfit + importLoss + exportProfit + exportCost + loan', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: 100, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: -20, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'EXPORT', trade_contract_margin_usd: 50, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'EXPORT', trade_contract_margin_usd: -30, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'LOAN', trade_contract_margin_usd: 10, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].totalSales).toBe(110); // 100 - 20 + 50 - 30 + 10
  });

  it('totalFx = fxImport + fxExport + fxPosition + fxForex + fxOther', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', fx: 10, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'EXPORT', fx: -5, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'POSITION', fx: 3, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'FOREX', fx: 2, deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'LOAN', fx: 1, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].totalFx).toBe(11); // 10 - 5 + 3 + 2 + 1
  });

  it('broker FX: EXPORT with client_type BROKER goes to brokerFxProfit/Cost', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'EXPORT', fx: 100, client_type: 'BROKER', deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'EXPORT', fx: -30, client_type: 'BROKER', deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].brokerFxProfit).toBe(100);
    expect(sets[0].brokerFxCost).toBe(-30);
    expect(sets[0].fxExport).toBe(0);
  });

  it('totalInfraCost = brokerFxProfit + brokerFxCost + agent', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'EXPORT', fx: 50, client_type: 'BROKER', deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'EXPORT', fx: -20, client_type: 'BROKER', deal_date: '2026-03-01' }),
      row({ set_id: 1, side: 'AGENT', trade_contract_margin_usd: -15, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].brokerFxProfit).toBe(50);
    expect(sets[0].brokerFxCost).toBe(-20);
    expect(sets[0].agent).toBe(-15);
    expect(sets[0].totalInfraCost).toBe(15); // 50 - 20 - 15
  });

  it('grandTotal = totalSales + totalFx + totalInfraCost + opex', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: 1000, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].totalSales).toBe(1000);
    expect(sets[0].totalFx).toBe(0);
    expect(sets[0].totalInfraCost).toBe(0);
    expect(sets[0].opex).toBe(0);
    expect(sets[0].grandTotal).toBe(1000);
  });

  it('multiple sets are calculated separately', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: 100, deal_date: '2026-03-01' }),
      row({ set_id: 2, side: 'IMPORT', trade_contract_margin_usd: 200, deal_date: '2026-03-02' }),
    ];
    const { sets, setIds } = calculateSetPnl(rows, 999);
    expect(setIds).toEqual([2, 1]);
    expect(sets.find((s) => s.set_id === 1)?.importProfit).toBe(100);
    expect(sets.find((s) => s.set_id === 2)?.importProfit).toBe(200);
  });

  it('excludes sets beyond closedSetsCount', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: 100, deal_date: '2026-03-01' }),
      row({ set_id: 2, side: 'IMPORT', trade_contract_margin_usd: 200, deal_date: '2026-03-02' }),
    ];
    const { sets } = calculateSetPnl(rows, 1);
    expect(sets).toHaveLength(1);
    expect(sets[0].set_id).toBe(1);
  });

  it('rounds values to 2 decimals', () => {
    const rows: SetPnlRow[] = [
      row({ set_id: 1, side: 'IMPORT', trade_contract_margin_usd: 100.12345, deal_date: '2026-03-01' }),
    ];
    const { sets } = calculateSetPnl(rows, 999);
    expect(sets[0].importProfit).toBe(100.12);
  });
});
