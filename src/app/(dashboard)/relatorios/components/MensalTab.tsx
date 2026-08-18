import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { getMonthlyStats } from '@/services/refuels';
import { MonthlyStats } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { MONTHS, YEARS, MONTHS_SHORT } from '@/lib/constants';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { Skeleton } from '@/components/ui/Skeleton';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function MensalTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getMonthlyStats(year));
    } catch (err) {
      console.error('Erro detalhado:', err);
      toast.error('Erro ao carregar visão mensal.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const totalYear = stats.reduce((s, m) => s + m.totalValue, 0);
  const totalLitersYear = stats.reduce((s, m) => s + m.totalLiters, 0);

  const handleExportPDF = () => {
    if (stats.length === 0) {
      toast.error('Nenhum dado mensal para exportar.');
      return;
    }
    const columns = ['Mês', 'Gasto', 'Litros', 'Abastecimentos', 'Preço Médio/L', 'Consumo (km/L)'];
    const rows = stats.map((m) => {
      const label = MONTHS.find((mo) => m.month.endsWith(`-${mo.value}`))?.label || m.month;
      return [
        `${label}/${year}`,
        m.totalRefuels > 0 ? formatCurrency(m.totalValue) : 'R$ 0,00',
        m.totalRefuels > 0 ? `${formatNumber(m.totalLiters, 0)} L` : '0 L',
        m.totalRefuels > 0 ? m.totalRefuels : '0',
        m.totalRefuels > 0 ? `R$ ${formatNumber(m.avgUnitPrice, 3)}` : '—',
        m.totalRefuels > 0 ? `${formatNumber(m.avgKmL, 2)}` : '—',
      ];
    });
    const foot = [
      [
        `Total Acumulado ${year}`,
        formatCurrency(totalYear),
        `${formatNumber(totalLitersYear, 0)} L`,
        stats.reduce((s, m) => s + m.totalRefuels, 0),
        totalLitersYear > 0 ? `R$ ${formatNumber(totalYear / totalLitersYear, 3)}` : '—',
        '—',
      ],
    ];
    exportToPDF(
      `Relatório Mensal Consolidado - ${year}`,
      columns,
      rows,
      `relatorio_mensal_${year}`,
      {
        subtitle: `Demonstrativo mensal consolidado de combustível (${year})`,
        summaryInfo: [
          { label: 'Gasto Total', value: formatCurrency(totalYear) },
          { label: 'Volume Anual', value: `${formatNumber(totalLitersYear, 0)} L` },
        ],
        foot,
      }
    );
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#3b82f6'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '60%' } },
    xaxis: {
      categories: MONTHS_SHORT,
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '11px' },
        formatter: (v: number) => `R$ ${formatNumber(v / 1000, 0)}k`,
      },
    },
    grid: { borderColor: '#1f2d4a', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer font-bold"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Exportar Visão Mensal em PDF"
          >
            <FileText size={15} className="text-blue-400" />
            <span>Exportar PDF</span>
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total {year}
          </p>
          <p className="text-xl font-bold" style={{ color: '#60a5fa' }}>
            {formatCurrency(totalYear)}
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
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-5" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              stats.map((m) => (
                <tr
                  key={m.month}
                  className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)', opacity: m.totalRefuels === 0 ? 0.4 : 1 }}
                >
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
