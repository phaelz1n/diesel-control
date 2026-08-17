'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Edit2, Fuel, TrendingUp, Activity, DollarSign } from 'lucide-react';
import { getVehicleById } from '@/services/vehicles';
import { getRefuelsForPeriod, getMonthlyStats } from '@/services/refuels';
import { Vehicle, Refuel, MonthlyStats } from '@/lib/types';
import { formatCurrency, formatNumber, formatDateTime, formatOdometer, cn } from '@/lib/utils';
import { MONTHS_SHORT } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="kpi-card">
      <p className="text-2xl font-bold mb-1" style={{ color }}>{value}</p>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canEdit } = usePermissions();
  const vehicleId = params.id as string;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [refuels, setRefuels] = useState<Refuel[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [v, r, monthly] = await Promise.all([
          getVehicleById(vehicleId),
          getRefuelsForPeriod({ vehicleId, year }),
          getMonthlyStats(year, { vehicleId }),
        ]);
        setVehicle(v);
        setRefuels(r);
        setMonthlyStats(monthly);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vehicleId, year]);

  const totalLiters = refuels.reduce((s, r) => s + r.liters, 0);
  const totalValue = refuels.reduce((s, r) => s + r.totalValue, 0);
  const totalKm = refuels.reduce((s, r) => s + r.kmTraveled, 0);
  const avgKmL = totalLiters > 0 ? totalKm / totalLiters : 0;

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#3b82f6', '#10b981'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    xaxis: {
      categories: MONTHS_SHORT,
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      { labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `R$ ${formatNumber(v / 1000, 0)}k` } },
      { opposite: true, labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v: number) => `${formatNumber(v, 0)} L` } },
    ],
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    legend: { labels: { colors: '#94a3b8' } },
    tooltip: { theme: 'dark' },
  };

  const series = [
    { name: 'Gasto (R$)', data: monthlyStats.map((m) => Math.round(m.totalValue)) },
    { name: 'Litros', data: monthlyStats.map((m) => Math.round(m.totalLiters)), type: 'line' },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!vehicle) return (
    <div className="page-container">
      <p style={{ color: 'var(--text-muted)' }}>Veículo não encontrado.</p>
    </div>
  );

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 mt-1"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{vehicle.plate}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {vehicle.model} · Prefixo {vehicle.prefix} · {vehicle.branchName}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Hodômetro atual: {formatOdometer(vehicle.currentOdometer)}</span>
              <span>·</span>
              <span>{vehicle.fuelType}</span>
            </div>
          </div>
        </div>
        {canEdit && (
          <Link
            href={`/veiculos/${vehicleId}/editar`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <Edit2 size={15} /> Editar
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Abastecimentos" value={formatNumber(refuels.length, 0)} color="#3b82f6" />
        <StatCard label="Litros ({year})" value={`${formatNumber(totalLiters, 0)} L`} color="#10b981" />
        <StatCard label={`Gasto (${year})`} value={formatCurrency(totalValue)} color="#f59e0b" />
        <StatCard label="Média km/L" value={formatNumber(avgKmL, 2)} color="#8b5cf6" />
      </div>

      {/* Monthly chart */}
      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Histórico {year}</h2>
        <ApexChart type="bar" series={series} options={chartOptions} height={300} />
      </div>

      {/* Recent refuels */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Abastecimentos ({year}) — {refuels.length} registros
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[700px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Posto</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Hodôm. Atual</th>
                <th className="text-right px-4 py-3">km/L</th>
              </tr>
            </thead>
            <tbody>
              {refuels.slice(0, 50).map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(r.date)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{r.stationName}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatNumber(r.liters, 2)} L</td>
                  <td className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.totalValue)}</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatOdometer(r.currentOdometer)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: r.avgKmL >= 5 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        color: r.avgKmL >= 5 ? '#10b981' : '#f59e0b',
                      }}>
                      {formatNumber(r.avgKmL, 2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
