'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  DollarSign, Droplets, Fuel, TrendingUp, Activity, BarChart3,
  RefreshCw, ChevronRight, AlertTriangle, Calendar,
} from 'lucide-react';
import { getDashboardKPIs, getMonthlyStats, getStationStats, getVehicleStats, getRefuels, getRefuelsForPeriod } from '@/services/refuels';
import { DashboardKPIs, MonthlyStats, StationStats, VehicleStats, Refuel, DashboardFilters } from '@/lib/types';
import { formatCurrency, formatNumber, formatLiters, formatKmL, formatDateTime, calcVariation, formatVariation, cn } from '@/lib/utils';
import { MONTHS, YEARS, MONTHS_SHORT } from '@/lib/constants';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase/firestore';
import Link from 'next/link';

// Lazy load charts (ApexCharts requires browser)
const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ============================================================
// KPI CARD
// ============================================================
interface KPICardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  trend?: number;
}

function KPICard({ title, value, icon: Icon, color, subtitle, trend }: KPICardProps) {
  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              trend >= 0 ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'
            )}
          >
            {formatVariation(trend)}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
        {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ============================================================
// SKELETON
// ============================================================
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

// ============================================================
// FILTER BAR
// ============================================================
interface FilterBarProps {
  filters: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
}

function FilterBar({ filters, onChange }: FilterBarProps) {
  const currentYear = new Date().getFullYear();

  const selectStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as React.CSSProperties;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Calendar size={15} />
        <span>Período:</span>
      </div>
      <select
        value={filters.year ?? currentYear}
        onChange={(e) => onChange({ ...filters, year: Number(e.target.value), month: undefined })}
        className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
        style={selectStyle}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select
        value={filters.month ?? ''}
        onChange={(e) => onChange({ ...filters, month: e.target.value || undefined })}
        className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
        style={selectStyle}
      >
        <option value="">Todos os meses</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={`${filters.year ?? currentYear}-${m.value}`}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================
// CHART: GASTOS/LITROS MENSAIS
// ============================================================
function MonthlyChart({ data, type }: { data: MonthlyStats[]; type: 'value' | 'liters' }) {
  const isDark = true;
  const series = [{
    name: type === 'value' ? 'Gasto (R$)' : 'Litros',
    data: data.map((d) => type === 'value' ? Math.round(d.totalValue) : Math.round(d.totalLiters * 100) / 100),
  }];

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      background: 'transparent',
      toolbar: { show: false },
      sparkline: { enabled: false },
    },
    theme: { mode: 'dark' },
    colors: [type === 'value' ? '#3b82f6' : '#10b981'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.01,
        stops: [0, 100],
      },
    },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: MONTHS_SHORT,
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '11px' },
        formatter: (v: number) =>
          type === 'value' ? `R$ ${formatNumber(v / 1000, 0)}k` : `${formatNumber(v, 0)} L`,
      },
    },
    grid: {
      borderColor: '#1f2d4a',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (v: number) =>
          type === 'value' ? formatCurrency(v) : formatLiters(v),
      },
    },
  };

  return (
    <div className="chart-container">
      <ApexChart type="area" series={series} options={options} height={280} />
    </div>
  );
}

