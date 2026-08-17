'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  BarChart3, Download, TrendingUp, MapPin, Car, ArrowRightLeft, Calendar, CalendarDays, History
} from 'lucide-react';
import { getMonthlyStats, getStationStats, getVehicleStats, getDashboardKPIs, getDailyStats, getYearlyStats } from '@/services/refuels';
import { MonthlyStats, StationStats, VehicleStats, DashboardKPIs, ComparisonData, DailyStats, YearlyStats } from '@/lib/types';
import { formatCurrency, formatNumber, formatVariation, calcVariation, cn } from '@/lib/utils';
import { MONTHS, YEARS, MONTHS_SHORT } from '@/lib/constants';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Tab = 'comparativo' | 'diario' | 'mensal' | 'anual' | 'postos' | 'veiculos';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
        active
          ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

// ============================================================
// COMPARATIVO
// ============================================================
function ComparativoTab() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [period1, setPeriod1] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [period2, setPeriod2] = useState(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  const [data1, setData1] = useState<DashboardKPIs | null>(null);
  const [data2, setData2] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d1, d2] = await Promise.all([
        getDashboardKPIs({ month: period1 }),
        getDashboardKPIs({ month: period2 }),
      ]);
      setData1(d1);
      setData2(d2);
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao carregar comparativo.');
    } finally {
      setLoading(false);
    }
  }, [period1, period2]);

  useEffect(() => { load(); }, [load]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const rows = [
    { label: 'Gasto Total', key: 'totalValue', format: formatCurrency },
    { label: 'Litros', key: 'totalLiters', format: (v: number) => `${formatNumber(v, 2)} L` },
    { label: 'Abastecimentos', key: 'totalRefuels', format: (v: number) => formatNumber(v, 0) },
    { label: 'Preço Médio/L', key: 'avgUnitPrice', format: (v: number) => `R$ ${formatNumber(v, 3)}` },
    { label: 'Média km/L', key: 'avgKmL', format: (v: number) => `${formatNumber(v, 2)} km/L` },
    { label: 'Custo Médio/Abast.', key: 'avgCostPerRefuel', format: formatCurrency },
  ] as const;

  const periodLabel = (p: string) => {
    const [y, m] = p.split('-');
    return `${MONTHS.find((mo) => mo.value === m)?.label ?? m}/${y}`;
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap gap-4 p-5 rounded-2xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-blue-400">Período 1:</span>
          <select value={period1.split('-')[0]} onChange={(e) => setPeriod1(`${e.target.value}-${period1.split('-')[1]}`)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer" style={selectStyle}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={period1.split('-')[1]} onChange={(e) => setPeriod1(`${period1.split('-')[0]}-${e.target.value}`)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer" style={selectStyle}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <ArrowRightLeft size={18} className="text-slate-500 self-center" />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: '#f59e0b' }}>Período 2:</span>
          <select value={period2.split('-')[0]} onChange={(e) => setPeriod2(`${e.target.value}-${period2.split('-')[1]}`)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer" style={selectStyle}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={period2.split('-')[1]} onChange={(e) => setPeriod2(`${period2.split('-')[0]}-${e.target.value}`)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer" style={selectStyle}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full data-table">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-3">Indicador</th>
              <th className="text-right px-4 py-3 text-blue-400">{periodLabel(period1)}</th>
              <th className="text-right px-4 py-3 text-amber-400">{periodLabel(period2)}</th>
              <th className="text-right px-4 py-3">Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const v1 = data1?.[row.key] ?? 0;
              const v2 = data2?.[row.key] ?? 0;
              const variation = calcVariation(v1, v2);
              const isPositive = variation >= 0;
              const isCost = ['totalValue', 'avgUnitPrice', 'avgCostPerRefuel'].includes(row.key);
              const isGood = isCost ? !isPositive : isPositive;

              return (
                <tr key={row.key} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-blue-400">
                    {loading ? <Skeleton className="h-5 w-20 ml-auto" /> : row.format(v1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-amber-400">
                    {loading ? <Skeleton className="h-5 w-20 ml-auto" /> : row.format(v2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {loading ? <Skeleton className="h-5 w-16 ml-auto" /> : (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: isGood ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: isGood ? '#10b981' : '#ef4444',
                        }}
                      >
                        {formatVariation(variation)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// DIÁRIO
// ============================================================
function DiarioTab() {
  const [period, setPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getDailyStats(period));
    } catch (err) { console.error(err); toast.error('Erro ao carregar dados diários.'); } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const totalValue = stats.reduce((acc, curr) => acc + curr.totalValue, 0);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#8b5cf6'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
    xaxis: {
      categories: stats.map(s => s.dayLabel),
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `R$ ${formatNumber(v / 1000, 1)}k` } },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select value={period.split('-')[0]} onChange={(e) => setPeriod(`${e.target.value}-${period.split('-')[1]}`)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={period.split('-')[1]} onChange={(e) => setPeriod(`${period.split('-')[0]}-${e.target.value}`)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total no Mês</p>
          <p className="text-xl font-bold" style={{ color: '#8b5cf6' }}>{formatCurrency(totalValue)}</p>
        </div>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {loading ? <Skeleton className="h-72" /> : (
          <ApexChart type="area" height={280} series={[{ name: 'Gasto', data: stats.map((m) => Math.round(m.totalValue)) }]} options={chartOptions} />
        )}
      </div>
      
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full data-table">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-3">Dia</th>
              <th className="text-right px-4 py-3">Gasto</th>
              <th className="text-right px-4 py-3">Litros</th>
              <th className="text-right px-4 py-3">Preço Médio</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t"><td colSpan={4} className="px-4 py-3 text-center text-sm text-slate-500">Carregando...</td></tr>
            ) : (
              stats.map((s) => (
                <tr key={s.date} className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)', opacity: s.totalRefuels === 0 ? 0.4 : 1 }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.date.split('-').reverse().join('/')}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.totalRefuels > 0 ? formatCurrency(s.totalValue) : '—'}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{s.totalRefuels > 0 ? `${formatNumber(s.totalLiters, 0)} L` : '—'}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{s.totalRefuels > 0 ? `R$ ${formatNumber(s.avgUnitPrice, 3)}` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// VISÃO MENSAL (Month by Month of a Year)
// ============================================================
function MensalTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getMonthlyStats(year));
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao carregar visão mensal.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const totalYear = stats.reduce((s, m) => s + m.totalValue, 0);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#3b82f6'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
    xaxis: {
      categories: MONTHS_SHORT,
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `R$ ${formatNumber(v / 1000, 0)}k` } },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total {year}</p>
          <p className="text-xl font-bold" style={{ color: '#60a5fa' }}>{formatCurrency(totalYear)}</p>
        </div>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {loading ? <Skeleton className="h-72" /> : (
          <ApexChart type="bar" height={280}
            series={[{ name: 'Gasto', data: stats.map((m) => Math.round(m.totalValue)) }]}
            options={chartOptions}
          />
        )}
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full data-table">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-3">Mês</th>
              <th className="text-right px-4 py-3">Gasto</th>
              <th className="text-right px-4 py-3">Litros</th>
              <th className="text-right px-4 py-3">Abast.</th>
              <th className="text-right px-4 py-3">Preço Médio</th>
              <th className="text-right px-4 py-3">km/L</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-5" /></td>
                ))}</tr>
              ))
            ) : (
              stats.map((m) => (
                <tr key={m.month} className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)', opacity: m.totalRefuels === 0 ? 0.4 : 1 }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {MONTHS.find((mo) => m.month.endsWith(`-${mo.value}`))?.label} {year}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {m.totalRefuels > 0 ? formatCurrency(m.totalValue) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {m.totalRefuels > 0 ? `${formatNumber(m.totalLiters, 0)} L` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {m.totalRefuels > 0 ? m.totalRefuels : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {m.totalRefuels > 0 ? `R$ ${formatNumber(m.avgUnitPrice, 3)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {m.totalRefuels > 0 ? `${formatNumber(m.avgKmL, 2)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// VISÃO ANUAL (Year by Year)
// ============================================================
function AnualTab() {
  const [stats, setStats] = useState<YearlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getYearlyStats());
    } catch (err) { console.error(err); toast.error('Erro ao carregar dados anuais.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalValue = stats.reduce((acc, curr) => acc + curr.totalValue, 0);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#0ea5e9'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '40%' } },
    xaxis: {
      categories: stats.map(s => s.year),
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `R$ ${formatNumber(v / 1000, 1)}k` } },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Análise Histórica Anual</h2></div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gasto Total Global</p>
          <p className="text-xl font-bold" style={{ color: '#0ea5e9' }}>{formatCurrency(totalValue)}</p>
        </div>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {loading ? <Skeleton className="h-72" /> : (
          <ApexChart type="bar" height={280} series={[{ name: 'Gasto', data: stats.map((m) => Math.round(m.totalValue)) }]} options={chartOptions} />
        )}
      </div>
      
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full data-table">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-3">Ano</th>
              <th className="text-right px-4 py-3">Gasto Total</th>
              <th className="text-right px-4 py-3">Total Litros</th>
              <th className="text-right px-4 py-3">Média km/L</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t"><td colSpan={4} className="px-4 py-3 text-center text-sm text-slate-500">Carregando...</td></tr>
            ) : (
              stats.map((s) => (
                <tr key={s.year} className="border-t transition-colors cursor-pointer hover:bg-white/2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.year}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(s.totalValue)}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatNumber(s.totalLiters, 0)} L</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatNumber(s.avgKmL, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// POR POSTO
// ============================================================
function PostosTab() {
  const [stats, setStats] = useState<StationStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getStationStats({}));
    } catch (err) { console.error(err); toast.error('Erro ao carregar dados de postos.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Top 10 for chart
  const top10 = stats.slice(0, 10);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#f59e0b'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
    xaxis: {
      categories: top10.map(s => s.stationName.length > 20 ? s.stationName.substring(0, 20) + '...' : s.stationName),
      labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `R$ ${formatNumber(v / 1000, 0)}k` },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 } }
    },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top 10 Postos (Maior Gasto)</h3>
        {loading ? <Skeleton className="h-72" /> : (
          <ApexChart type="bar" height={320} series={[{ name: 'Gasto', data: top10.map((m) => Math.round(m.totalValue)) }]} options={chartOptions} />
        )}
      </div>
      
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full data-table">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-3">Posto</th>
              <th className="text-left px-4 py-3">Cidade</th>
              <th className="text-right px-4 py-3">Abastecimentos</th>
              <th className="text-right px-4 py-3">Litros</th>
              <th className="text-right px-4 py-3">Preço Médio/L</th>
              <th className="text-right px-4 py-3">Gasto Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t"><td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">Carregando...</td></tr>
            ) : (
              stats.map((s) => (
                <tr key={s.stationId} className="border-t transition-colors cursor-pointer hover:bg-white/2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.stationName}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{s.city}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{s.totalRefuels}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatNumber(s.totalLiters, 0)} L</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>R$ {formatNumber(s.avgUnitPrice, 3)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: '#f59e0b' }}>{formatCurrency(s.totalValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// POR VEÍCULO
// ============================================================
function VeiculosTab() {
  const [stats, setStats] = useState<VehicleStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getVehicleStats({}));
    } catch (err) { console.error(err); toast.error('Erro ao carregar dados de veículos.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Top 10 for chart
  const top10 = stats.slice(0, 10);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#ef4444'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
    xaxis: {
      categories: top10.map(s => s.vehiclePlate),
      labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `R$ ${formatNumber(v / 1000, 0)}k` },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 } }
    },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Top 10 Veículos (Maior Gasto)</h3>
        {loading ? <Skeleton className="h-72" /> : (
          <ApexChart type="bar" height={320} series={[{ name: 'Gasto', data: top10.map((m) => Math.round(m.totalValue)) }]} options={chartOptions} />
        )}
      </div>
      
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full data-table">
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th className="text-left px-4 py-3">Placa</th>
              <th className="text-left px-4 py-3">Modelo</th>
              <th className="text-left px-4 py-3">Filial</th>
              <th className="text-right px-4 py-3">Litros</th>
              <th className="text-right px-4 py-3">Média km/L</th>
              <th className="text-right px-4 py-3">Gasto Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t"><td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">Carregando...</td></tr>
            ) : (
              stats.map((s) => (
                <tr key={s.vehicleId} className="border-t transition-colors cursor-pointer hover:bg-white/2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.vehiclePlate} {s.vehiclePrefix ? `(${s.vehiclePrefix})` : ''}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{s.vehicleModel}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{s.vehicleBranch}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatNumber(s.totalLiters, 0)} L</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatNumber(s.avgKmL, 2)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: '#ef4444' }}>{formatCurrency(s.totalValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// MAIN REPORTS PAGE
// ============================================================
export default function RelatoriosPage() {
  const [tab, setTab] = useState<Tab>('comparativo');

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Relatórios Avançados</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Análises multidimensionais de consumo e gastos da frota
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === 'comparativo'} onClick={() => setTab('comparativo')} icon={ArrowRightLeft} label="Comparativo" />
        <TabBtn active={tab === 'diario'} onClick={() => setTab('diario')} icon={CalendarDays} label="Dia a Dia" />
        <TabBtn active={tab === 'mensal'} onClick={() => setTab('mensal')} icon={Calendar} label="Mês a Mês" />
        <TabBtn active={tab === 'anual'} onClick={() => setTab('anual')} icon={History} label="Ano a Ano" />
        <TabBtn active={tab === 'postos'} onClick={() => setTab('postos')} icon={MapPin} label="Por Posto" />
        <TabBtn active={tab === 'veiculos'} onClick={() => setTab('veiculos')} icon={Car} label="Por Veículo" />
      </div>

      <div className="pt-2">
        {tab === 'comparativo' && <ComparativoTab />}
        {tab === 'diario' && <DiarioTab />}
        {tab === 'mensal' && <MensalTab />}
        {tab === 'anual' && <AnualTab />}
        {tab === 'postos' && <PostosTab />}
        {tab === 'veiculos' && <VeiculosTab />}
      </div>
    </div>
  );
}
