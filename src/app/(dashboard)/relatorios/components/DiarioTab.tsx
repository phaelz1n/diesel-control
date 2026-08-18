import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { getDailyStats } from '@/services/refuels';
import { DailyStats } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { MONTHS, YEARS } from '@/lib/constants';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { Skeleton } from '@/components/ui/Skeleton';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function DiarioTab() {
  const [period, setPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getDailyStats(period));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados diários.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const totalValue = stats.reduce((acc, curr) => acc + curr.totalValue, 0);
  const totalLiters = stats.reduce((acc, curr) => acc + curr.totalLiters, 0);

  const handleExportPDF = () => {
    if (stats.length === 0) {
      toast.error('Nenhum dado diário para exportar.');
      return;
    }
    const [y, m] = period.split('-');
    const mLabel = MONTHS.find((mo) => mo.value === m)?.label ?? m;
    const columns = ['Data', 'Gasto Total', 'Litros', 'Preço Médio/L'];
    const rows = stats.map((s) => [
      s.date.split('-').reverse().join('/'),
      s.totalRefuels > 0 ? formatCurrency(s.totalValue) : 'R$ 0,00',
      s.totalRefuels > 0 ? `${formatNumber(s.totalLiters, 2)} L` : '0 L',
      s.totalRefuels > 0 ? `R$ ${formatNumber(s.avgUnitPrice, 3)}` : '—',
    ]);
    const foot = [
      [
        'Total do Mês',
        formatCurrency(totalValue),
        `${formatNumber(totalLiters, 2)} L`,
        totalLiters > 0 ? `R$ ${formatNumber(totalValue / totalLiters, 3)}` : '—',
      ],
    ];
    exportToPDF(
      `Relatório Diário de Abastecimentos - ${mLabel}/${y}`,
      columns,
      rows,
      `relatorio_diario_${period}`,
      {
        subtitle: `Evolução diária de abastecimentos e gastos (${mLabel}/${y})`,
        summaryInfo: [
          { label: 'Gasto Total', value: formatCurrency(totalValue) },
          { label: 'Litros Consumidos', value: `${formatNumber(totalLiters, 0)} L` },
        ],
        foot,
      }
    );
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
    theme: { mode: 'dark' },
    colors: ['#8b5cf6'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
    xaxis: {
      categories: stats.map((s) => s.dayLabel),
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
        <div className="flex items-center gap-2">
          <select
            value={period.split('-')[0]}
            onChange={(e) => setPeriod(`${e.target.value}-${period.split('-')[1]}`)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={period.split('-')[1]}
            onChange={(e) => setPeriod(`${period.split('-')[0]}-${e.target.value}`)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
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
            title="Exportar Diário em PDF"
          >
            <FileText size={15} className="text-purple-400" />
            <span>Exportar PDF</span>
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total no Mês
          </p>
          <p className="text-xl font-bold" style={{ color: '#8b5cf6' }}>
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {loading ? (
          <Skeleton className="h-72" />
        ) : (
          <ApexChart
            type="area"
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
              <th className="text-left px-4 py-3">Dia</th>
              <th className="text-right px-4 py-3">Gasto</th>
              <th className="text-right px-4 py-3">Litros</th>
              <th className="text-right px-4 py-3">Preço Médio</th>
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
                  key={s.date}
                  className="border-t transition-colors cursor-pointer hover:bg-white/2"
                  style={{ borderColor: 'var(--border-subtle)', opacity: s.totalRefuels === 0 ? 0.4 : 1 }}
                >
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {s.date.split('-').reverse().join('/')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {s.totalRefuels > 0 ? formatCurrency(s.totalValue) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.totalRefuels > 0 ? `${formatNumber(s.totalLiters, 0)} L` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.totalRefuels > 0 ? `R$ ${formatNumber(s.avgUnitPrice, 3)}` : '—'}
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