// ============================================================
// STATION RANKING TABLE
// ============================================================
function StationRankingTable({ data }: { data: StationStats[] }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full data-table">
        <thead>
          <tr style={{ background: 'var(--bg-card)' }}>
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Posto</th>
            <th className="text-right px-4 py-3">Litros</th>
            <th className="text-right px-4 py-3">Gasto</th>
            <th className="text-right px-4 py-3">Preço médio</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((s, i) => (
            <tr key={s.stationId} className="border-t transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
              <td className="px-4 py-3 text-sm font-bold" style={{ color: i < 3 ? '#3b82f6' : 'var(--text-muted)' }}>
                {i + 1}
              </td>
              <td className="px-4 py-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.stationName}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.city} · {s.totalRefuels} abast.</p>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatNumber(s.totalLiters, 0)} L
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(s.totalValue)}
              </td>
              <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                R$ {formatNumber(s.avgUnitPrice, 3)}/L
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// VEHICLE RANKING TABLE
// ============================================================
function VehicleRankingTable({ data }: { data: VehicleStats[] }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full data-table">
        <thead>
          <tr style={{ background: 'var(--bg-card)' }}>
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Veículo</th>
            <th className="text-right px-4 py-3">Litros</th>
            <th className="text-right px-4 py-3">Gasto</th>
            <th className="text-right px-4 py-3">km/L</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((v, i) => (
            <tr key={v.vehicleId} className="border-t transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
              <td className="px-4 py-3 text-sm font-bold" style={{ color: i < 3 ? '#3b82f6' : 'var(--text-muted)' }}>
                {i + 1}
              </td>
              <td className="px-4 py-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.vehiclePlate}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.vehicleModel} · {v.vehiclePrefix}</p>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatNumber(v.totalLiters, 0)} L
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(v.totalValue)}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: v.avgKmL >= 5 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: v.avgKmL >= 5 ? '#10b981' : '#f59e0b',
                  }}
                >
                  {formatNumber(v.avgKmL, 2)} km/L
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// RECENT REFUELS
// ============================================================
function RecentRefuels({ data }: { data: Refuel[] }) {
  return (
    <div className="space-y-2">
      {data.slice(0, 6).map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between p-3 rounded-xl transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(59,130,246,0.1)' }}
            >
              <Fuel size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.vehiclePlate} · {r.vehicleModel}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {r.stationName} · {formatDateTime(r.date)}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(r.totalValue)}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatNumber(r.liters, 0)} L
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD PAGE
// ============================================================
export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [filters, setFilters] = useState<DashboardFilters>({
    year: currentYear,
    month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
  });

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [stationStats, setStationStats] = useState<StationStats[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [recentRefuels, setRecentRefuels] = useState<Refuel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugDb, setDebugDb] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja apagar TODOS os 891 registros do banco de dados para importar do zero?')) return;
    setIsDeleting(true);
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.REFUELS));
      let batch = writeBatch(db);
      let count = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 500 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      if (count % 500 !== 0) {
        await batch.commit();
      }
      alert('Banco limpo com sucesso! Agora você pode fazer a importação novamente.');
      window.location.reload();
    } catch (e) {
      alert('Erro ao apagar: ' + String(e));
    }
    setIsDeleting(false);
  };

  const loadData = useCallback(async () => {
    try {
      // DEBUG: Count all refuels by month
      const snap = await getDocs(collection(db, COLLECTIONS.REFUELS));
      const months: any = {};
      snap.forEach(d => {
        const m = d.data().month || 'NO_MONTH';
        months[m] = (months[m] || 0) + 1;
      });
      setDebugDb(months);

      const refuelFilters = {
        year: filters.year,
        month: filters.month,
      };

      const [kpiData, stationsData, vehiclesData, recentRefuelsData, monthlyData] = await Promise.all([
        getDashboardKPIs(refuelFilters),
        getStationStats(refuelFilters),
        getVehicleStats(refuelFilters),
        getRefuelsForPeriod(refuelFilters),
        getMonthlyStats(filters.year ?? currentYear),
      ]);

      setKpis(kpiData);
      setStationStats(stationsData);
      setVehicleStats(vehiclesData);
      setRecentRefuels(recentRefuelsData.slice(0, 6));
      setMonthlyStats(monthlyData);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, currentYear]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const monthLabel = filters.month
    ? MONTHS.find((m) => filters.month?.endsWith(`-${m.value}`))?.label ?? 'Mês'
    : 'Ano';

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Gastos com Diesel
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {monthLabel} {filters.year} · Visão gerencial
          </p>
        </div>

        {debugDb && (
          <div className="bg-red-900/50 border border-red-500 text-white p-4 rounded-xl mb-4 font-mono text-sm">
            <strong>DEBUG BANCO DE DADOS:</strong><br/>
            Total de registros por mês em todo o banco:<br/>
            {JSON.stringify(debugDb, null, 2)}
            
            <div className="mt-4 pt-4 border-t border-red-500">
              <p className="mb-2">Parece que os dados estão espalhados por todos os meses devido ao bug do navegador.</p>
              <button 
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold"
              >
                {isDeleting ? 'Apagando...' : 'APAGAR TUDO PARA IMPORTAR DO ZERO'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <FilterBar filters={filters} onChange={setFilters} />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))
        ) : kpis ? (
          <>
            <KPICard
              title="Saída de Caixa (NFs + Vibra)"
              value={formatCurrency(kpis.totalSpent)}
              icon={DollarSign}
              color="#ef4444"
              subtitle="Custo financeiro real"
            />
            <KPICard
              title="Custo de Consumo"
              value={formatCurrency(kpis.totalValue)}
              icon={BarChart3}
              color="#3b82f6"
              subtitle="Baseado em abastecimentos"
            />
            <KPICard
              title="Litros Abastecidos"
              value={formatLiters(kpis.totalLiters)}
              icon={Droplets}
              color="#10b981"
            />
            <KPICard
              title="Abastecimentos"
              value={formatNumber(kpis.totalRefuels, 0)}
              icon={Fuel}
              color="#f59e0b"
            />
            <KPICard
              title="Preço Médio"
              value={`R$ ${formatNumber(kpis.avgUnitPrice, 3)}/L`}
              icon={TrendingUp}
              color="#8b5cf6"
            />
            <KPICard
              title="Média Geral (Frota)"
              value={formatKmL(kpis.avgKmL)}
              icon={Activity}
              color="#06b6d4"
            />
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Gastos mensais */}
        <div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Gastos Mensais
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{filters.year}</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <MonthlyChart data={monthlyStats} type="value" />
          )}
        </div>

        {/* Litros mensais */}
        <div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Litros por Mês
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{filters.year}</p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <MonthlyChart data={monthlyStats} type="liters" />
          )}
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Station ranking */}
        <div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ranking de Postos
            </h3>
            <Link
              href="/postos"
              className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
              style={{ color: '#60a5fa' }}
            >
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <StationRankingTable data={stationStats} />
          )}
        </div>

        {/* Vehicle ranking */}
        <div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ranking de Veículos
            </h3>
            <Link
              href="/veiculos"
              className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
              style={{ color: '#60a5fa' }}
            >
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <VehicleRankingTable data={vehicleStats} />
          )}
        </div>
      </div>

      {/* Recent Refuels */}
      <div
        className="rounded-2xl p-6 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Últimos Abastecimentos
          </h3>
          <Link
            href="/abastecimentos"
            className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
            style={{ color: '#60a5fa' }}
          >
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentRefuels.length > 0 ? (
          <RecentRefuels data={recentRefuels} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Fuel size={40} className="text-blue-400/30" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Nenhum abastecimento no período selecionado.
            </p>
            <Link
              href="/abastecimentos/novo"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Lançar primeiro abastecimento →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
