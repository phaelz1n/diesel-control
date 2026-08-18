import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { getYearlyStats } from '@/services/refuels';
import { YearlyStats } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { Skeleton } from '@/components/ui/Skeleton';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function AnualTab() {
  const [stats, setStats] = useState<YearlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getYearlyStats());
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados anuais.');
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
      toast.error('Nenhum dado anual para exportar.');
      return;
    }
    const columns = ['Ano', 'Gasto Total', 'Total Litros', 'Média km/L'];
    const rows = stats.map((s) => [
      s.year,
      formatCurrency(s.totalValue),
      `${formatNumber(s.totalLiters, 0)} L`,
      formatNumber(s.avgKmL, 2),
    ]);
    const foot = [
      [
        'Total Global',
        formatCurrency(totalValue),
        `${formatNumber(totalLiters, 0)} L`,
        '—',
      ],
    ];
    exportToPDF(
      'Análise Histórica Anual de Frota e Combustível',
      columns,
      rows,
      'relatorio_historico_anual',
      {
        subtitle: 'Demonstrativo anual consolidado multi-ano',
        summaryInfo: [
          { label: 'Gasto Total Global', value: formatCurrency(totalValue) },
          { label: 'Volume Total', value: `${formatNumber(totalLiters, 0)} L` },
        ],
        foot,
      }
    );
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#0ea5e9'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '40%' } },
    xaxis: {
      categories: stats.map((s) => s.year),
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '11px' },
        formatter: (v: number) => `R$ ${formatNumber(v / 1000, 1)}k`,
      },
    },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Análise Histórica Anual
          </h2>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Exportar Análise Anual em PDF"
          >
            <FileText size={14} className="text-cyan-400" />
            <span>Exportar PDF</span>
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Gasto Total Global
          </p>
          <p className="text-xl font-bold" style={{ color: '#0ea5e9' }}>
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {loading ? (
          <Skeleton className="h-72" />
        ) : (
          <ApexChart
            type="bar"
            height={280}
            series={[{ name: 'Gasto', data: stats.map((m) => Math.round(m.totalValue)) }]}
            options={chartOptions}
          />
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
              <tr className="border-t">
                <td colSpan={4} className="px-4 py-3 text-center text-sm text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : (
              stats.map((s) => (
                <tr
                  key={s.year}
                  className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {s.year}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(s.totalValue)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(s.totalLiters, 0)} L
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(s.avgKmL, 2)}
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
