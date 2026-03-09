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
      return NextResponse.json({ rows: [], exportGroupColumns: [] });
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
      `SELECT d.id, d.set_id, d.side, d.deal_date, d.vendor_supplier,
        d.amount_received_usd, d.amount_payed_usd,
        d.manager,
        c."group",
        c.parent_group
      FROM deals d
      LEFT JOIN clients c ON c.upload_id = d.upload_id
        AND UPPER(TRIM(c.company_name)) = UPPER(TRIM(d.vendor_supplier))
      WHERE d.upload_id = $1
        AND (d.status IS NULL OR LOWER(d.status) NOT LIKE '%cancelled%')
        AND d.deal_date >= $2::date
        AND d.deal_date <= $3::date`,
      [uploadId, dateFrom, dateTo]
    );

    // Resolve effective group: when group = company_name, use parent_group or fallback mapping (e.g. TAIGA -> EVRAZ)
    const SUBSIDIARY_TO_PARENT: Record<string, string> = { TAIGA: 'EVRAZ' };
    const resolveGroup = (r: Record<string, unknown>): string => {
      const group = r.group != null ? String(r.group).trim() || null : null;
      const parentGroup = r.parent_group != null ? String(r.parent_group).trim() || null : null;
      const vendor = r.vendor_supplier != null ? String(r.vendor_supplier).trim() : '';
      if (group && vendor && group.toUpperCase() === vendor.toUpperCase()) {
        if (parentGroup) return parentGroup;
        const mapped = SUBSIDIARY_TO_PARENT[vendor.toUpperCase()];
        if (mapped) return mapped;
      }
      return group ?? '—';
    };

    // Per set: export volume by group (EXPORT only). Group from clients table.
    // If several companies from same group — volumes summed, then % calculated.
    const setExportByGroup = new Map<number, Map<string, number>>();
    const setExportTotal = new Map<number, number>();

    for (const r of rows) {
      const side = String(r.side ?? '').toUpperCase().trim();
      if (side !== 'EXPORT') continue;

      const sid = Number(r.set_id) || 0;
      if (sid === 0) continue;

      const received = Number(r.amount_received_usd) || 0;
      const payed = Number(r.amount_payed_usd) || 0;
      const volume = received !== 0 ? received : payed;
      const groupKey = resolveGroup(r);

      const byGroup = setExportByGroup.get(sid) ?? new Map<string, number>();
      byGroup.set(groupKey, (byGroup.get(groupKey) ?? 0) + volume);
      setExportByGroup.set(sid, byGroup);
      setExportTotal.set(sid, (setExportTotal.get(sid) ?? 0) + volume);
    }

    // Build pivot rows from IMPORT deals
    const pivotRows: Array<{
      salesman: string;
      client: string;
      deal_date: string | null;
      amount_received_usd: number;
      set_id: number;
      exportGroups: Record<string, number>;
    }> = [];

    const exportGroupSet = new Set<string>();

    for (const r of rows) {
      const side = String(r.side ?? '').toUpperCase().trim();
      if (side !== 'IMPORT') continue;

      const sid = Number(r.set_id) || 0;
      const received = Number(r.amount_received_usd) || 0;
      const salesman = r.manager != null ? String(r.manager).trim() || '—' : '—';
      const client = String(r.vendor_supplier ?? '').trim() || '—';
      const dealDate = r.deal_date ? String(r.deal_date).slice(0, 10) : null;

      const byGroup = setExportByGroup.get(sid) ?? new Map<string, number>();
      const total = setExportTotal.get(sid) ?? 0;
      const exportGroups: Record<string, number> = {};
      for (const [gk, vol] of byGroup.entries()) {
        exportGroupSet.add(gk);
        exportGroups[gk] = total > 0 ? Math.round((vol / total) * 10000) / 100 : 0;
      }

      pivotRows.push({
        salesman,
        client,
        deal_date: dealDate,
        amount_received_usd: Math.round(received * 100) / 100,
        set_id: sid,
        exportGroups,
      });
    }

    const exportGroupColumns = Array.from(exportGroupSet).sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));

    return NextResponse.json({ rows: pivotRows, exportGroupColumns });
  } catch (e) {
    console.error('Import-export pivot error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
