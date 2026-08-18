import React from 'react';
import {
  Droplets,
  CreditCard,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { VibraOrder, VibraStatus } from '@/lib/types';
import { VibraSummary, getVibraOrderIssueCompetence, getVibraOrderPaymentCompetence } from '@/services/expenses';
import { formatCurrency, formatNumber, formatDate, cn } from '@/lib/utils';
import { VIBRA_STATUS_LABELS } from '@/lib/constants';
import { Skeleton } from '@/components/ui/Skeleton';

export interface VibraMonthlyTabProps {
  orders: VibraOrder[];
  filteredOrders: VibraOrder[];
  filteredTotals: {
    count: number;
    totalLiters: number;
    totalValue: number;
    avgUnitPrice: number;
    paidCount: number;
    pendingCount: number;
    paidValue: number;
    pendingValue: number;
  };
  summary: VibraSummary | null;
  loading: boolean;
  viewFilter: 'all' | 'payment' | 'issue' | 'pending';
  setViewFilter: (f: 'all' | 'payment' | 'issue' | 'pending') => void;
  selMonth: string;
  selYear: string;
  competence: string;
  isAdmin: boolean;
  confirmDelete: string | null;
  onEditOrder: (order: VibraOrder) => void;
  onDeleteOrder: (id: string) => void;
}

export function VibraMonthlyTab({
  orders,
  filteredOrders,
  filteredTotals,
  summary,
  loading,
  viewFilter,
  setViewFilter,
  selMonth,
  selYear,
  competence,
  isAdmin,
  confirmDelete,
  onEditOrder,
  onDeleteOrder,
}: VibraMonthlyTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards: Separação de Pedidos Emitidos vs Contas a Pagar por Vencimento */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Pedidos Emitidos (Compras do Mês) */}
          <div
            className="rounded-2xl p-5 border relative overflow-hidden transition-all shadow-md flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, var(--bg-card) 100%)',
              borderColor: 'rgba(59,130,246,0.3)',
            }}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <Droplets size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      Pedidos Emitidos no Mês
                    </h3>
                    <p className="text-xs text-slate-400">
                      Volume e compras faturadas na data de emissão ({selMonth}/{selYear})
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {summary.issuedOrderCount} {summary.issuedOrderCount === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Litros Pedidos</span>
                  <span className="text-lg sm:text-xl font-bold text-blue-400">
                    {formatNumber(summary.issuedTotalLiters, 0)} L
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Total Pedido</span>
                  <span className="text-lg sm:text-xl font-bold text-slate-100">
                    {formatCurrency(summary.issuedTotalValue)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Preço Médio</span>
                  <span className="text-lg sm:text-xl font-bold text-slate-200">
                    R$ {formatNumber(summary.issuedAvgUnitPrice, 3)}
                    <span className="text-xs text-slate-400 font-normal">/L</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Contas a Pagar & Vencimentos do Mês */}
          <div
            className="rounded-2xl p-5 border relative overflow-hidden transition-all shadow-md flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, var(--bg-card) 100%)',
              borderColor: 'rgba(16,185,129,0.3)',
            }}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      Vencimentos & Contas a Pagar
                    </h3>
                    <p className="text-xs text-slate-400">
                      Faturas com data de vencimento/pagamento em {selMonth}/{selYear}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {summary.dueOrderCount} {summary.dueOrderCount === 1 ? 'vencimento' : 'vencimentos'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Total a Pagar no Mês</span>
                  <span className="text-lg sm:text-xl font-bold text-emerald-400">
                    {formatCurrency(summary.dueTotalValue)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-emerald-400/90 block mb-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Já Pago
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-emerald-300">
                    {formatCurrency(summary.duePaidValue)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ({summary.duePaidCount} {summary.duePaidCount === 1 ? 'pago' : 'pagos'})
                  </span>
                </div>
                <div>
                  <span className="text-xs text-amber-400/90 block mb-1 flex items-center gap-1">
                    <Clock size={12} /> Pendente / A Pagar
                  </span>
                  <span
                    className={cn(
                      'text-lg sm:text-xl font-bold',
                      summary.duePendingValue > 0 ? 'text-amber-400' : 'text-slate-400'
                    )}
                  >
                    {formatCurrency(summary.duePendingValue)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ({summary.duePendingCount} {summary.duePendingCount === 1 ? 'pendente' : 'pendentes'})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Filter Tabs & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setViewFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
              viewFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <span>Todos os Lançamentos</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setViewFilter('payment')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
              viewFilter === 'payment'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <CreditCard size={13} />
            <span>Vencimentos no Mês</span>
            {summary && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                {summary.dueOrderCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewFilter('issue')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
              viewFilter === 'issue'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Droplets size={13} />
            <span>Pedidos Emitidos no Mês</span>
            {summary && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                {summary.issuedOrderCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewFilter('pending')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
              viewFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Clock size={13} />
            <span>Pendentes a Pagar</span>
            {summary && summary.duePendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold text-[10px]">
                {summary.duePendingCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-400">
          Exibindo <span className="font-semibold text-slate-200">{filteredOrders.length}</span> de{' '}
          <span className="font-semibold text-slate-200">{orders.length}</span> lançamento(s)
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[750px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Data Emissão</th>
                <th className="text-left px-4 py-3">Nº Pedido / NF</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">Preço Unit.</th>
                <th className="text-right px-4 py-3">Valor Total</th>
                <th className="text-left px-4 py-3">Data Vencimento</th>
                <th className="text-center px-4 py-3">Status</th>
                {isAdmin && <th className="text-right px-4 py-3">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    {Array.from({ length: isAdmin ? 8 : 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center">
                    <Droplets size={40} className="mx-auto mb-3 text-blue-400/20" />
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Nenhum pedido encontrado para o filtro selecionado em {selMonth}/{selYear}.
                    </p>
                    <p className="text-xs mt-1 text-slate-500">
                      Utilize &ldquo;Novo Pedido&rdquo; ou &ldquo;Importar CSV&rdquo; para adicionar pedidos, ou selecione outro período acima.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isIssueThisMonth = getVibraOrderIssueCompetence(o) === competence;
                  const isPaymentThisMonth = getVibraOrderPaymentCompetence(o) === competence;

                  return (
                    <tr
                      key={o.id}
                      className="border-t transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center gap-2">
                          <span>{formatDate(o.issueDate)}</span>
                          {isIssueThisMonth && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium" title="Pedido emitido neste mês">
                              Emissão
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm">
                        <div>
                          {o.orderNumber ? (
                            <span className="font-semibold text-blue-400">#{o.orderNumber}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                          {o.invoiceNumber && (
                            <span className="text-xs text-slate-400 ml-1.5">
                              (NF: {o.invoiceNumber})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-400">
                        {formatNumber(o.liters, 2)} L
                      </td>

                      <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                        R$ {formatNumber(o.unitPrice, 3)}
                      </td>

                      <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                        {formatCurrency(o.totalValue)}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {o.paymentDate ? (
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--text-primary)' }}>{formatDate(o.paymentDate)}</span>
                            {isPaymentThisMonth && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium" title="Vencimento neste mês">
                                Caixa
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block',
                            o.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : o.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          )}
                        >
                          {VIBRA_STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onEditOrder(o)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                              style={{ color: 'var(--text-secondary)' }}
                              title="Editar pedido"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => onDeleteOrder(o.id)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                confirmDelete === o.id
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'hover:bg-red-500/10 text-red-400/50 hover:text-red-400'
                              )}
                              title={confirmDelete === o.id ? 'Clique para confirmar exclusão' : 'Excluir pedido'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td className="px-4 py-3 font-semibold text-sm" colSpan={2} style={{ color: 'var(--text-primary)' }}>
                    Total ({filteredTotals.count} {filteredTotals.count === 1 ? 'lançamento' : 'lançamentos'})
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-blue-400">
                    {formatNumber(filteredTotals.totalLiters, 2)} L
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    R$ {formatNumber(filteredTotals.avgUnitPrice, 3)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                    {formatCurrency(filteredTotals.totalValue)}
                  </td>
                  <td colSpan={isAdmin ? 3 : 2} className="px-4 py-3 text-xs text-right text-slate-400">
                    <span className="text-emerald-400 font-medium">Pago: {formatCurrency(filteredTotals.paidValue)}</span>
                    {filteredTotals.pendingValue > 0 && (
                      <span className="ml-2 text-amber-400 font-medium">• Pendente: {formatCurrency(filteredTotals.pendingValue)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
