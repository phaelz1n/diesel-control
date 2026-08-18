'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  DollarSign, Droplets, Fuel, TrendingUp, Activity, BarChart3,
  RefreshCw, ChevronRight, AlertTriangle, Calendar, FileText
} from 'lucide-react';
import { getDashboardKPIs, getMonthlyStats, getStationStats, getVehicleStats, getRefuels, getRefuelsForPeriod } from '@/services/refuels';
import { DashboardKPIs, MonthlyStats, StationStats, VehicleStats, Refuel, DashboardFilters } from '@/lib/types';
import { formatCurrency, formatNumber, formatLiters, formatKmL, formatDateTime, calcVariation, formatVariation, cn } from '@/lib/utils';
import { MONTHS, YEARS, MONTHS_SHORT } from '@/lib/constants';
import { collection, getDocs } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase/firestore';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { KPICard } from '@/components/ui/KPICard';
import { Skeleton } from '@/components/ui/Skeleton';
import { FilterBar } from '@/components/filters/FilterBar';
import Link from 'next/link';

// Lazy load charts (ApexCharts requires browser)
const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

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

  const loadData = useCallback(async () => {
    try {
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

  const handleExportDashboardPDF = () => {
    if (!kpis) return;
    const columns = ['Métrica / Indicador', 'Valor no Período'];
    const rows = [
      ['Saída Financeira Real (NFs + Vibra)', formatCurrency(kpis.totalSpent)],
      ['Custo de Consumo (Abastecimentos)', formatCurrency(kpis.totalValue)],
      ['Litros Abastecidos na Frota', formatLiters(kpis.totalLiters)],
      ['Quantidade de Abastecimentos', `${formatNumber(kpis.totalRefuels, 0)} abastecimentos`],
      ['Preço Médio por Litro', `R$ ${formatNumber(kpis.avgUnitPrice, 3)}/L`],
      ['Média de Eficiência da Frota', `${formatNumber(kpis.avgKmL, 2)} km/L`],
    ];

    exportToPDF(
      `Relatório Executivo DieselControl - ${monthLabel} ${filters.year}`,
      columns,
      rows,
      `dashboard_executivo_${filters.month || filters.year}`,
      {
        subtitle: `Demonstrativo gerencial de frota e combustível (${monthLabel}/${filters.year})`,
        summaryInfo: [
          { label: 'Saída Real de Caixa', value: formatCurrency(kpis.totalSpent) },
          { label: 'Litros Abastecidos', value: formatLiters(kpis.totalLiters) },
          { label: 'Consumo Médio', value: `${formatNumber(kpis.avgKmL, 2)} km/L` },
        ],
      }
    );
  };

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

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <FilterBar filters={filters} onChange={setFilters} />
          <button
            onClick={handleExportDashboardPDF}
            disabled={loading || !kpis}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Exportar Resumo Executivo em PDF"
          >
            <FileText size={15} className="text-blue-400" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="Atualizar dados"
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
