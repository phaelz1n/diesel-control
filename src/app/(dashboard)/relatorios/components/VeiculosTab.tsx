import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { getVehicleStats } from '@/services/refuels';
import { VehicleStats } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { Skeleton } from '@/components/ui/Skeleton';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function VeiculosTab() {
  const [stats, setStats] = useState<VehicleStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getVehicleStats({}));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de veículos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalValue = stats.reduce((acc, curr) => acc + curr.totalValue, 0);
  const totalLiters = stats.reduce((acc, curr) => acc + curr.totalLiters, 0);

  const handleExportPDF = () => {
    if (stats.length === 0) {
      toast.error('Nenhum dado de veículos para exportar.');
      return;
    }
    const columns = ['Placa', 'Modelo', 'Filial', 'Litros', 'Média km/L', 'Gasto Total'];
    const rows = stats.map((v) => [
      v.vehiclePlate,
      v.vehicleModel,
      v.vehicleBranch,
      `${formatNumber(v.totalLiters, 0)} L`,
      `${formatNumber(v.avgKmL, 2)}`,
      formatCurrency(v.totalValue),
    ]);
    const foot = [
      [
        'Total',
        `${stats.length} veículos`,
        '—',
        `${formatNumber(totalLiters, 0)} L`,
        '—',
        formatCurrency(totalValue),
      ],
    ];
    exportToPDF(
      'Relatório de Consumo por Veículo da Frota',
      columns,
      rows,
      'relatorio_veiculos_frota',
      {
        subtitle: 'Ranking de consumo, eficiência e gastos por veículo',
        summaryInfo: [
          { label: 'Gasto Total da Frota', value: formatCurrency(totalValue) },
          { label: 'Litros Totais', value: `${formatNumber(totalLiters, 0)} L` },
        ],
        foot,
      }
    );
  };

  const top10 = stats.slice(0, 10);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#ef4444'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
    xaxis: {
      categories: top10.map((s) => s.vehiclePlate),
      labels: {
        style: { colors: '#64748b', fontSize: '11px' },
        formatter: (v: number) => `R$ ${formatNumber(v / 1000, 0)}k`,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 } },
    },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Consumo e Eficiência por Veículo
        </h3>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all self-start sm:self-auto"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
          title="Exportar Relatório de Veículos em PDF"
        >
          <FileText size={15} className="text-rose-400" />
          <span>Exportar PDF</span>
        </button>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Top 10 Veículos (Maior Gasto)
        </h4>
        {loading ? (
          <Skeleton className="h-72" />
        ) : (
          <ApexChart
            type="bar"
            height={320}
            series={[{ name: 'Gasto', data: top10.map((m) => Math.round(m.totalValue)) }]}
            options={chartOptions}
          />
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
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : (
              stats.map((s) => (
                <tr
                  key={s.vehicleId}
                  className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {s.vehiclePlate} {s.vehiclePrefix ? `(${s.vehiclePrefix})` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.vehicleModel}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.vehicleBranch}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(s.totalLiters, 0)} L
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(s.avgKmL, 2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: '#ef4444' }}>
                    {formatCurrency(s.totalValue)}
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
