import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, FileText } from 'lucide-react';
import { getDashboardKPIs } from '@/services/refuels';
import { DashboardKPIs } from '@/lib/types';
import { formatCurrency, formatNumber, formatVariation, calcVariation } from '@/lib/utils';
import { MONTHS, YEARS } from '@/lib/constants';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { Skeleton } from '@/components/ui/Skeleton';

export function ComparativoTab() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [period1, setPeriod1] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [period2, setPeriod2] = useState(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  const [data1, setData1] = useState<DashboardKPIs | null>(null);
  const [data2, setData2] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        getDashboardKPIs({ month: period1 }),
        getDashboardKPIs({ month: period2 }),
      ]);
      setData1(r1);
      setData2(r2);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar comparativo.');
    } finally {
      setLoading(false);
    }
  }, [period1, period2]);

  useEffect(() => {
    load();
  }, [load]);

  const rows: { label: string; key: keyof DashboardKPIs; format: (v: number) => string }[] = [
    { label: 'Gasto Total', key: 'totalValue', format: formatCurrency },
    { label: 'Volume Total (Litros)', key: 'totalLiters', format: (v) => `${formatNumber(v, 0)} L` },
    { label: 'Total de Abastecimentos', key: 'totalRefuels', format: (v) => `${v}` },
    { label: 'Preço Médio por Litro', key: 'avgUnitPrice', format: (v) => `R$ ${formatNumber(v, 3)}` },
    { label: 'Custo Médio / Abastecimento', key: 'avgCostPerRefuel', format: formatCurrency },
    { label: 'Média de Consumo (km/L)', key: 'avgKmL', format: (v) => `${formatNumber(v, 2)} km/L` },
  ];

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const periodLabel = (p: string) => {
    const [y, m] = p.split('-');
    return `${MONTHS.find((mo) => mo.value === m)?.label ?? m}/${y}`;
  };

  const handleExportPDF = () => {
    const columns = ['Indicador', periodLabel(period1), periodLabel(period2), 'Variação (%)'];
    const exportRows = rows.map((r) => {
      const v1 = data1?.[r.key] ?? 0;
      const v2 = data2?.[r.key] ?? 0;
      const variation = calcVariation(v1, v2);
      return [r.label, r.format(v1 as number), r.format(v2 as number), formatVariation(variation)];
    });

    exportToPDF(
      'Relatório Comparativo de Períodos',
      columns,
      exportRows,
      `relatorio_comparativo_${period1}_vs_${period2}`,
      {
        subtitle: `Comparativo entre ${periodLabel(period1)} e ${periodLabel(period2)}`,
        summaryInfo: [
          { label: `Gasto ${periodLabel(period1)}`, value: formatCurrency(data1?.totalValue ?? 0) },
          { label: `Gasto ${periodLabel(period2)}`, value: formatCurrency(data2?.totalValue ?? 0) },
        ],
      }
    );
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-400">Período 1:</span>
            <select
              value={period1.split('-')[0]}
              onChange={(e) => setPeriod1(`${e.target.value}-${period1.split('-')[1]}`)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={selectStyle}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={period1.split('-')[1]}
              onChange={(e) => setPeriod1(`${period1.split('-')[0]}-${e.target.value}`)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={selectStyle}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <ArrowRightLeft size={18} className="text-slate-500 self-center hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: '#f59e0b' }}>
              Período 2:
            </span>
            <select
              value={period2.split('-')[0]}
              onChange={(e) => setPeriod2(`${e.target.value}-${period2.split('-')[1]}`)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={selectStyle}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={period2.split('-')[1]}
              onChange={(e) => setPeriod2(`${period2.split('-')[0]}-${e.target.value}`)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={selectStyle}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all self-start sm:self-auto"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
          title="Exportar Comparativo em PDF"
        >
          <FileText size={15} className="text-blue-400" />
          <span>Exportar PDF</span>
        </button>
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
