'use client';

import React, { useState, useEffect, Fragment } from 'react';
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
    { manager: string; importVolume: number; pctMargin: number | null; margin: number; fundingCost: number; infrastructureCost: number; dealProfit: number; pctProfit: number | null; fx: number; deals: Array<{ vendor_supplier: string; deal_date: string | null; importVolume: number; margin: number; pctMargin: number | null; fundingCost: number; dealProfit: number; pctProfit: number | null; fx: number | null }> }[]
  >([]);
  const [expandedManagerProfit, setExpandedManagerProfit] = useState<Set<string>>(new Set());
  const [nonImportMargin, setNonImportMargin] = useState<number>(0);
  const [nonImportFx, setNonImportFx] = useState<number>(0);
  const [totalFx, setTotalFx] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

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
      const [imp, margin, perf, mgrs, smYtd, smDeals, marginBySideRes, managerProfitRes] = await Promise.all([
        fetch(`/api/charts/import?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/margin-daily?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/sales-performance?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/managers?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/salesmen-margin-ytd?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/salesmen-deals-ytd?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/margin-by-side?uploadId=${selectedUploadId}`).then((r) => r.json()),
        fetch(`/api/charts/manager-profit-ytd?uploadId=${selectedUploadId}`).then((r) => r.json()),
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
      if (managerProfitRes && typeof managerProfitRes === 'object' && Array.isArray(managerProfitRes.managers)) {
        setManagerProfitYtd(managerProfitRes.managers);
        setNonImportMargin(managerProfitRes.nonImportMargin ?? 0);
        setNonImportFx(managerProfitRes.nonImportFx ?? 0);
        setTotalFx(managerProfitRes.totalFx ?? 0);
      } else if (Array.isArray(managerProfitRes)) {
        setManagerProfitYtd(managerProfitRes);
        setNonImportMargin(0);
        setNonImportFx(0);
        setTotalFx(0);
      }
    })();
  }, [selectedUploadId]);

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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-amber-400">IB4 Sales Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Загрузка Excel, история и графики</p>
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
            <h2 className="text-lg font-semibold text-amber-300 mb-2">Прибыль по продавцам YTD</h2>
            <p className="text-slate-400 text-xs mb-4">Объём импорта, TRADE CONTRACT MARGIN, FUNDING COST, DEAL PROFIT, %PROFIT за текущий год. Кликните по строке для раскрытия сделок.</p>
            <div className="flex gap-4 items-stretch">
            <div className="overflow-x-auto flex-1 min-w-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">SALESMAN</th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">IMPORT, USD</th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">CONTRACT MARGIN</th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">FUNDING COST</th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">INFRASTRUCTURE COST</th>
                    <th className="text-right py-2 px-2 text-slate-400 font-medium">DEAL PROFIT</th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">%PROFIT</th>
                    <th className="text-right py-2 pl-4 text-slate-400 font-medium">IMPORT FX</th>
                  </tr>
                </thead>
                <tbody>
                  {managerProfitYtd.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-500">Нет данных (загрузите файл заново для расчёта set_id)</td>
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
                            {row.manager} subtotal
                          </td>
                          <td className="text-right py-2 px-2">{formatMoney(row.importVolume)}</td>
                          <td className="text-right py-2 px-2">{formatMoney(row.margin)}</td>
                          <td className="text-right py-2 px-2 text-red-400">{formatMoney(row.fundingCost)}</td>
                          <td className="text-right py-2 px-2 text-slate-500">{formatMoney(row.infrastructureCost)}</td>
                          <td className="text-right py-2 px-2 text-emerald-400 font-medium">{formatMoney(row.dealProfit)}</td>
                          <td className="text-right py-2 pl-4">
                            {row.pctProfit != null ? `${row.pctProfit.toFixed(2)}%` : '—'}
                          </td>
                          <td className="text-right py-2 pl-4">{formatMoney(row.fx)}</td>
                        </tr>
                        {expanded &&
                          row.deals?.map((deal, i) => (
                            <tr key={`deal-${row.manager}-${i}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-2 pr-4 pl-6 text-slate-300 text-xs">
                                {deal.vendor_supplier} {deal.deal_date ? `(${deal.deal_date})` : ''}
                              </td>
                              <td className="text-right py-2 px-2">{formatMoney(deal.importVolume)}</td>
                              <td className="text-right py-2 px-2">{formatMoney(deal.margin)}</td>
                              <td className="text-right py-2 px-2 text-red-400">{formatMoney(deal.fundingCost)}</td>
                              <td className="text-right py-2 px-2 text-slate-500">—</td>
                              <td className="text-right py-2 px-2 text-emerald-400">{formatMoney(deal.dealProfit)}</td>
                              <td className="text-right py-2 pl-4">
                                {deal.pctProfit != null ? `${deal.pctProfit.toFixed(2)}%` : '—'}
                              </td>
                              <td className="text-right py-2 pl-4">
                                {deal.fx != null ? formatMoney(deal.fx) : '—'}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  {managerProfitYtd.length > 0 && (() => {
                    const totalImport = managerProfitYtd.reduce((s, r) => s + r.importVolume, 0);
                    const totalMargin = managerProfitYtd.reduce((s, r) => s + r.margin, 0);
                    return (
                      <tr className="border-t-2 border-slate-600 bg-amber-900/30 font-bold text-amber-200">
                        <td className="py-2 pr-4">Grand Total</td>
                        <td className="text-right py-2 px-2">
                          {formatMoney(totalImport)}
                        </td>
                        <td className="text-right py-2 px-2">
                          {formatMoney(totalMargin)}
                        </td>
                        <td className="text-right py-2 px-2 text-red-400">
                          {formatMoney(managerProfitYtd.reduce((s, r) => s + r.fundingCost, 0))}
                        </td>
                        <td className="text-right py-2 px-2">—</td>
                        <td className="text-right py-2 px-2 text-emerald-400">
                          {formatMoney(managerProfitYtd.reduce((s, r) => s + r.dealProfit, 0))}
                        </td>
                        <td className="text-right py-2 pl-4 text-slate-400">—</td>
                        <td className="text-right py-2 pl-4">
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
                <span className="text-slate-400 text-xs">NON IMPORT MARGIN</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(nonImportMargin)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">NON IMPORT FX</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(nonImportFx)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Total FX</span>
                <span className="block text-amber-400 font-bold text-xl mt-1">
                  {formatMoney(totalFx)}
                </span>
              </div>
            </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
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
                            {g.salesman} subtotal
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
                            {g.salesman} subtotal
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
                      content: (p: { x?: number; y?: number; width?: number; value?: number; payload?: { marginYtd: number; lastDayMargin: number } }) => {
                        const { value, payload } = p ?? {};
                        const marginYtd = payload?.marginYtd ?? value ?? 0;
                        const lastDayMargin = payload?.lastDayMargin ?? 0;
                        const last = lastDayMargin !== 0 ? ` (${lastDayMargin >= 0 ? '+' : ''}${formatNum(lastDayMargin)})` : '';
                        return (
                          <text x={(p?.x ?? 0) + (p?.width ?? 0) + 4} y={(p?.y ?? 0) + 12} fill="#94a3b8" fontSize={11} textAnchor="start">
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
