import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { getStationStats } from '@/services/refuels';
import { StationStats } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { Skeleton } from '@/components/ui/Skeleton';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function PostosTab() {
  const [stats, setStats] = useState<StationStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getStationStats({}));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de postos.');
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
      toast.error('Nenhum dado de postos para exportar.');
      return;
    }
    const columns = ['Posto', 'Cidade', 'Abastecimentos', 'Litros', 'Preço Médio/L', 'Gasto Total'];
    const rows = stats.map((s) => [
      s.stationName,
      s.city,
      s.totalRefuels,
      `${formatNumber(s.totalLiters, 0)} L`,
      `R$ ${formatNumber(s.avgUnitPrice, 3)}`,
      formatCurrency(s.totalValue),
    ]);
    const foot = [
      [
        'Total',
        `${stats.length} postos`,
        stats.reduce((acc, curr) => acc + curr.totalRefuels, 0),
        `${formatNumber(totalLiters, 0)} L`,
        totalLiters > 0 ? `R$ ${formatNumber(totalValue / totalLiters, 3)}` : '—',
        formatCurrency(totalValue),
      ],
    ];
    exportToPDF(
      'Relatório de Consumo por Posto de Combustível',
      columns,
      rows,
      'relatorio_postos_combustivel',
      {
        subtitle: 'Ranking e análise de volume, preço e gastos por posto',
        summaryInfo: [
          { label: 'Total Geral', value: formatCurrency(totalValue) },
          { label: 'Volume Total', value: `${formatNumber(totalLiters, 0)} L` },
        ],
        foot,
      }
    );
  };

  const top10 = stats.slice(0, 10);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#f59e0b'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%' } },
    xaxis: {
      categories: top10.map((s) =>
        s.stationName.length > 20 ? s.stationName.substring(0, 20) + '...' : s.stationName
      ),
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
          Consumo e Gastos por Posto
        </h3>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all self-start sm:self-auto"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
          title="Exportar Relatório de Postos em PDF"
        >
          <FileText size={15} className="text-amber-400" />
          <span>Exportar PDF</span>
        </button>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Top 10 Postos (Maior Gasto)
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
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-3 text-center text-sm text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : (
              stats.map((s) => (
                <tr
                  key={s.stationId}
                  className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {s.stationName}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.city}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.totalRefuels}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(s.totalLiters, 0)} L
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    R$ {formatNumber(s.avgUnitPrice, 3)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: '#f59e0b' }}>
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
