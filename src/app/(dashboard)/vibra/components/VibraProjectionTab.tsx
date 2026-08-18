import React from 'react';
import dynamic from 'next/dynamic';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  Check,
} from 'lucide-react';
import { VibraProjectionSummary } from '@/services/expenses';
import { formatCurrency, formatNumber, formatDate, cn } from '@/lib/utils';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface VibraProjectionTabProps {
  projection: VibraProjectionSummary;
  isAdmin: boolean;
  onQuickMarkPaid: (orderId: string) => Promise<void>;
}

export function VibraProjectionTab({
  projection,
  isAdmin,
  onQuickMarkPaid,
}: VibraProjectionTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alerts for overdue or approaching bills */}
      {projection.overdueCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
              <AlertCircle size={22} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-red-100">
                Atenção: Existem {projection.overdueCount} fatura(s) vencida(s) da Vibra!
              </h4>
              <p className="text-xs text-red-300/80">
                Total em atraso: <strong>{formatCurrency(projection.overdueValue)}</strong>. Regularize os pagamentos abaixo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projection KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card border-amber-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Total a Pagar em Aberto</span>
            <Clock size={18} className="text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {formatCurrency(projection.totalPendingValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {projection.totalPendingCount} fatura(s) pendente(s) no total
          </p>
        </div>

        <div
          className={cn(
            'kpi-card border transition-all',
            projection.overdueCount > 0
              ? 'border-red-500/50 bg-red-950/20 shadow-md'
              : 'border-slate-800'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Vencidas</span>
            <AlertCircle size={18} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">
            {formatCurrency(projection.overdueValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {projection.overdueCount} fatura(s) com prazo expirado
          </p>
        </div>

        <div className="kpi-card border-orange-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Próximos 7 Dias</span>
            <CalendarClock size={18} className="text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-orange-400">
            {formatCurrency(projection.next7DaysValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {projection.next7DaysCount} fatura(s) vencendo esta semana
          </p>
        </div>

        <div className="kpi-card border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">8 a 30 Dias</span>
            <Clock size={18} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {formatCurrency(projection.next30DaysValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {projection.next30DaysCount} fatura(s) com vencimento no mês
          </p>
        </div>
      </div>

      {/* Monthly Timeline Breakdown Chart */}
      {projection.monthlyTimeline && projection.monthlyTimeline.length > 0 && (
        <div
          className="rounded-2xl p-6 border shadow-md"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <CalendarClock size={18} className="text-blue-400" />
                Cronograma de Desembolso Futuro por Mês
              </h3>
              <p className="text-xs text-slate-400">
                Previsão de saída de caixa para pagamento das faturas em aberto
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ApexChart
              type="bar"
              height={240}
              series={[
                {
                  name: 'Valor a Pagar (R$)',
                  data: projection.monthlyTimeline.map((t) => t.pendingValue || t.totalValue),
                },
              ]}
              options={{
                chart: {
                  type: 'bar',
                  toolbar: { show: false },
                  background: 'transparent',
                },
                theme: { mode: 'dark' },
                colors: ['#3b82f6'],
                plotOptions: {
                  bar: {
                    borderRadius: 6,
                    columnWidth: '45%',
                    dataLabels: { position: 'top' },
                  },
                },
                dataLabels: {
                  enabled: true,
                  formatter: (val: number) =>
                    val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val.toFixed(0)}`,
                  offsetY: -20,
                  style: { fontSize: '11px', colors: ['#93c5fd'], fontWeight: 'bold' },
                },
                xaxis: {
                  categories: projection.monthlyTimeline.map((t) => `${t.monthLabel}/${t.month.split('-')[0]}`),
                  labels: { style: { colors: '#94a3b8', fontSize: '12px' } },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: { colors: '#94a3b8', fontSize: '11px' },
                    formatter: (val: number) => `R$ ${(val / 1000).toFixed(0)}k`,
                  },
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
      )}

      {/* Bill Schedule Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Todas as Faturas Pendentes Ordenadas por Vencimento
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {projection.bills.length} fatura(s) listada(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[800px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Vencimento</th>
                <th className="text-left px-4 py-3">Prazo / Urgência</th>
                <th className="text-left px-4 py-3">Nº Pedido / NF</th>
                <th className="text-left px-4 py-3">Data Emissão</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">Preço Unit.</th>
                <th className="text-right px-4 py-3">Valor da Fatura</th>
                {isAdmin && <th className="text-center px-4 py-3">Ação</th>}
              </tr>
            </thead>
            <tbody>
              {projection.bills.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center">
                    <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400/40" />
                    <p className="font-semibold text-emerald-300">
                      Parabéns! Não existem faturas em aberto ou pendentes no momento.
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      Todas as contas com a Vibra foram marcadas como pagas.
                    </p>
                  </td>
                </tr>
              ) : (
                projection.bills.map(({ order, daysRemaining, statusCategory, dueDate }) => (
                  <tr
                    key={order.id}
                    className="border-t transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatDate(dueDate)}
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {statusCategory === 'overdue' ? (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold inline-flex items-center gap-1">
                          <AlertCircle size={12} />
                          Vencido há {Math.abs(daysRemaining)} d
                        </span>
                      ) : statusCategory === 'today' ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/30 text-amber-200 border border-amber-500/50 font-bold inline-flex items-center gap-1 animate-pulse">
                          <AlertCircle size={12} />
                          Vence Hoje!
                        </span>
                      ) : statusCategory === 'next_7_days' ? (
                        <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-medium inline-flex items-center gap-1">
                          <Clock size={12} />
                          Em {daysRemaining} dia(s)
                        </span>
                      ) : statusCategory === 'next_30_days' ? (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                          Em {daysRemaining} dia(s)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-medium">
                          Em {daysRemaining} dia(s)
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {order.orderNumber ? (
                        <span className="font-semibold text-blue-400">#{order.orderNumber}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      {order.invoiceNumber && (
                        <span className="text-xs text-slate-400 ml-1.5">
                          (NF: {order.invoiceNumber})
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-slate-400">
                      {formatDate(order.issueDate)}
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-blue-400 font-medium">
                      {formatNumber(order.liters, 2)} L
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-slate-400">
                      R$ {formatNumber(order.unitPrice, 3)}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-bold text-amber-400">
                      {formatCurrency(order.totalValue)}
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onQuickMarkPaid(order.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 transition-all flex items-center justify-center gap-1 mx-auto"
                          title="Confirmar pagamento e liquidar esta fatura"
                        >
                          <Check size={12} />
                          <span>Dar Baixa</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {projection.bills.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td className="px-4 py-3 font-semibold text-sm" colSpan={4} style={{ color: 'var(--text-primary)' }}>
                    Total Geral a Pagar ({projection.bills.length} faturas pendentes)
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-blue-400">
                    {formatNumber(projection.bills.reduce((s, b) => s + (b.order.liters || 0), 0), 2)} L
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-400">—</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-amber-400">
                    {formatCurrency(projection.totalPendingValue)}
                  </td>
                  {isAdmin && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
