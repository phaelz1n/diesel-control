'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  BarChart3, Download, TrendingUp, MapPin, Car, ArrowRightLeft, Calendar,
} from 'lucide-react';
import { getMonthlyStats, getStationStats, getVehicleStats, getDashboardKPIs } from '@/services/refuels';
import { MonthlyStats, StationStats, VehicleStats, DashboardKPIs, ComparisonData } from '@/lib/types';
import { formatCurrency, formatNumber, formatVariation, calcVariation, cn } from '@/lib/utils';
import { MONTHS, YEARS, MONTHS_SHORT } from '@/lib/constants';
import { exportToExcel, exportToPDF } from '@/lib/utils/exportUtils';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Tab = 'comparativo' | 'anual' | 'postos' | 'veiculos';

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
      {/* Period selectors */}
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

      {/* Comparison table */}
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
// VISÃO ANUAL
// ============================================================
function AnualTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getMonthlyStats(year));
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao carregar visão anual.');
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
// MAIN REPORTS PAGE
// ============================================================
export default function RelatoriosPage() {
  const [tab, setTab] = useState<Tab>('comparativo');

  return (
    <div className="page-container animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Relatórios</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Análises comparativas, visão anual e rankings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === 'comparativo'} onClick={() => setTab('comparativo')} icon={ArrowRightLeft} label="Comparativo" />
        <TabBtn active={tab === 'anual'} onClick={() => setTab('anual')} icon={Calendar} label="Visão Anual" />
        <TabBtn active={tab === 'postos'} onClick={() => setTab('postos')} icon={MapPin} label="Por Posto" />
        <TabBtn active={tab === 'veiculos'} onClick={() => setTab('veiculos')} icon={Car} label="Por Veículo" />
      </div>

      {tab === 'comparativo' && <ComparativoTab />}
      {tab === 'anual' && <AnualTab />}
      {tab === 'postos' && (
        <div className="flex items-center justify-center py-16">
          <p style={{ color: 'var(--text-muted)' }}>Use a página Postos para análise detalhada.</p>
        </div>
      )}
      {tab === 'veiculos' && (
        <div className="flex items-center justify-center py-16">
          <p style={{ color: 'var(--text-muted)' }}>Use a página Veículos para análise detalhada.</p>
        </div>
      )}
    </div>
  );
}
