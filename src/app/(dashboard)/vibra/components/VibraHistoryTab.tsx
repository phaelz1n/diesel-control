import React from 'react';
import dynamic from 'next/dynamic';
import {
  Droplets,
  DollarSign,
  CreditCard,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { VibraAnnualHistory } from '@/services/expenses';
import { formatCurrency, formatNumber } from '@/lib/utils';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface VibraHistoryTabProps {
  annualHistory: VibraAnnualHistory;
  historyYear: number;
  onNavigateToMonth: (competence: string) => void;
}

export function VibraHistoryTab({
  annualHistory,
  historyYear,
  onNavigateToMonth,
}: VibraHistoryTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Annual KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Volume Total Comprado ({historyYear})</span>
            <Droplets size={18} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {formatNumber(annualHistory.totalIssuedLiters, 0)} L
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {annualHistory.totalIssuedOrders} pedidos realizados no ano
          </p>
        </div>

        <div className="kpi-card border-indigo-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Total em Compras ({historyYear})</span>
            <DollarSign size={18} className="text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {formatCurrency(annualHistory.totalIssuedValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Regime de emissão / faturado
          </p>
        </div>

        <div className="kpi-card border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Total Liquidado em Pagamentos</span>
            <CreditCard size={18} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(annualHistory.totalPaidValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {formatCurrency(annualHistory.totalPendingValue)} pendente(s) no ano
          </p>
        </div>

        <div className="kpi-card border-purple-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Preço Médio Anual</span>
            <TrendingUp size={18} className="text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-400">
            R$ {formatNumber(annualHistory.avgIssuedUnitPrice, 3)}
            <span className="text-xs text-slate-400 font-normal">/L</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Média ponderada do diesel
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Financial Evolution (Issued vs Paid) */}
        <div
          className="rounded-2xl p-6 border shadow-md"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-400" />
                Comparativo: Compras Faturadas vs Pagamentos Pagos ({historyYear})
              </h3>
              <p className="text-xs text-slate-400">
                Total em pedidos emitidos vs total liquidado por mês
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ApexChart
              type="bar"
              height={280}
              series={[
                {
                  name: 'Total em Pedidos (Emissão)',
                  data: annualHistory.months.map((m) => m.issuedTotalValue),
                },
                {
                  name: 'Total Pago (Caixa)',
                  data: annualHistory.months.map((m) => m.duePaidValue),
                },
              ]}
              options={{
                chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
                theme: { mode: 'dark' },
                colors: ['#3b82f6', '#10b981'],
                plotOptions: {
                  bar: {
                    horizontal: false,
                    columnWidth: '55%',
                    borderRadius: 4,
                  },
                },
                dataLabels: { enabled: false },
                stroke: { show: true, width: 2, colors: ['transparent'] },
                xaxis: {
                  categories: annualHistory.months.map((m) => m.monthLabel),
                  labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
                  axisBorder: { show: false },
                },
                yaxis: {
                  labels: {
                    style: { colors: '#94a3b8', fontSize: '11px' },
                    formatter: (val: number) => `R$ ${(val / 1000).toFixed(0)}k`,
                  },
                },
                legend: {
                  position: 'top',
                  labels: { colors: '#cbd5e1' },
                },
                grid: { borderColor: '#1e293b', strokeDashArray: 4 },
                tooltip: {
                  theme: 'dark',
                  y: { formatter: (val: number) => formatCurrency(val) },
                },
              }}
            />
          </div>
        </div>

        {/* Chart 2: Volume and Unit Price Evolution */}
        <div
          className="rounded-2xl p-6 border shadow-md"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <TrendingUp size={18} className="text-purple-400" />
                Volume de Diesel (Litros) e Preço Médio/L ({historyYear})
              </h3>
              <p className="text-xs text-slate-400">
                Evolução mensal de litros comprados e custo por litro
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ApexChart
              type="line"
              height={280}
              series={[
                {
                  name: 'Litros Comprados',
                  type: 'column',
                  data: annualHistory.months.map((m) => m.issuedTotalLiters),
                },
                {
                  name: 'Preço Médio Unitário (R$/L)',
                  type: 'line',
                  data: annualHistory.months.map((m) => m.issuedAvgUnitPrice),
                },
              ]}
              options={{
                chart: { height: 280, type: 'line', toolbar: { show: false }, background: 'transparent' },
                theme: { mode: 'dark' },
                stroke: { width: [0, 3], curve: 'smooth' },
                colors: ['#6366f1', '#f59e0b'],
                dataLabels: { enabled: false },
                labels: annualHistory.months.map((m) => m.monthLabel),
                xaxis: {
                  labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
                  axisBorder: { show: false },
                },
                yaxis: [
                  {
                    title: { text: 'Litros', style: { color: '#6366f1' } },
                    labels: {
                      style: { colors: '#94a3b8' },
                      formatter: (val: number) => `${(val / 1000).toFixed(0)}k L`,
                    },
                  },
                  {
                    opposite: true,
                    title: { text: 'Preço/L (R$)', style: { color: '#f59e0b' } },
                    labels: {
                      style: { colors: '#94a3b8' },
                      formatter: (val: number) => `R$ ${val.toFixed(2)}`,
                    },
                  },
                ],
                legend: { position: 'top', labels: { colors: '#cbd5e1' } },
                grid: { borderColor: '#1e293b', strokeDashArray: 4 },
                tooltip: {
                  theme: 'dark',
                  y: {
                    formatter: (val: number, opts: any) =>
                      opts.seriesIndex === 0
                        ? `${formatNumber(val, 0)} Litros`
                        : `R$ ${formatNumber(val, 3)}/L`,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* 12-Month Consolidated History Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-purple-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Demonstrativo Mês a Mês do Ano de {historyYear}
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            12 meses compilados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[850px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Mês</th>
                <th className="text-right px-4 py-3">Pedidos</th>
                <th className="text-right px-4 py-3">Litros Comprados</th>
                <th className="text-right px-4 py-3">Preço Médio/L</th>
                <th className="text-right px-4 py-3">Total Compras (Emissão)</th>
                <th className="text-right px-4 py-3">Vencimentos do Mês</th>
                <th className="text-right px-4 py-3">Total Pago (Caixa)</th>
                <th className="text-right px-4 py-3">Total Pendente</th>
                <th className="text-center px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {annualHistory.months.map((m) => {
                const hasActivity = m.issuedOrderCount > 0 || m.dueOrderCount > 0;
                return (
                  <tr
                    key={m.month}
                    className="border-t transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 text-sm font-bold text-slate-100">
                      {m.monthLabel}/{historyYear}
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-slate-300">
                      {m.issuedOrderCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold text-xs">
                          {m.issuedOrderCount} ped.
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-medium text-blue-400">
                      {m.issuedTotalLiters > 0 ? `${formatNumber(m.issuedTotalLiters, 0)} L` : '—'}
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-slate-300">
                      {m.issuedAvgUnitPrice > 0 ? `R$ ${formatNumber(m.issuedAvgUnitPrice, 3)}` : '—'}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-100">
                      {m.issuedTotalValue > 0 ? formatCurrency(m.issuedTotalValue) : '—'}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-300">
                      {m.dueTotalValue > 0 ? formatCurrency(m.dueTotalValue) : '—'}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-400">
                      {m.duePaidValue > 0 ? formatCurrency(m.duePaidValue) : '—'}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-semibold text-amber-400">
                      {m.duePendingValue > 0 ? formatCurrency(m.duePendingValue) : '—'}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onNavigateToMonth(m.month)}
                        disabled={!hasActivity}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 transition-all flex items-center justify-center gap-1 mx-auto disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <span>Ver Mês</span>
                        <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                <td className="px-4 py-3 font-semibold text-sm text-slate-100">
                  Total Acumulado ({historyYear})
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-slate-100">
                  {annualHistory.totalIssuedOrders}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-blue-400">
                  {formatNumber(annualHistory.totalIssuedLiters, 0)} L
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-slate-100">
                  R$ {formatNumber(annualHistory.avgIssuedUnitPrice, 3)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-slate-100">
                  {formatCurrency(annualHistory.totalIssuedValue)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-slate-100">
                  {formatCurrency(annualHistory.totalDueValue)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                  {formatCurrency(annualHistory.totalPaidValue)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-amber-400">
                  {formatCurrency(annualHistory.totalPendingValue)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
