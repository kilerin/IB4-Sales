'use client';

import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { signOut } from 'next-auth/react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';

interface Upload {
  id: number;
  filename: string;
  uploaded_at: string;
  file_size: number | null;
  closed_sets_count: number | null;
}

function HelpIcon({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group cursor-help ml-0.5 align-middle">
      <span className="text-slate-500 hover:text-slate-300 text-xs">ⓘ</span>
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1.5 text-xs bg-slate-700 text-slate-200 rounded shadow-lg border border-slate-600 max-w-[300px] whitespace-normal opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-[100] pointer-events-none">
        {text}
      </span>
    </span>
  );
}

export default function Dashboard() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [importData, setImportData] = useState<{ date: string; total: number }[]>([]);
  const [marginData, setMarginData] = useState<{ date: string; total: number }[]>([]);
  const [salesPerf, setSalesPerf] = useState<{
    managers: string[];
    dates: string[];
    raw: { date: string; manager: string; dealsCount: number; amountPayed: number; amountReceived: number; margin: number }[];
  }>({ managers: [], dates: [], raw: [] });
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [dailySnapshotDates, setDailySnapshotDates] = useState<string[]>([]);
  const [dailySnapshotTable, setDailySnapshotTable] = useState<
    { salesman: string; group: string; vendor: string; dealsCount: number; amountPayed: number; amountReceived: number; margin: number; pct: number | null }[]
  >([]);
  const [expandedDailySalesmen, setExpandedDailySalesmen] = useState<Set<string>>(new Set());
  const [selectedDayExport, setSelectedDayExport] = useState<string>('');
  const [dailySnapshotTableExport, setDailySnapshotTableExport] = useState<
    { salesman: string; group: string; vendor: string; dealsCount: number; amountPayed: number; amountReceived: number; margin: number; pct: number | null }[]
  >([]);
  const [expandedDailySalesmenExport, setExpandedDailySalesmenExport] = useState<Set<string>>(new Set());
  const [managers, setManagers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [managerData, setManagerData] = useState<{ date: string; dealsCount: number; amountPayed: number; amountReceived: number; margin: number }[]>([]);
  const [salesmenMarginYtd, setSalesmenMarginYtd] = useState<{ salesman: string; marginYtd: number; lastDayMargin: number }[]>([]);
  const [salesmenDealsYtd, setSalesmenDealsYtd] = useState<{ salesman: string; dealsCount: number }[]>([]);
  const [marginBySide, setMarginBySide] = useState<{ side: string; positive: number; negative: number }[]>([]);
  const [managerProfitYtd, setManagerProfitYtd] = useState<
    { manager: string; importVolume: number; pctMargin: number | null; margin: number; fundingCost: number; infrastructureCost: number; dealProfit: number; pctProfit: number | null; fx: number; groups: Array<{ group: string | null; importVolume: number; pctMargin: number | null; margin: number; fundingCost: number; dealProfit: number; pctProfit: number | null; fx: number; deals: Array<{ group: string | null; vendor_supplier: string; deal_date: string | null; importVolume: number; margin: number; pctMargin: number | null; fundingCost: number; dealProfit: number; pctProfit: number | null; fx: number | null }> }> }[]
  >([]);
  const [expandedManagerProfit, setExpandedManagerProfit] = useState<Set<string>>(new Set());
  const [expandedManagerProfitGroup, setExpandedManagerProfitGroup] = useState<Set<string>>(new Set());
  const [sideProfitYtd, setSideProfitYtd] = useState<
    { side: string; volume: number; fundingCost: number; infrastructureCost: number; pctCost: number | null; pctTotalCost: number | null; fx: number; types: Array<{ type: string | null; volume: number; fundingCost: number; pctCost: number | null; pctTotalCost: number | null; fx: number; groups: Array<{ group: string | null; volume: number; fundingCost: number; pctCost: number | null; pctTotalCost: number | null; fx: number; deals: Array<{ group: string | null; vendor_supplier: string; deal_date: string | null; volume: number; fundingCost: number; pctCost: number | null; pctTotalCost: number | null; fx: number | null }> }> }> }[]
  >([]);
  const [expandedSideProfit, setExpandedSideProfit] = useState<Set<string>>(new Set());
  const [expandedSideProfitType, setExpandedSideProfitType] = useState<Set<string>>(new Set());
  const [expandedSideProfitGroup, setExpandedSideProfitGroup] = useState<Set<string>>(new Set());
  const [groupProfitYtd, setGroupProfitYtd] = useState<
    { group: string | null; importVolume: number; pctMargin: number | null; margin: number; fundingCost: number; infrastructureCost: number; dealProfit: number; pctProfit: number | null; fx: number; deals: Array<{ group: string | null; vendor_supplier: string; deal_date: string | null; importVolume: number; margin: number; pctMargin: number | null; fundingCost: number; dealProfit: number; pctProfit: number | null; fx: number | null }> }[]
  >([]);
  const [expandedGroupProfit, setExpandedGroupProfit] = useState<Set<string>>(new Set());
  const [groupProfitSort, setGroupProfitSort] = useState<{ column: 'importVolume' | 'margin' | 'dealProfit' | 'pctProfit'; dir: 'asc' | 'desc' } | null>(null);
  const [groupProfitMonth, setGroupProfitMonth] = useState<string>('full');
  const [groupProfitMonths, setGroupProfitMonths] = useState<string[]>([]);
  const [managerProfitPeriod, setManagerProfitPeriod] = useState<'lastDay' | 'month' | 'quarter' | 'ytd'>('ytd');
  const [importExportPivot, setImportExportPivot] = useState<{
    rows: Array<{ salesman: string; client: string; deal_date: string | null; amount_received_usd: number; set_id: number; exportGroups: Record<string, number> }>;
    exportGroupColumns: string[];
  }>({ rows: [], exportGroupColumns: [] });
  const [exportBySalesman, setExportBySalesman] = useState<
    { rows: Array<{ salesman: string; exportVolume: number; pctOfTotal: number }>; totalExport: number }
  >({ rows: [], totalExport: 0 });
  const [setPnl, setSetPnl] = useState<{
    sets: Array<Record<string, number | string | null>>;
    setIds: number[];
    firstSet: number;
    lastSet: number;
  }>({ sets: [], setIds: [], firstSet: 0, lastSet: 0 });
  const [setPnlGroupBy, setSetPnlGroupBy] = useState<'day' | 'week' | 'month' | 'quarter'>('day');
  const [totalMargin, setTotalMargin] = useState<number>(0);
  const [nonImportMargin, setNonImportMargin] = useState<number>(0);
  const [nonImportFx, setNonImportFx] = useState<number>(0);
  const [totalFx, setTotalFx] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const setPnlGroupedColumns = useMemo(() => {
    if (setPnl.sets.length === 0) return [];
    const metricKeys = ['importProfit', 'importLoss', 'exportProfit', 'exportCost', 'loan', 'totalSales', 'fxImport', 'fxExport', 'fxPosition', 'fxForex', 'fxOther', 'totalFx', 'brokerFxProfit', 'brokerFxCost', 'agent', 'totalInfraCost', 'opex', 'grandTotal'] as const;
    const getGroupKey = (dateStr: string | null, groupBy: typeof setPnlGroupBy): string => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'unknown';
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (groupBy === 'day') return dateStr;
      if (groupBy === 'week') {
        // ISO 8601: week 1 = week containing Jan 4; use Thursday of that week as reference
        const d = new Date(date.getTime());
        d.setHours(0, 0, 0, 0);
        const day = d.getDay() || 7; // 1=Mon .. 7=Sun
        d.setDate(d.getDate() + 4 - day); // Thursday of this week
        const jan4 = new Date(d.getFullYear(), 0, 4);
        jan4.setHours(0, 0, 0, 0);
        const jan4Day = jan4.getDay() || 7;
        jan4.setDate(jan4.getDate() + 4 - jan4Day); // Thursday of week 1
        const weekNum = 1 + Math.floor((d.getTime() - jan4.getTime()) / 86400000 / 7);
        const isoYear = d.getFullYear();
        return `${isoYear}-W${String(Math.max(1, weekNum)).padStart(2, '0')}`;
      }
      if (groupBy === 'month') return `${y}-${String(m).padStart(2, '0')}`;
      if (groupBy === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`;
      return dateStr;
    };
    const formatGroupLabel = (groupKey: string, groupBy: typeof setPnlGroupBy): string => {
      if (groupBy === 'day') {
        const [y, m, d] = groupKey.split('-').map(Number);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(d).padStart(2, '0')}.${months[(m ?? 1) - 1] ?? 'Jan'}`;
      }
      if (groupBy === 'week') return groupKey.replace('-W', ' W');
      if (groupBy === 'month') {
        const [y, m] = groupKey.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[parseInt(m ?? '1', 10) - 1] ?? 'Jan'} ${y}`;
      }
      if (groupBy === 'quarter') return groupKey.replace('-', ' ');
      return groupKey;
    };
    if (setPnlGroupBy === 'day') {
      return setPnl.setIds.map((sid) => {
        const s = setPnl.sets.find((x) => x.set_id === sid);
        const data: Record<string, number> = {};
        for (const k of metricKeys) {
          const v = s?.[k];
          data[k] = typeof v === 'number' ? v : 0;
        }
        return {
          groupKey: String(sid),
          label: (s?.dateLabel as string) ?? `Set ${sid}`,
          setIds: [sid],
          data,
        };
      });
    }
    const groups = new Map<string, { setIds: number[]; data: Record<string, number> }>();
    for (const sid of setPnl.setIds) {
      const s = setPnl.sets.find((x) => x.set_id === sid);
      const dateForGroup = (s?.dateMin as string) ?? (s?.dateMax as string) ?? null;
      const groupKey = getGroupKey(dateForGroup, setPnlGroupBy);
      let g = groups.get(groupKey);
      if (!g) {
        g = { setIds: [], data: Object.fromEntries(metricKeys.map((k) => [k, 0])) };
        groups.set(groupKey, g);
      }
      g.setIds.push(sid);
      for (const k of metricKeys) {
        const v = s?.[k];
        g.data[k] += typeof v === 'number' ? v : 0;
      }
    }
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (setPnlGroupBy === 'week') {
        const parse = (k: string): [number, number] => {
          const m = k.match(/^(\d{4})-W(\d{1,2})$/);
          return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, 0];
        };
        const [ay, aw] = parse(a);
        const [by, bw] = parse(b);
        if (ay !== by) return by - ay;
        return bw - aw;
      }
      return b.localeCompare(a);
    });
    return sortedKeys.map((groupKey) => {
      const g = groups.get(groupKey)!;
      return {
        groupKey,
        label: formatGroupLabel(groupKey, setPnlGroupBy),
        setIds: g.setIds,
        data: g.data,
      };
    });
  }, [setPnl, setPnlGroupBy]);

  const fetchUploads = async () => {
    const res = await fetch('/api/uploads');
    const data = await res.json();
    if (res.ok) setUploads(data);
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  useEffect(() => {
    if (!selectedUploadId) return;
    (async () => {
      const [imp, margin, perf, mgrs, smYtd, smDeals, marginBySideRes] = await Promise.all([
        fetch(`/api/charts/import?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/margin-daily?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/sales-performance?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/managers?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/salesmen-margin-ytd?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/salesmen-deals-ytd?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/margin-by-side?uploadId=${selectedUploadId}`).then((r) => r.json()),
      ]);
      if (Array.isArray(imp)) setImportData(imp);
      if (Array.isArray(margin)) setMarginData(margin);
      if (perf.raw) {
        setSalesPerf({ managers: perf.managers || [], dates: perf.dates || [], raw: perf.raw });
        if (perf.dates?.length) setSelectedDay(perf.dates[perf.dates.length - 1]);
      }
      if (Array.isArray(mgrs)) {
        setManagers(mgrs);
        setSelectedManager(mgrs[0] || '');
      }
      if (Array.isArray(smYtd)) setSalesmenMarginYtd(smYtd);
      if (Array.isArray(smDeals)) setSalesmenDealsYtd(smDeals);
      if (Array.isArray(marginBySideRes)) setMarginBySide(marginBySideRes);
    })();
  }, [selectedUploadId]);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetch(`/api/charts/manager-profit-ytd?uploadId=${selectedUploadId}&period=${managerProfitPeriod}`)
      .then((r) => r.json())
      .then((managerProfitRes) => {
        if (managerProfitRes && typeof managerProfitRes === 'object' && Array.isArray(managerProfitRes.managers)) {
          setManagerProfitYtd(managerProfitRes.managers);
          setTotalMargin(managerProfitRes.totalMargin ?? 0);
          setNonImportMargin(managerProfitRes.nonImportMargin ?? 0);
          setNonImportFx(managerProfitRes.nonImportFx ?? 0);
          setTotalFx(managerProfitRes.totalFx ?? 0);
        } else if (Array.isArray(managerProfitRes)) {
          setManagerProfitYtd(managerProfitRes);
          setTotalMargin(0);
          setNonImportMargin(0);
          setNonImportFx(0);
          setTotalFx(0);
        } else {
          setManagerProfitYtd([]);
          setTotalMargin(0);
          setNonImportMargin(0);
          setNonImportFx(0);
          setTotalFx(0);
        }
      })
      .catch(() => {
        setManagerProfitYtd([]);
        setTotalMargin(0);
        setNonImportMargin(0);
        setNonImportFx(0);
      });
  }, [selectedUploadId, managerProfitPeriod]);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetch(`/api/charts/side-profit-ytd?uploadId=${selectedUploadId}&period=${managerProfitPeriod}`)
      .then((r) => r.json())
      .then((res) => {
        if (res && typeof res === 'object' && Array.isArray(res.sides)) {
          setSideProfitYtd(res.sides);
        } else {
          setSideProfitYtd([]);
        }
      })
      .catch(() => setSideProfitYtd([]));
  }, [selectedUploadId, managerProfitPeriod]);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetch(`/api/charts/import-export-pivot?uploadId=${selectedUploadId}&period=${managerProfitPeriod}`)
      .then((r) => r.json())
      .then((res) => {
        if (res && typeof res === 'object' && Array.isArray(res.rows)) {
          setImportExportPivot({
            rows: res.rows,
            exportGroupColumns: Array.isArray(res.exportGroupColumns) ? res.exportGroupColumns : [],
          });
        } else {
          setImportExportPivot({ rows: [], exportGroupColumns: [] });
        }
      })
      .catch(() => setImportExportPivot({ rows: [], exportGroupColumns: [] }));
  }, [selectedUploadId, managerProfitPeriod]);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetch(`/api/charts/export-by-salesman?uploadId=${selectedUploadId}&period=${managerProfitPeriod}`)
      .then((r) => r.json())
      .then((res) => {
        if (res && typeof res === 'object' && Array.isArray(res.rows)) {
          setExportBySalesman({
            rows: res.rows,
            totalExport: res.totalExport ?? 0,
          });
        } else {
          setExportBySalesman({ rows: [], totalExport: 0 });
        }
      })
      .catch(() => setExportBySalesman({ rows: [], totalExport: 0 }));
  }, [selectedUploadId, managerProfitPeriod]);

  useEffect(() => {
    if (!selectedUploadId) return;
    setGroupProfitMonth('full');
  }, [selectedUploadId]);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetch(`/api/charts/set-pnl?uploadId=${selectedUploadId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res && typeof res === 'object' && Array.isArray(res.sets)) {
          setSetPnl({
            sets: res.sets,
            setIds: Array.isArray(res.setIds) ? res.setIds : res.sets.map((s: { set_id: number }) => s.set_id),
            firstSet: res.firstSet ?? res.setIds?.[0] ?? 0,
            lastSet: res.lastSet ?? res.setIds?.[res.setIds?.length - 1] ?? 0,
          });
        } else {
          setSetPnl({ sets: [], setIds: [], firstSet: 0, lastSet: 0 });
        }
      })
      .catch(() => setSetPnl({ sets: [], setIds: [], firstSet: 0, lastSet: 0 }));
  }, [selectedUploadId]);

  useEffect(() => {
    if (!selectedUploadId) return;
    const params = new URLSearchParams({ uploadId: String(selectedUploadId) });
    if (groupProfitMonth && groupProfitMonth !== 'full') params.set('month', groupProfitMonth);
    fetch(`/api/charts/group-profit-ytd?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res && typeof res === 'object' && Array.isArray(res.groups)) {
          setGroupProfitYtd(res.groups);
          if (Array.isArray(res.months)) setGroupProfitMonths(res.months);
        } else {
          setGroupProfitYtd([]);
        }
      })
      .catch(() => setGroupProfitYtd([]));
  }, [selectedUploadId, groupProfitMonth]);

  useEffect(() => {
    if (!selectedUploadId || !selectedManager) return;
    fetch(`/api/charts/sales-by-manager?uploadId=${selectedUploadId}&manager=${encodeURIComponent(selectedManager)}`)
      .then((r) => r.json())
      .then((d) => setManagerData(Array.isArray(d) ? d : []));
  }, [selectedUploadId, selectedManager]);

  useEffect(() => {
    if (!selectedUploadId) return;
    fetch(`/api/charts/daily-snapshot-dates?uploadId=${selectedUploadId}`)
      .then((r) => r.json())
      .then((d) => {
        let dates = Array.isArray(d) ? d : [];
        if (dates.length === 0 && salesPerf.dates?.length) {
          dates = salesPerf.dates;
        }
        if (dates.length === 0 && importData.length > 0) {
          dates = importData.map((x) => x.date);
        }
        setDailySnapshotDates(dates);
        setSelectedDay((prev) => (dates.length && (!prev || !dates.includes(prev)) ? dates[dates.length - 1] : prev));
        setSelectedDayExport((prev) => (dates.length && (!prev || !dates.includes(prev)) ? dates[dates.length - 1] : prev));
      })
      .catch(() => {
        const fallback = salesPerf.dates?.length ? salesPerf.dates : importData.map((x) => x.date);
        if (fallback.length) {
          setDailySnapshotDates(fallback);
          setSelectedDay(fallback[fallback.length - 1]);
          setSelectedDayExport(fallback[fallback.length - 1]);
        }
      });
  }, [selectedUploadId, salesPerf.dates, importData]);

  useEffect(() => {
    if (!selectedUploadId || !selectedDay) return;
    fetch(`/api/charts/daily-snapshot-table?uploadId=${selectedUploadId}&date=${selectedDay}&side=IMPORT`)
      .then((r) => r.json())
      .then((d) => {
        setDailySnapshotTable(Array.isArray(d) ? d : []);
        setExpandedDailySalesmen(new Set());
      });
  }, [selectedUploadId, selectedDay]);

  useEffect(() => {
    if (!selectedUploadId || !selectedDayExport) return;
    fetch(`/api/charts/daily-snapshot-table?uploadId=${selectedUploadId}&date=${selectedDayExport}&side=EXPORT`)
      .then((r) => r.json())
      .then((d) => {
        setDailySnapshotTableExport(Array.isArray(d) ? d : []);
        setExpandedDailySalesmenExport(new Set());
      });
  }, [selectedUploadId, selectedDayExport]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await fetchUploads();
      setSelectedUploadId(data.uploadId);
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    } catch {
      return s;
    }
  };

  const formatNum = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n.toFixed(0);

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const moneyColor = (n: number) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-slate-500');

  const exportManagerProfitYtdToExcel = () => {
    const headers = ['SALESMAN', 'CUSTOMER', 'GROUP', 'IMPORT, USD', 'CONTRACT MARGIN', '%CONTRACT MARGIN', 'FUNDING COST', 'INFRASTRUCTURE COST', 'DEAL PROFIT', '%PROFIT', 'IMPORT FX'];
    const rows: (string | number | null)[][] = [headers];
    for (const row of managerProfitYtd) {
      for (const gr of row.groups ?? []) {
        for (const deal of gr.deals ?? []) {
          rows.push([
            row.manager,
            `${deal.vendor_supplier}${deal.deal_date ? ` (${deal.deal_date})` : ''}`,
            deal.group ?? '',
          deal.importVolume ?? '',
          deal.margin ?? '',
          deal.pctMargin ?? '',
          deal.fundingCost ?? '',
          null,
          deal.dealProfit ?? '',
          deal.pctProfit ?? '',
          deal.fx ?? '',
        ]);
        }
      }
    }
    if (rows.length > 1) {
      const totalImport = managerProfitYtd.reduce((s, r) => s + r.importVolume, 0);
      const totalMargin = managerProfitYtd.reduce((s, r) => s + r.margin, 0);
      const totalFunding = managerProfitYtd.reduce((s, r) => s + r.fundingCost, 0);
      const totalProfit = managerProfitYtd.reduce((s, r) => s + r.dealProfit, 0);
      const totalFx = managerProfitYtd.reduce((s, r) => s + r.fx, 0);
      rows.push([
        'Grand Total',
        '',
        '',
        totalImport,
        totalMargin,
        null,
        totalFunding,
        null,
        totalProfit,
        null,
        totalFx,
      ]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'SALESMEN');
    XLSX.writeFile(wb, 'SALESMEN.xlsx');
  };

  const exportSideProfitYtdToExcel = () => {
    const headers = ['SIDE', 'TYPE', 'CUSTOMER', 'GROUP', 'AMOUNT, USD', 'FUNDING COST', 'INFRASTRUCTURE COST', '%COST', 'FX', 'FUNDING+FX', '%TOTAL COST'];
    const rows: (string | number | null)[][] = [headers];
    for (const row of sideProfitYtd) {
      for (const tp of row.types ?? []) {
        for (const gr of tp.groups ?? []) {
          for (const deal of gr.deals ?? []) {
            rows.push([
              row.side,
              tp.type ?? '',
              `${deal.vendor_supplier}${deal.deal_date ? ` (${deal.deal_date})` : ''}`,
              deal.group ?? '',
              deal.volume ?? '',
              deal.fundingCost ?? '',
              null,
              deal.pctCost ?? '',
              deal.fx ?? '',
              (deal.fundingCost ?? 0) + (deal.fx ?? 0),
              deal.pctTotalCost ?? '',
            ]);
          }
        }
      }
    }
    if (rows.length > 1) {
      const totalVolume = sideProfitYtd.reduce((s, r) => s + r.volume, 0);
      const totalFundingCost = sideProfitYtd.reduce((s, r) => s + r.fundingCost, 0);
      const totalFx = sideProfitYtd.reduce((s, r) => s + r.fx, 0);
      const pctTotalCost = totalVolume !== 0 ? ((totalFundingCost + totalFx) / totalVolume) * 100 : null;
      rows.push([
        'Grand Total',
        '',
        '',
        '',
        totalVolume,
        totalFundingCost,
        null,
        null,
        totalFx,
        totalFundingCost + totalFx,
        pctTotalCost,
      ]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Export Agent Forex YTD');
    XLSX.writeFile(wb, 'Export Agent Forex YTD.xlsx');
  };

  const exportGroupProfitYtdToExcel = () => {
    const headers = ['GROUP', 'CUSTOMER', 'IMPORT, USD', 'CONTRACT MARGIN', '%CONTRACT MARGIN', 'FUNDING COST', 'INFRASTRUCTURE COST', 'DEAL PROFIT', '%PROFIT', 'IMPORT FX'];
    const rows: (string | number | null)[][] = [headers];
    for (const row of groupProfitYtd) {
      for (const deal of row.deals ?? []) {
        rows.push([
          row.group ?? '',
          `${deal.vendor_supplier}${deal.deal_date ? ` (${deal.deal_date})` : ''}`,
          deal.importVolume ?? '',
          deal.margin ?? '',
          deal.pctMargin ?? '',
          deal.fundingCost ?? '',
          null,
          deal.dealProfit ?? '',
          deal.pctProfit ?? '',
          deal.fx ?? '',
        ]);
      }
    }
    if (rows.length > 1) {
      const totalImport = groupProfitYtd.reduce((s, r) => s + r.importVolume, 0);
      const totalMargin = groupProfitYtd.reduce((s, r) => s + r.margin, 0);
      const totalFunding = groupProfitYtd.reduce((s, r) => s + r.fundingCost, 0);
      const totalProfit = groupProfitYtd.reduce((s, r) => s + r.dealProfit, 0);
      const totalFx = groupProfitYtd.reduce((s, r) => s + r.fx, 0);
      const grandPctMargin = totalImport !== 0 ? (totalMargin / totalImport) * 100 : null;
      const grandPctProfit = totalImport !== 0 ? (totalProfit / totalImport) * 100 : null;
      rows.push([
        'Grand Total',
        '',
        totalImport,
        totalMargin,
        grandPctMargin,
        totalFunding,
        null,
        totalProfit,
        grandPctProfit,
        totalFx,
      ]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'ИМПОРТЕРЫ');
    XLSX.writeFile(wb, 'ИМПОРТЕРЫ.xlsx');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">IB4 Sales Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Загрузка Excel, история и графики</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
        >
          Выйти
        </button>
      </header>

      <section className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Удалить все данные из базы?')) return;
              const res = await fetch('/api/clear-data', { method: 'POST' });
              const data = await res.json();
              if (res.ok) {
                await fetchUploads();
                setSelectedUploadId(null);
                setDailySnapshotDates([]);
                setSelectedDay('');
                setSelectedDayExport('');
              } else {
                alert(data.error || 'Ошибка');
              }
            }}
            className="px-3 py-2 rounded bg-red-900/50 hover:bg-red-800/50 text-red-200 text-sm"
          >
            Очистить базу
          </button>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Загрузить Excel</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUpload}
            disabled={uploading}
            className="block w-64 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-amber-500 file:text-slate-900 file:font-medium hover:file:bg-amber-400"
          />
          {uploading && <span className="text-amber-400 text-sm">Загрузка...</span>}
          {uploadError && <p className="text-red-400 text-sm mt-1">{uploadError}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">История загрузок</label>
          <select
            value={selectedUploadId ?? ''}
            onChange={(e) => setSelectedUploadId(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 min-w-[220px]"
          >
            <option value="">Выберите файл</option>
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.filename} — {new Date(u.uploaded_at).toLocaleString('ru-RU')}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!selectedUploadId && (
        <p className="text-slate-500 italic">Загрузите Excel-файл или выберите из истории для отображения графиков.</p>
      )}

      {selectedUploadId && (
        <div className="space-y-10">
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-amber-300 mb-2">Закрытые сеты</h2>
            <p className="text-slate-400 text-xs mb-4">Группы сделок до PIPELINE DELIMITER, разделённые пустыми строками</p>
            <div className="text-amber-400 font-bold text-2xl">
              {uploads.find((u) => u.id === selectedUploadId)?.closed_sets_count ?? '—'}
            </div>
          </div>

          {setPnl.sets.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <h2 className="text-lg font-semibold text-amber-300">SET P&L</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex gap-1">
                    {(['day', 'week', 'month', 'quarter'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSetPnlGroupBy(g)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        setPnlGroupBy === g
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {g === 'day' ? 'Дни' : g === 'week' ? 'Недели' : g === 'month' ? 'Месяцы' : 'Кварталы'}
                    </button>
                  ))}
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-4">Сеты до PIPELINE DELIMITER, Status ≠ CANCELLED. Колонки — {setPnlGroupBy === 'day' ? `сеты ${setPnl.firstSet}-${setPnl.lastSet}` : `свёрнуто по ${setPnlGroupBy === 'week' ? 'неделям' : setPnlGroupBy === 'month' ? 'месяцам' : 'кварталам'}`}.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-2 pr-4 text-slate-400 font-medium min-w-[180px]">Метрика</th>
                      {setPnlGroupedColumns.map((col) => (
                        <th key={col.groupKey} className="text-right py-2 px-2 text-slate-400 font-medium min-w-[90px]">
                          <span className="block text-slate-300">{col.label}</span>
                          <span className="block text-xs text-slate-500">
                            {col.setIds.length > 1 ? `Set ${col.setIds.join(', ')}` : `Set ${col.setIds[0]}`}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'importProfit', label: '1. Import Profit', bold: false },
                      { key: 'importLoss', label: '2. Import Loss', bold: false },
                      { key: 'exportProfit', label: '3. Export Profit', bold: false },
                      { key: 'exportCost', label: '4. Export Cost', bold: false },
                      { key: 'loan', label: '5. Loan (+ or -)', bold: false },
                      { key: 'totalSales', label: '6. Total SALES', bold: true },
                      { key: 'fxImport', label: '7. FX Import', bold: false },
                      { key: 'fxExport', label: '8. FX Export', bold: false },
                      { key: 'fxPosition', label: '9. FX Position', bold: false },
                      { key: 'fxForex', label: '10. FX Forex', bold: false },
                      { key: 'fxOther', label: '11. FX Other (agent, loan)', bold: false },
                      { key: 'totalFx', label: '12. Total FX', bold: true },
                      { key: 'brokerFxProfit', label: '13. Broker FX profit', bold: false },
                      { key: 'brokerFxCost', label: '14. Broker FX cost', bold: false },
                      { key: 'agent', label: '15. Agent', bold: false },
                      { key: 'totalInfraCost', label: '16. Total infrastructure cost', bold: true },
                      { key: 'opex', label: '17. OPEX', bold: false },
                      { key: 'grandTotal', label: '18. Grand Total', bold: true },
                    ].map(({ key, label, bold }) => (
                      <tr
                        key={key}
                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${bold ? 'font-bold bg-amber-900/20' : ''}`}
                      >
                        <td className={`py-2 pr-4 ${bold ? 'text-amber-200' : 'text-slate-300'}`}>{label}</td>
                        {setPnlGroupedColumns.map((col) => {
                          const num = col.data[key] ?? 0;
                          return (
                            <td key={col.groupKey} className={`text-right py-2 px-2 ${moneyColor(num)}`}>
                              {num !== 0 ? formatMoney(num) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-amber-300 mb-2">TRADE CONTRACT MARGIN USD по SIDE</h2>
            <p className="text-slate-400 text-xs mb-4">Суммы Profit и Cost по TRADE CONTRACT MARGIN USD, STATUS ≠ cancelled</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">SIDE</th>
                    <th className="text-right py-2 px-4 text-slate-400 font-medium">Profit</th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {marginBySide.map((row) => (
                    <tr key={row.side} className="border-b border-slate-700/50">
                      <td className="py-2 pr-4 text-slate-200">{row.side}</td>
                      <td className="text-right py-2 px-4 text-emerald-400 font-medium">{formatMoney(row.positive)}</td>
                      <td className="text-right py-2 pl-4 text-red-400 font-medium">{formatMoney(row.negative)}</td>
                    </tr>
                  ))}
                  {marginBySide.length > 0 && (
                    <tr className="border-t-2 border-slate-600 bg-slate-800/80 font-semibold">
                      <td className="py-2 pr-4 text-amber-300">Итого</td>
                      <td className="text-right py-2 px-4 text-emerald-400">
                        {formatMoney(marginBySide.reduce((s, r) => s + r.positive, 0))}
                      </td>
                      <td className="text-right py-2 pl-4 text-red-400">
                        {formatMoney(marginBySide.reduce((s, r) => s + r.negative, 0))}
                      </td>
                    </tr>
                  )}
                  {marginBySide.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-500">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">IMPORT DEALS, USD</h2>
            <p className="text-slate-400 text-xs mb-2">Side = Import, STATUS ≠ cancelled, AMOUNT TO BE RECEIVED USD</p>
            <div className="flex gap-4 items-stretch">
              <div className="h-64 flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={importData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" fontSize={12} />
                    <YAxis tickFormatter={formatNum} stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      formatter={(v: number) => [formatNum(v), 'USD']}
                      labelFormatter={formatDate}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    />
                    <Bar
                      dataKey="total"
                      fill="#f59e0b"
                      name="Amount USD"
                      radius={[4, 4, 0, 0]}
                      label={{ position: 'top', formatter: (v: number) => formatNum(v), fill: '#94a3b8', fontSize: 11 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-amber-900/40 border border-amber-600/50 rounded-lg px-5 py-4 flex flex-col justify-center min-w-[140px]">
                <span className="text-slate-400 text-xs">IMPORT YTD</span>
                <span className="text-amber-400 font-bold text-xl mt-1">
                  {formatNum(importData.reduce((s, d) => s + d.total, 0))}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">TRADE CONTRACT MARGIN, USD</h2>
            <p className="text-slate-400 text-xs mb-2">Сумма маржи по дням, линия — Margin/Import %, Side = Import, STATUS ≠ cancelled</p>
            <div className="flex gap-4 items-stretch">
              <div className="h-64 flex-1 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={marginData.map((m) => {
                    const imp = importData.find((i) => i.date === m.date);
                    const importVal = imp?.total ?? 0;
                    const pct = importVal !== 0 ? (m.total / Math.abs(importVal)) * 100 : null;
                    return { ...m, pct };
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" fontSize={12} />
                  <YAxis yAxisId="left" tickFormatter={formatNum} stroke="#94a3b8" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v?.toFixed(1) ?? ''}%`} stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    formatter={(v: number, name: string) => [name === 'pct' ? (v != null ? `${v.toFixed(2)}%` : '—') : formatNum(v), name === 'pct' ? 'Margin/Import %' : 'Margin']}
                    labelFormatter={formatDate}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="total"
                    fill="#22c55e"
                    name="Margin"
                    radius={[4, 4, 0, 0]}
                    label={{ position: 'top', formatter: (v: number) => formatNum(v), fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="pct"
                    stroke="#a855f7"
                    name="Margin/Import %"
                    dot={{ fill: '#a855f7', r: 3 }}
                    connectNulls={false}
                    label={{ position: 'top', formatter: (v: number) => (v != null ? `${v.toFixed(1)}%` : ''), fill: '#a855f7', fontSize: 10 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              </div>
              <div className="bg-amber-900/40 border border-amber-600/50 rounded-lg px-5 py-4 flex flex-col justify-center min-w-[140px] gap-4">
                <div>
                  <span className="text-slate-400 text-xs">YTD</span>
                  <span className="block text-amber-400 font-bold text-xl mt-1">
                    {formatNum(marginData.reduce((s, d) => s + d.total, 0))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Average %</span>
                  <span className="block text-amber-400 font-bold text-xl mt-1">
                    {(() => {
                      const totalMargin = marginData.reduce((s, d) => s + d.total, 0);
                      const totalImport = importData.reduce((s, d) => s + d.total, 0);
                      return totalImport !== 0 ? `${((totalMargin / Math.abs(totalImport)) * 100).toFixed(1)}%` : '—';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 className="text-lg font-semibold text-amber-300">SALESMEN</h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {(['lastDay', 'month', 'quarter', 'ytd'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setManagerProfitPeriod(p)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        managerProfitPeriod === p
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {p === 'lastDay' ? 'Последний день' : p === 'month' ? 'Месяц' : p === 'quarter' ? 'Квартал' : 'YTD'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={exportManagerProfitYtdToExcel}
                  disabled={managerProfitYtd.length === 0}
                  className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm font-medium shrink-0"
                >
                  Выгрузить в Excel
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-xs mb-4">Объём импорта, TRADE CONTRACT MARGIN, FUNDING COST, DEAL PROFIT, %PROFIT. Переключите период: последний день, месяц, квартал или YTD. Кликните по строке для раскрытия сделок.</p>
            <div className="flex gap-4 items-stretch">
            <div className="overflow-x-auto flex-1 min-w-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">SALESMAN<HelpIcon text="Продавец (менеджер) по сделкам IMPORT" /></th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">GROUP<HelpIcon text="Группа клиента из справочника CLIENTS (по vendor_supplier)" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">IMPORT, USD<HelpIcon text="Сумма amount_received_usd по импортным сделкам" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">CONTRACT MARGIN<HelpIcon text="TRADE CONTRACT MARGIN USD — маржа контракта из Excel" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">%CONTRACT MARGIN<HelpIcon text="(CONTRACT MARGIN / IMPORT, USD) × 100" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">FUNDING COST<HelpIcon text="(amount_received / set_import_total) × set_export_agent_forex_margin — доля маржи EXPORT/AGENT/FOREX сета, приходящаяся на сделку" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">INFRASTRUCTURE COST<HelpIcon text="Инфраструктурные расходы (сейчас = 0)" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">DEAL PROFIT<HelpIcon text="CONTRACT MARGIN + FUNDING COST + INFRASTRUCTURE COST" /></th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">%PROFIT<HelpIcon text="(DEAL PROFIT / IMPORT, USD) × 100" /></th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">IMPORT FX<HelpIcon text="TOTAL FX TRADING PNL USD из колонки BN Excel" /></th>
                  </tr>
                </thead>
                <tbody>
                  {managerProfitYtd.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-slate-500">Нет данных (загрузите файл заново для расчёта set_id)</td>
                    </tr>
                  )}
                  {managerProfitYtd.map((row) => {
                    const expanded = expandedManagerProfit.has(row.manager);
                    const toggle = () =>
                      setExpandedManagerProfit((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.manager)) next.delete(row.manager);
                        else next.add(row.manager);
                        return next;
                      });
                    return (
                      <Fragment key={row.manager}>
                        <tr
                          key={`sub-${row.manager}`}
                          onClick={toggle}
                          className="border-b border-slate-700/50 bg-slate-700/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                        >
                          <td className="py-2 pr-4">
                            <span className="inline-block w-4 mr-1 text-amber-400">{expanded ? '▼' : '▶'}</span>
                            {row.manager}
                          </td>
                          <td className="py-2 px-2 text-slate-500">—</td>
                          <td className="text-right py-2 px-2">{formatMoney(row.importVolume)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${moneyColor(row.margin)}`}>{formatMoney(row.margin)}</td>
                          <td className="text-right py-2 px-2">
                            {row.pctMargin != null ? `${row.pctMargin.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`text-right py-2 px-2 ${moneyColor(row.fundingCost)}`}>{formatMoney(row.fundingCost)}</td>
                          <td className={`text-right py-2 px-2 ${moneyColor(row.infrastructureCost)}`}>{formatMoney(row.infrastructureCost)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${moneyColor(row.dealProfit)}`}>{formatMoney(row.dealProfit)}</td>
                          <td className="text-right py-2 pl-4">
                            {row.pctProfit != null ? `${row.pctProfit.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`text-right py-2 pl-4 ${moneyColor(row.fx)}`}>{formatMoney(row.fx)}</td>
                        </tr>
                        {expanded &&
                          row.groups?.map((gr) => {
                            const groupKey = `${row.manager}:${gr.group ?? '—'}`;
                            const groupExpanded = expandedManagerProfitGroup.has(groupKey);
                            const toggleGroup = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              setExpandedManagerProfitGroup((prev) => {
                                const next = new Set(prev);
                                if (next.has(groupKey)) next.delete(groupKey);
                                else next.add(groupKey);
                                return next;
                              });
                            };
                            return (
                              <Fragment key={groupKey}>
                                <tr
                                  onClick={toggleGroup}
                                  className="border-b border-slate-700/50 bg-slate-600/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                                >
                                  <td className="py-2 pr-4 pl-6 text-slate-500">—</td>
                                  <td className="py-2 px-2">
                                    <span className="inline-block w-4 mr-1 text-amber-400/80">{groupExpanded ? '▼' : '▶'}</span>
                                    {gr.group ?? '—'}
                                  </td>
                                  <td className="text-right py-2 px-2">{formatMoney(gr.importVolume)}</td>
                                  <td className={`text-right py-2 px-2 ${moneyColor(gr.margin)}`}>{formatMoney(gr.margin)}</td>
                                  <td className="text-right py-2 px-2">
                                    {gr.pctMargin != null ? `${gr.pctMargin.toFixed(2)}%` : '—'}
                                  </td>
                                  <td className={`text-right py-2 px-2 ${moneyColor(gr.fundingCost)}`}>{formatMoney(gr.fundingCost)}</td>
                                  <td className="text-right py-2 px-2 text-slate-500">—</td>
                                  <td className={`text-right py-2 px-2 ${moneyColor(gr.dealProfit)}`}>{formatMoney(gr.dealProfit)}</td>
                                  <td className="text-right py-2 pl-4">
                                    {gr.pctProfit != null ? `${gr.pctProfit.toFixed(2)}%` : '—'}
                                  </td>
                                  <td className={`text-right py-2 pl-4 ${moneyColor(gr.fx)}`}>{formatMoney(gr.fx)}</td>
                                </tr>
                                {groupExpanded &&
                                  gr.deals?.map((deal, i) => (
                                    <tr key={`deal-${groupKey}-${i}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                      <td className="py-2 pr-4 pl-10 text-slate-300 text-xs">
                                        {deal.vendor_supplier} {deal.deal_date ? `(${deal.deal_date})` : ''}
                                      </td>
                                      <td className="py-2 px-2 text-slate-400 text-xs">{deal.group ?? '—'}</td>
                                      <td className="text-right py-2 px-2">{formatMoney(deal.importVolume)}</td>
                                      <td className={`text-right py-2 px-2 ${moneyColor(deal.margin)}`}>{formatMoney(deal.margin)}</td>
                                      <td className="text-right py-2 px-2">
                                        {deal.pctMargin != null ? `${deal.pctMargin.toFixed(2)}%` : '—'}
                                      </td>
                                      <td className={`text-right py-2 px-2 ${moneyColor(deal.fundingCost)}`}>{formatMoney(deal.fundingCost)}</td>
                                      <td className="text-right py-2 px-2 text-slate-500">—</td>
                                      <td className={`text-right py-2 px-2 ${moneyColor(deal.dealProfit)}`}>{formatMoney(deal.dealProfit)}</td>
                                      <td className="text-right py-2 pl-4">
                                        {deal.pctProfit != null ? `${deal.pctProfit.toFixed(2)}%` : '—'}
                                      </td>
                                      <td className={`text-right py-2 pl-4 ${moneyColor(deal.fx ?? 0)}`}>
                                        {deal.fx != null ? formatMoney(deal.fx) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                  {managerProfitYtd.length > 0 && (() => {
                    const totalImport = managerProfitYtd.reduce((s, r) => s + r.importVolume, 0);
                    const totalMargin = managerProfitYtd.reduce((s, r) => s + r.margin, 0);
                    return (
                      <tr className="border-t-2 border-slate-600 bg-amber-900/30 font-bold text-amber-200">
                        <td className="py-2 pr-4">Grand Total</td>
                        <td className="py-2 px-2">—</td>
                        <td className="text-right py-2 px-2">
                          {formatMoney(totalImport)}
                        </td>
                        <td className={`text-right py-2 px-2 ${moneyColor(totalMargin)}`}>
                          {formatMoney(totalMargin)}
                        </td>
                        <td className="text-right py-2 px-2 text-slate-400">—</td>
                        <td className={`text-right py-2 px-2 ${moneyColor(managerProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}`}>
                          {formatMoney(managerProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}
                        </td>
                        <td className="text-right py-2 px-2 text-slate-500">—</td>
                        <td className={`text-right py-2 px-2 ${moneyColor(managerProfitYtd.reduce((s, r) => s + r.dealProfit, 0))}`}>
                          {formatMoney(managerProfitYtd.reduce((s, r) => s + r.dealProfit, 0))}
                        </td>
                        <td className="text-right py-2 pl-4 text-slate-400">—</td>
                        <td className={`text-right py-2 pl-4 ${moneyColor(managerProfitYtd.reduce((s, r) => s + r.fx, 0))}`}>
                          {formatMoney(managerProfitYtd.reduce((s, r) => s + r.fx, 0))}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-900/40 border border-amber-600/50 rounded-lg px-5 py-4 flex flex-col justify-center min-w-[140px] shrink-0 gap-4">
              <div>
                <span className="text-slate-400 text-xs">TOTAL MARGIN</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(totalMargin)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">INC. NON IMP. MARGIN</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(nonImportMargin)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">TOTAL FX</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(totalFx)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">NON IMPORT FX</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(nonImportFx)}
                </span>
              </div>
            </div>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 className="text-lg font-semibold text-amber-300">ИМПОРТЕРЫ</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-slate-400 text-sm">Период:</label>
                  <select
                    value={groupProfitMonth}
                    onChange={(e) => setGroupProfitMonth(e.target.value)}
                    className="bg-slate-700 border border-slate-500 rounded px-3 py-1.5 min-w-[180px] text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 [&>option]:bg-slate-800 [&>option]:text-slate-100"
                  >
                    <option value="full">За весь период</option>
                    {groupProfitMonths.map((m) => {
                      const [y, mo] = m.split('-');
                      const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                      const name = `${monthNames[parseInt(mo, 10) - 1]} ${y}`;
                      return (
                        <option key={m} value={m}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={exportGroupProfitYtdToExcel}
                  disabled={groupProfitYtd.length === 0}
                  className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm font-medium shrink-0"
                >
                  Выгрузить в Excel
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-xs mb-4">Объём импорта, TRADE CONTRACT MARGIN, FUNDING COST, DEAL PROFIT по группам. Первый столбец — GROUP. Кликните по заголовку IMPORT, USD, CONTRACT MARGIN, DEAL PROFIT или %PROFIT для сортировки.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">GROUP<HelpIcon text="Группа клиента из справочника CLIENTS (по vendor_supplier)" /></th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">CUSTOMER<HelpIcon text="Vendor/Supplier по сделке" /></th>
                    <th
                      className="text-right py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-amber-400 select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupProfitSort((prev) => {
                          if (prev?.column === 'importVolume') return { column: 'importVolume', dir: prev.dir === 'desc' ? 'asc' : 'desc' };
                          return { column: 'importVolume', dir: 'desc' };
                        });
                      }}
                    >
                      IMPORT, USD
                      {groupProfitSort?.column === 'importVolume' && (
                        <span className="ml-1 text-amber-400">{groupProfitSort.dir === 'desc' ? '▼' : '▲'}</span>
                      )}
                      <HelpIcon text="Сумма amount_received_usd по импортным сделкам" />
                    </th>
                    <th
                      className="text-right py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-amber-400 select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupProfitSort((prev) => {
                          if (prev?.column === 'margin') return { column: 'margin', dir: prev.dir === 'desc' ? 'asc' : 'desc' };
                          return { column: 'margin', dir: 'desc' };
                        });
                      }}
                    >
                      CONTRACT MARGIN
                      {groupProfitSort?.column === 'margin' && (
                        <span className="ml-1 text-amber-400">{groupProfitSort.dir === 'desc' ? '▼' : '▲'}</span>
                      )}
                      <HelpIcon text="TRADE CONTRACT MARGIN USD — маржа контракта из Excel" />
                    </th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">%CONTRACT MARGIN<HelpIcon text="(CONTRACT MARGIN / IMPORT, USD) × 100" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">FUNDING COST<HelpIcon text="(amount_received / set_import_total) × set_export_agent_forex_margin — доля маржи EXPORT/AGENT/FOREX сета" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">INFRASTRUCTURE COST<HelpIcon text="Инфраструктурные расходы (сейчас = 0)" /></th>
                    <th
                      className="text-right py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-amber-400 select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupProfitSort((prev) => {
                          if (prev?.column === 'dealProfit') return { column: 'dealProfit', dir: prev.dir === 'desc' ? 'asc' : 'desc' };
                          return { column: 'dealProfit', dir: 'desc' };
                        });
                      }}
                    >
                      DEAL PROFIT
                      {groupProfitSort?.column === 'dealProfit' && (
                        <span className="ml-1 text-amber-400">{groupProfitSort.dir === 'desc' ? '▼' : '▲'}</span>
                      )}
                      <HelpIcon text="CONTRACT MARGIN + FUNDING COST + INFRASTRUCTURE COST" />
                    </th>
                    <th
                      className="text-right py-2 pl-4 text-slate-400 font-medium cursor-pointer hover:text-amber-400 select-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGroupProfitSort((prev) => {
                          if (prev?.column === 'pctProfit') return { column: 'pctProfit', dir: prev.dir === 'desc' ? 'asc' : 'desc' };
                          return { column: 'pctProfit', dir: 'desc' };
                        });
                      }}
                    >
                      %PROFIT
                      {groupProfitSort?.column === 'pctProfit' && (
                        <span className="ml-1 text-amber-400">{groupProfitSort.dir === 'desc' ? '▼' : '▲'}</span>
                      )}
                      <HelpIcon text="(DEAL PROFIT / IMPORT, USD) × 100" />
                    </th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">IMPORT FX<HelpIcon text="TOTAL FX TRADING PNL USD из колонки BN Excel" /></th>
                  </tr>
                </thead>
                <tbody>
                  {groupProfitYtd.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-slate-500">Нет данных (загрузите файл заново для расчёта set_id)</td>
                    </tr>
                  )}
                  {[...groupProfitYtd]
                    .sort((a, b) => {
                      if (!groupProfitSort) return 0;
                      const col = groupProfitSort.column;
                      const va = (a[col] ?? 0) as number;
                      const vb = (b[col] ?? 0) as number;
                      const cmp = va - vb;
                      return groupProfitSort.dir === 'desc' ? -cmp : cmp;
                    })
                    .map((row) => {
                    const groupKey = row.group ?? '—';
                    const expanded = expandedGroupProfit.has(groupKey);
                    const toggle = () =>
                      setExpandedGroupProfit((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupKey)) next.delete(groupKey);
                        else next.add(groupKey);
                        return next;
                      });
                    return (
                      <Fragment key={groupKey}>
                        <tr
                          onClick={toggle}
                          className="border-b border-slate-700/50 bg-slate-700/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                        >
                          <td className="py-2 pr-4">
                            <span className="inline-block w-4 mr-1 text-amber-400">{expanded ? '▼' : '▶'}</span>
                            {groupKey}
                          </td>
                          <td className="py-2 px-2 text-slate-500">—</td>
                          <td className="text-right py-2 px-2">{formatMoney(row.importVolume)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${moneyColor(row.margin)}`}>{formatMoney(row.margin)}</td>
                          <td className="text-right py-2 px-2">
                            {row.pctMargin != null ? `${row.pctMargin.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`text-right py-2 px-2 ${moneyColor(row.fundingCost)}`}>{formatMoney(row.fundingCost)}</td>
                          <td className={`text-right py-2 px-2 ${moneyColor(row.infrastructureCost)}`}>{formatMoney(row.infrastructureCost)}</td>
                          <td className={`text-right py-2 px-2 font-medium ${moneyColor(row.dealProfit)}`}>{formatMoney(row.dealProfit)}</td>
                          <td className="text-right py-2 pl-4">
                            {row.pctProfit != null ? `${row.pctProfit.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`text-right py-2 pl-4 ${moneyColor(row.fx)}`}>{formatMoney(row.fx)}</td>
                        </tr>
                        {expanded &&
                          row.deals?.map((deal, i) => (
                            <tr key={`deal-${groupKey}-${i}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-2 pr-4 pl-6 text-slate-500">—</td>
                              <td className="py-2 px-2 text-slate-300 text-xs">
                                {deal.vendor_supplier} {deal.deal_date ? `(${deal.deal_date})` : ''}
                              </td>
                              <td className="text-right py-2 px-2">{formatMoney(deal.importVolume)}</td>
                              <td className={`text-right py-2 px-2 ${moneyColor(deal.margin)}`}>{formatMoney(deal.margin)}</td>
                              <td className="text-right py-2 px-2">
                                {deal.pctMargin != null ? `${deal.pctMargin.toFixed(2)}%` : '—'}
                              </td>
                              <td className={`text-right py-2 px-2 ${moneyColor(deal.fundingCost)}`}>{formatMoney(deal.fundingCost)}</td>
                              <td className="text-right py-2 px-2 text-slate-500">—</td>
                              <td className={`text-right py-2 px-2 ${moneyColor(deal.dealProfit)}`}>{formatMoney(deal.dealProfit)}</td>
                              <td className="text-right py-2 pl-4">
                                {deal.pctProfit != null ? `${deal.pctProfit.toFixed(2)}%` : '—'}
                              </td>
                              <td className={`text-right py-2 pl-4 ${moneyColor(deal.fx ?? 0)}`}>
                                {deal.fx != null ? formatMoney(deal.fx) : '—'}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  {groupProfitYtd.length > 0 && (() => {
                    const grandImport = groupProfitYtd.reduce((s, r) => s + r.importVolume, 0);
                    const grandMargin = groupProfitYtd.reduce((s, r) => s + r.margin, 0);
                    const grandProfit = groupProfitYtd.reduce((s, r) => s + r.dealProfit, 0);
                    const grandPctMargin = grandImport !== 0 ? (grandMargin / grandImport) * 100 : null;
                    const grandPctProfit = grandImport !== 0 ? (grandProfit / grandImport) * 100 : null;
                    return (
                    <tr className="border-t-2 border-slate-600 bg-amber-900/30 font-bold text-amber-200">
                      <td className="py-2 pr-4">Grand Total</td>
                      <td className="py-2 px-2">—</td>
                      <td className="text-right py-2 px-2">
                        {formatMoney(grandImport)}
                      </td>
                      <td className={`text-right py-2 px-2 ${moneyColor(grandMargin)}`}>
                        {formatMoney(grandMargin)}
                      </td>
                      <td className="text-right py-2 px-2">
                        {grandPctMargin != null ? `${grandPctMargin.toFixed(2)}%` : '—'}
                      </td>
                      <td className={`text-right py-2 px-2 ${moneyColor(groupProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}`}>
                        {formatMoney(groupProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}
                      </td>
                      <td className="text-right py-2 px-2 text-slate-500">—</td>
                      <td className={`text-right py-2 px-2 ${moneyColor(grandProfit)}`}>
                        {formatMoney(grandProfit)}
                      </td>
                      <td className="text-right py-2 pl-4">
                        {grandPctProfit != null ? `${grandPctProfit.toFixed(2)}%` : '—'}
                      </td>
                      <td className={`text-right py-2 pl-4 ${moneyColor(groupProfitYtd.reduce((s, r) => s + r.fx, 0))}`}>
                        {formatMoney(groupProfitYtd.reduce((s, r) => s + r.fx, 0))}
                      </td>
                    </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 className="text-lg font-semibold text-amber-300">Export / Agent / Forex YTD</h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {(['lastDay', 'month', 'quarter', 'ytd'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setManagerProfitPeriod(p)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        managerProfitPeriod === p
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {p === 'lastDay' ? 'Последний день' : p === 'month' ? 'Месяц' : p === 'quarter' ? 'Квартал' : 'YTD'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={exportSideProfitYtdToExcel}
                  disabled={sideProfitYtd.length === 0}
                  className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm font-medium shrink-0"
                >
                  Выгрузить в Excel
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-xs mb-4">EXPORT, AGENT и FOREX: объём, FUNDING COST, %COST. Субтотал по SIDE и GROUP. Кликните по строке для раскрытия.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">SIDE<HelpIcon text="Сторона сделки: EXPORT, AGENT или FOREX" /></th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">TYPE<HelpIcon text="Тип сделки из колонки TYPE или DEAL TYPE Excel" /></th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">GROUP<HelpIcon text="Группа клиента из справочника CLIENTS (по vendor_supplier)" /></th>
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">CUSTOMER<HelpIcon text="Vendor/Supplier по сделке" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">AMOUNT, USD<HelpIcon text="amount_received_usd или amount_payed_usd (если received = 0)" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">FUNDING COST<HelpIcon text="TRADE CONTRACT MARGIN USD — маржа контракта (источник funding cost для Import)" /></th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">INFRASTRUCTURE COST<HelpIcon text="Инфраструктурные расходы (сейчас = 0)" /></th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">%COST<HelpIcon text="(FUNDING COST / AMOUNT, USD) × 100" /></th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">FX<HelpIcon text="TOTAL FX TRADING PNL USD из колонки BN Excel" /></th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">FUNDING+FX<HelpIcon text="FUNDING COST + FX" /></th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">%TOTAL COST<HelpIcon text="(FUNDING COST + INFRASTRUCTURE COST + FX) / AMOUNT, USD × 100" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sideProfitYtd.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-4 text-center text-slate-500">Нет данных</td>
                    </tr>
                  )}
                  {sideProfitYtd.map((row) => {
                    const sideExpanded = expandedSideProfit.has(row.side);
                    const toggleSide = () =>
                      setExpandedSideProfit((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.side)) next.delete(row.side);
                        else next.add(row.side);
                        return next;
                      });
                    return (
                      <Fragment key={row.side}>
                        <tr
                          onClick={toggleSide}
                          className="border-b border-slate-700/50 bg-slate-700/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                        >
                          <td className="py-2 pr-4">
                            <span className="inline-block w-4 mr-1 text-amber-400">{sideExpanded ? '▼' : '▶'}</span>
                            {row.side}
                          </td>
                          <td className="py-2 px-2 text-slate-500">—</td>
                          <td className="py-2 px-2 text-slate-500">—</td>
                          <td className="py-2 px-2 text-slate-500">—</td>
                          <td className="text-right py-2 px-2">{formatMoney(row.volume)}</td>
                          <td className={`text-right py-2 px-2 ${moneyColor(row.fundingCost)}`}>{formatMoney(row.fundingCost)}</td>
                          <td className={`text-right py-2 px-2 ${moneyColor(row.infrastructureCost)}`}>{formatMoney(row.infrastructureCost)}</td>
                          <td className="text-right py-2 pl-4">
                            {row.pctCost != null ? `${row.pctCost.toFixed(2)}%` : '—'}
                          </td>
                          <td className={`text-right py-2 pl-4 ${moneyColor(row.fx)}`}>{formatMoney(row.fx)}</td>
                          <td className={`text-right py-2 pl-4 ${moneyColor(row.fundingCost + row.fx)}`}>{formatMoney(row.fundingCost + row.fx)}</td>
                          <td className="text-right py-2 pl-4">
                            {row.pctTotalCost != null ? `${row.pctTotalCost.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                        {sideExpanded &&
                          row.types?.map((tp) => {
                            const typeKey = `${row.side}:${tp.type ?? '—'}`;
                            const typeExpanded = expandedSideProfitType.has(typeKey);
                            const toggleType = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              setExpandedSideProfitType((prev) => {
                                const next = new Set(prev);
                                if (next.has(typeKey)) next.delete(typeKey);
                                else next.add(typeKey);
                                return next;
                              });
                            };
                            return (
                              <Fragment key={typeKey}>
                                <tr
                                  onClick={toggleType}
                                  className="border-b border-slate-700/50 bg-slate-600/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                                >
                                  <td className="py-2 pr-4 pl-6 text-slate-500">—</td>
                                  <td className="py-2 px-2">
                                    <span className="inline-block w-4 mr-1 text-amber-400/80">{typeExpanded ? '▼' : '▶'}</span>
                                    {tp.type ?? '—'}
                                  </td>
                                  <td className="py-2 px-2 text-slate-500">—</td>
                                  <td className="py-2 px-2 text-slate-500">—</td>
                                  <td className="text-right py-2 px-2">{formatMoney(tp.volume)}</td>
                                  <td className={`text-right py-2 px-2 ${moneyColor(tp.fundingCost)}`}>{formatMoney(tp.fundingCost)}</td>
                                  <td className="text-right py-2 px-2 text-slate-500">—</td>
                                  <td className="text-right py-2 pl-4">
                                    {tp.pctCost != null ? `${tp.pctCost.toFixed(2)}%` : '—'}
                                  </td>
                                  <td className={`text-right py-2 pl-4 ${moneyColor(tp.fx)}`}>{formatMoney(tp.fx)}</td>
                                  <td className={`text-right py-2 pl-4 ${moneyColor(tp.fundingCost + tp.fx)}`}>{formatMoney(tp.fundingCost + tp.fx)}</td>
                                  <td className="text-right py-2 pl-4">
                                    {tp.pctTotalCost != null ? `${tp.pctTotalCost.toFixed(2)}%` : '—'}
                                  </td>
                                </tr>
                                {typeExpanded &&
                                  tp.groups?.map((gr) => {
                                    const groupKey = `${typeKey}:${gr.group ?? '—'}`;
                                    const groupExpanded = expandedSideProfitGroup.has(groupKey);
                                    const toggleGroup = (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      setExpandedSideProfitGroup((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(groupKey)) next.delete(groupKey);
                                        else next.add(groupKey);
                                        return next;
                                      });
                                    };
                                    return (
                                      <Fragment key={groupKey}>
                                        <tr
                                          onClick={toggleGroup}
                                          className="border-b border-slate-700/50 bg-slate-600/30 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                                        >
                                          <td className="py-2 pr-4 pl-6 text-slate-500">—</td>
                                          <td className="py-2 px-2 pl-6">{tp.type ?? '—'}</td>
                                          <td className="py-2 px-2">
                                            <span className="inline-block w-4 mr-1 text-amber-400/70">{groupExpanded ? '▼' : '▶'}</span>
                                            {gr.group ?? '—'}
                                          </td>
                                          <td className="py-2 px-2 text-slate-500">—</td>
                                          <td className="text-right py-2 px-2">{formatMoney(gr.volume)}</td>
                                          <td className={`text-right py-2 px-2 ${moneyColor(gr.fundingCost)}`}>{formatMoney(gr.fundingCost)}</td>
                                          <td className="text-right py-2 px-2 text-slate-500">—</td>
                                          <td className="text-right py-2 pl-4">
                                            {gr.pctCost != null ? `${gr.pctCost.toFixed(2)}%` : '—'}
                                          </td>
                                          <td className={`text-right py-2 pl-4 ${moneyColor(gr.fx)}`}>{formatMoney(gr.fx)}</td>
                                          <td className={`text-right py-2 pl-4 ${moneyColor(gr.fundingCost + gr.fx)}`}>{formatMoney(gr.fundingCost + gr.fx)}</td>
                                          <td className="text-right py-2 pl-4">
                                            {gr.pctTotalCost != null ? `${gr.pctTotalCost.toFixed(2)}%` : '—'}
                                          </td>
                                        </tr>
                                        {groupExpanded &&
                                          gr.deals?.map((deal, i) => (
                                            <tr key={`deal-${groupKey}-${i}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                              <td className="py-2 pr-4 pl-6 text-slate-500">—</td>
                                              <td className="py-2 px-2 pl-10 text-slate-400 text-xs">{tp.type ?? '—'}</td>
                                              <td className="py-2 px-2 text-slate-400 text-xs">{deal.group ?? '—'}</td>
                                              <td className="py-2 px-2 pl-6 text-slate-300 text-xs">
                                                {deal.vendor_supplier} {deal.deal_date ? `(${deal.deal_date})` : ''}
                                              </td>
                                              <td className="text-right py-2 px-2">{formatMoney(deal.volume)}</td>
                                              <td className={`text-right py-2 px-2 ${moneyColor(deal.fundingCost)}`}>{formatMoney(deal.fundingCost)}</td>
                                              <td className="text-right py-2 px-2 text-slate-500">—</td>
                                              <td className="text-right py-2 pl-4">
                                                {deal.pctCost != null ? `${deal.pctCost.toFixed(2)}%` : '—'}
                                              </td>
                                              <td className={`text-right py-2 pl-4 ${moneyColor(deal.fx ?? 0)}`}>
                                                {deal.fx != null ? formatMoney(deal.fx) : '—'}
                                              </td>
                                              <td className={`text-right py-2 pl-4 ${moneyColor((deal.fundingCost ?? 0) + (deal.fx ?? 0))}`}>
                                                {formatMoney((deal.fundingCost ?? 0) + (deal.fx ?? 0))}
                                              </td>
                                              <td className="text-right py-2 pl-4">
                                                {deal.pctTotalCost != null ? `${deal.pctTotalCost.toFixed(2)}%` : '—'}
                                              </td>
                                            </tr>
                                          ))}
                                      </Fragment>
                                    );
                                  })}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                  {sideProfitYtd.length > 0 && (
                    <tr className="border-t-2 border-slate-600 bg-amber-900/30 font-bold text-amber-200">
                      <td className="py-2 pr-4">Grand Total</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2">—</td>
                      <td className="py-2 px-2">—</td>
                      <td className="text-right py-2 px-2">
                        {formatMoney(sideProfitYtd.reduce((s, r) => s + r.volume, 0))}
                      </td>
                      <td className={`text-right py-2 px-2 ${moneyColor(sideProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}`}>
                        {formatMoney(sideProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}
                      </td>
                      <td className="text-right py-2 px-2 text-slate-500">—</td>
                      <td className="text-right py-2 pl-4 text-slate-400">—</td>
                      <td className={`text-right py-2 pl-4 ${moneyColor(sideProfitYtd.reduce((s, r) => s + r.fx, 0))}`}>
                        {formatMoney(sideProfitYtd.reduce((s, r) => s + r.fx, 0))}
                      </td>
                      <td className={`text-right py-2 pl-4 ${moneyColor(sideProfitYtd.reduce((s, r) => s + r.fundingCost + r.fx, 0))}`}>
                        {formatMoney(sideProfitYtd.reduce((s, r) => s + r.fundingCost + r.fx, 0))}
                      </td>
                      <td className="text-right py-2 pl-4">
                        {(() => {
                          const totalVol = sideProfitYtd.reduce((s, r) => s + r.volume, 0);
                          const totalFunding = sideProfitYtd.reduce((s, r) => s + r.fundingCost, 0);
                          const totalFx = sideProfitYtd.reduce((s, r) => s + r.fx, 0);
                          const pct = totalVol !== 0 ? ((totalFunding + totalFx) / totalVol) * 100 : null;
                          return pct != null ? `${pct.toFixed(2)}%` : '—';
                        })()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {exportBySalesman.rows.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-amber-200 mb-2">Экспорт по продавцам</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-2 pr-4 text-slate-400 font-medium">Продавец</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-medium">Сумма экспорта, USD</th>
                        <th className="text-right py-2 pl-4 text-slate-400 font-medium">% от общего экспорта</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportBySalesman.rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-2 pr-4">{row.salesman}</td>
                          <td className="text-right py-2 px-2">{formatMoney(row.exportVolume)}</td>
                          <td className="text-right py-2 pl-4">{row.pctOfTotal.toFixed(2)}%</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-600 bg-amber-900/30 font-bold text-amber-200">
                        <td className="py-2 pr-4">Итого</td>
                        <td className="text-right py-2 px-2">{formatMoney(exportBySalesman.totalExport)}</td>
                        <td className="text-right py-2 pl-4">100.00%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importExportPivot.rows.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-amber-200 mb-2">Сводная: импорт → экспорт по сетам</h3>
                <p className="text-slate-400 text-xs mb-3">Слева — импорт (продавец, клиент с датой, amount_received_usd). Колонки — группы EXPORT из справочника CLIENTS (не названия компаний). Если в сете несколько экспортёров из одной группы — их % суммируются.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-600">
                        <th className="text-left py-2 pr-4 text-slate-400 font-medium">Продавец</th>
                        <th className="text-left py-2 px-2 text-slate-400 font-medium">Клиент</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-medium">amount_received_usd</th>
                        {importExportPivot.exportGroupColumns.map((g) => (
                          <th key={g} className="text-right py-2 px-2 text-slate-400 font-medium" title="Группа EXPORT">
                            {g}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importExportPivot.rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-2 pr-4">{row.salesman}</td>
                          <td className="py-2 px-2">
                            {row.client}
                            {row.deal_date ? ` (${row.deal_date})` : ''}
                          </td>
                          <td className="text-right py-2 px-2">{formatMoney(row.amount_received_usd)}</td>
                          {importExportPivot.exportGroupColumns.map((g) => (
                            <td key={g} className="text-right py-2 px-2">
                              {row.exportGroups[g] != null && row.exportGroups[g] > 0
                                ? `${row.exportGroups[g].toFixed(2)}%`
                                : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mt-6">
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 flex-1 min-w-[400px]">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">Daily snapshot, IMPORT</h2>
            <div className="flex gap-4 mb-4 items-center">
              <label className="text-slate-400 text-sm">DEAL DATE:</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-slate-700 border border-slate-500 rounded px-3 py-2 min-w-[200px] text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 [&>option]:bg-slate-800 [&>option]:text-slate-100"
              >
                <option value="">
                  {dailySnapshotDates.length === 0 ? '— Нет дат —' : 'Выберите дату'}
                </option>
                {dailySnapshotDates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)} ({d})</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-600">
                    <th className="py-2 pr-4">SALESMAN</th>
                    <th className="py-2 pr-4">GROUP</th>
                    <th className="py-2 pr-4">VENDOR</th>
                    <th className="py-2 pr-4 text-right">#DEALS</th>
                    <th className="py-2 pr-4 text-right">PAYED, USD.</th>
                    <th className="py-2 pr-4 text-right">RECEIVED, USD.</th>
                    <th className="py-2 pr-4 text-right">MARGIN, USD.</th>
                    <th className="py-2 pr-4 text-right">%%</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const isExpanded = (s: string) => expandedDailySalesmen.has(s);
                    const toggleSalesman = (s: string) =>
                      setExpandedDailySalesmen((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next;
                      });
                    const groups: { salesman: string; details: typeof dailySnapshotTable; subDeals: number; subPayed: number; subReceived: number; subMargin: number }[] = [];
                    let grandDeals = 0, grandPayed = 0, grandReceived = 0, grandMargin = 0;
                    let cur: { salesman: string; details: typeof dailySnapshotTable; subDeals: number; subPayed: number; subReceived: number; subMargin: number } | null = null;
                    for (const row of dailySnapshotTable) {
                      if (!cur || cur.salesman !== row.salesman) {
                        cur = { salesman: row.salesman, details: [], subDeals: 0, subPayed: 0, subReceived: 0, subMargin: 0 };
                        groups.push(cur);
                      }
                      cur.details.push(row);
                      cur.subDeals += row.dealsCount;
                      cur.subPayed += row.amountPayed;
                      cur.subReceived += row.amountReceived;
                      cur.subMargin += row.margin;
                      grandDeals += row.dealsCount;
                      grandPayed += row.amountPayed;
                      grandReceived += row.amountReceived;
                      grandMargin += row.margin;
                    }
                    const grandPct = grandPayed !== 0 ? (grandMargin / Math.abs(grandPayed)) * 100 : null;
                    let rowKey = 0;
                    const result: React.ReactElement[] = [];
                    for (const g of groups) {
                      const subPct = g.subPayed !== 0 ? (g.subMargin / Math.abs(g.subPayed)) * 100 : null;
                      const expanded = isExpanded(g.salesman);
                      result.push(
                        <tr
                          key={`s-${g.salesman}`}
                          onClick={() => toggleSalesman(g.salesman)}
                          className="border-b border-slate-700/50 bg-slate-700/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                        >
                          <td className="py-2 pr-4">
                            <span className="inline-block w-4 mr-1 text-amber-400">{expanded ? '▼' : '▶'}</span>
                            {g.salesman}
                          </td>
                          <td className="py-2 pr-4">—</td>
                          <td className="py-2 pr-4">—</td>
                          <td className="py-2 pr-4 text-right">{g.subDeals}</td>
                          <td className="py-2 pr-4 text-right">{formatMoney(g.subPayed)}</td>
                          <td className="py-2 pr-4 text-right">{formatMoney(g.subReceived)}</td>
                          <td className="py-2 pr-4 text-right">{formatMoney(g.subMargin)}</td>
                          <td className="py-2 pr-4 text-right">{subPct != null ? `${subPct.toFixed(2)}%` : '—'}</td>
                        </tr>,
                      );
                      if (expanded) {
                        for (const r of g.details) {
                          result.push(
                            <tr key={`d-${rowKey++}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-2 pr-4 pl-6">{r.salesman}</td>
                              <td className="py-2 pr-4">{r.group}</td>
                              <td className="py-2 pr-4">{r.vendor}</td>
                              <td className="py-2 pr-4 text-right">{r.dealsCount}</td>
                              <td className="py-2 pr-4 text-right">{formatMoney(r.amountPayed)}</td>
                              <td className="py-2 pr-4 text-right">{formatMoney(r.amountReceived)}</td>
                              <td className="py-2 pr-4 text-right">{formatMoney(r.margin)}</td>
                              <td className="py-2 pr-4 text-right">{r.pct != null ? `${r.pct.toFixed(2)}%` : '—'}</td>
                            </tr>,
                          );
                        }
                      }
                    }
                    result.push(
                      <tr key="total" className="border-b border-slate-700/50 bg-amber-900/30 font-bold text-amber-200">
                        <td className="py-2 pr-4">Grand Total</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 pr-4 text-right">{grandDeals}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(grandPayed)}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(grandReceived)}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(grandMargin)}</td>
                        <td className="py-2 pr-4 text-right">{grandPct != null ? `${grandPct.toFixed(2)}%` : '—'}</td>
                      </tr>,
                    );
                    return result;
                  })()}
                </tbody>
              </table>
              {dailySnapshotTable.length === 0 && selectedDay && (
                <p className="text-slate-500 py-4 italic">Нет данных за выбранный день</p>
              )}
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 flex-1 min-w-[400px]">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">Daily snapshot, EXPORT</h2>
            <div className="flex gap-4 mb-4 items-center">
              <label className="text-slate-400 text-sm">DEAL DATE:</label>
              <select
                value={selectedDayExport}
                onChange={(e) => setSelectedDayExport(e.target.value)}
                className="bg-slate-700 border border-slate-500 rounded px-3 py-2 min-w-[200px] text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 [&>option]:bg-slate-800 [&>option]:text-slate-100"
              >
                <option value="">
                  {dailySnapshotDates.length === 0 ? '— Нет дат —' : 'Выберите дату'}
                </option>
                {dailySnapshotDates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)} ({d})</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-600">
                    <th className="py-2 pr-4">SALESMAN</th>
                    <th className="py-2 pr-4">GROUP</th>
                    <th className="py-2 pr-4">VENDOR</th>
                    <th className="py-2 pr-4 text-right">#DEALS</th>
                    <th className="py-2 pr-4 text-right">PAYED, USD.</th>
                    <th className="py-2 pr-4 text-right">RECEIVED, USD.</th>
                    <th className="py-2 pr-4 text-right">MARGIN, USD.</th>
                    <th className="py-2 pr-4 text-right">%%</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const isExpanded = (s: string) => expandedDailySalesmenExport.has(s);
                    const toggleSalesman = (s: string) =>
                      setExpandedDailySalesmenExport((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next;
                      });
                    const groups: { salesman: string; details: typeof dailySnapshotTableExport; subDeals: number; subPayed: number; subReceived: number; subMargin: number }[] = [];
                    let grandDeals = 0, grandPayed = 0, grandReceived = 0, grandMargin = 0;
                    let cur: { salesman: string; details: typeof dailySnapshotTableExport; subDeals: number; subPayed: number; subReceived: number; subMargin: number } | null = null;
                    for (const row of dailySnapshotTableExport) {
                      if (!cur || cur.salesman !== row.salesman) {
                        cur = { salesman: row.salesman, details: [], subDeals: 0, subPayed: 0, subReceived: 0, subMargin: 0 };
                        groups.push(cur);
                      }
                      cur.details.push(row);
                      cur.subDeals += row.dealsCount;
                      cur.subPayed += row.amountPayed;
                      cur.subReceived += row.amountReceived;
                      cur.subMargin += row.margin;
                      grandDeals += row.dealsCount;
                      grandPayed += row.amountPayed;
                      grandReceived += row.amountReceived;
                      grandMargin += row.margin;
                    }
                    const grandPct = grandPayed !== 0 ? (grandMargin / Math.abs(grandPayed)) * 100 : null;
                    let rowKey = 0;
                    const result: React.ReactElement[] = [];
                    for (const g of groups) {
                      const subPct = g.subPayed !== 0 ? (g.subMargin / Math.abs(g.subPayed)) * 100 : null;
                      const expanded = isExpanded(g.salesman);
                      result.push(
                        <tr
                          key={`es-${g.salesman}`}
                          onClick={() => toggleSalesman(g.salesman)}
                          className="border-b border-slate-700/50 bg-slate-700/40 font-medium cursor-pointer hover:bg-slate-600/50 select-none"
                        >
                          <td className="py-2 pr-4">
                            <span className="inline-block w-4 mr-1 text-amber-400">{expanded ? '▼' : '▶'}</span>
                            {g.salesman}
                          </td>
                          <td className="py-2 pr-4">—</td>
                          <td className="py-2 pr-4">—</td>
                          <td className="py-2 pr-4 text-right">{g.subDeals}</td>
                          <td className="py-2 pr-4 text-right">{formatMoney(g.subPayed)}</td>
                          <td className="py-2 pr-4 text-right">{formatMoney(g.subReceived)}</td>
                          <td className="py-2 pr-4 text-right">{formatMoney(g.subMargin)}</td>
                          <td className="py-2 pr-4 text-right">{subPct != null ? `${subPct.toFixed(2)}%` : '—'}</td>
                        </tr>,
                      );
                      if (expanded) {
                        for (const r of g.details) {
                          result.push(
                            <tr key={`ed-${rowKey++}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-2 pr-4 pl-6">{r.salesman}</td>
                              <td className="py-2 pr-4">{r.group}</td>
                              <td className="py-2 pr-4">{r.vendor}</td>
                              <td className="py-2 pr-4 text-right">{r.dealsCount}</td>
                              <td className="py-2 pr-4 text-right">{formatMoney(r.amountPayed)}</td>
                              <td className="py-2 pr-4 text-right">{formatMoney(r.amountReceived)}</td>
                              <td className="py-2 pr-4 text-right">{formatMoney(r.margin)}</td>
                              <td className="py-2 pr-4 text-right">{r.pct != null ? `${r.pct.toFixed(2)}%` : '—'}</td>
                            </tr>,
                          );
                        }
                      }
                    }
                    result.push(
                      <tr key="etotal" className="border-b border-slate-700/50 bg-amber-900/30 font-bold text-amber-200">
                        <td className="py-2 pr-4">Grand Total</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 pr-4 text-right">{grandDeals}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(grandPayed)}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(grandReceived)}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(grandMargin)}</td>
                        <td className="py-2 pr-4 text-right">{grandPct != null ? `${grandPct.toFixed(2)}%` : '—'}</td>
                      </tr>,
                    );
                    return result;
                  })()}
                </tbody>
              </table>
              {dailySnapshotTableExport.length === 0 && selectedDayExport && (
                <p className="text-slate-500 py-4 italic">Нет данных за выбранный день</p>
              )}
            </div>
          </div>
          </div>

          <div className="flex flex-wrap gap-4">
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 flex-1 min-w-[400px]">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">SALESMEN PERFORMANCE, MARGIN</h2>
            <p className="text-slate-400 text-xs mb-2">Margin USD YTD, в подписи — прирост за последний день</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesmenMarginYtd} layout="vertical" margin={{ left: 60, right: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tickFormatter={formatNum} stroke="#94a3b8" fontSize={12} />
                  <YAxis type="category" dataKey="salesman" stroke="#94a3b8" fontSize={12} width={80} />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      [name === 'marginYtd' ? formatNum(v) : v, name === 'marginYtd' ? 'Margin YTD' : 'За последний день']}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                  <Bar
                    dataKey="marginYtd"
                    fill="#3b82f6"
                    name="Margin YTD"
                    radius={[0, 4, 4, 0]}
                    label={{
                      position: 'right',
                      content: (p: { x?: string | number; y?: string | number; width?: string | number; value?: string | number; payload?: { marginYtd?: number; lastDayMargin?: number } }) => {
                        const { value, payload } = p ?? {};
                        const marginYtd = Number(payload?.marginYtd ?? value ?? 0);
                        const lastDayMargin = Number(payload?.lastDayMargin ?? 0);
                        const last = lastDayMargin !== 0 ? ` (${lastDayMargin >= 0 ? '+' : ''}${formatNum(lastDayMargin)})` : '';
                        const x = Number(p?.x ?? 0) + Number(p?.width ?? 0) + 4;
                        const y = Number(p?.y ?? 0) + 12;
                        return (
                          <text x={x} y={y} fill="#94a3b8" fontSize={11} textAnchor="start">
                            {`${formatNum(marginYtd)}${last}`}
                          </text>
                        );
                      },
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 flex-1 min-w-[400px]">
            <h2 className="text-lg font-semibold text-amber-300 mb-4">SALESMEN PERFORMANCE, DEALS</h2>
            <p className="text-slate-400 text-xs mb-2">Количество сделок YTD</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesmenDealsYtd} layout="vertical" margin={{ left: 60, right: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis type="category" dataKey="salesman" stroke="#94a3b8" fontSize={12} width={80} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Deals']}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                  <Bar
                    dataKey="dealsCount"
                    fill="#22c55e"
                    name="Deals"
                    radius={[0, 4, 4, 0]}
                    label={{ position: 'right', formatter: (v: number) => String(v), fill: '#94a3b8', fontSize: 11 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
