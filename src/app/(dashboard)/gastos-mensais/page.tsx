'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, DollarSign, CheckCircle, Clock, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { getMonthlyExpenses, createMonthlyExpense, deleteMonthlyExpense } from '@/services/expenses';
import { MonthlyExpense, ExpenseStatus } from '@/lib/types';
import { formatCurrency, formatDate, toYearMonth, cn } from '@/lib/utils';
import { MONTHS, YEARS, EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS } from '@/lib/constants';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';

const statusColors: Record<ExpenseStatus, string> = {
  PENDING: '#f59e0b',
  PAID: '#10b981',
  OVERDUE: '#ef4444',
  PARTIAL: '#3b82f6',
};

const statusIcons: Record<ExpenseStatus, React.ElementType> = {
  PENDING: Clock,
  PAID: CheckCircle,
  OVERDUE: AlertTriangle,
  PARTIAL: DollarSign,
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function GastosMensaisPage() {
  const { profile } = useAuth();
  const { canCreate, isAdmin } = usePermissions();
  const now = new Date();
  const [competence, setCompetence] = useState(toYearMonth(now));
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const currentYear = now.getFullYear();
  const [selYear, selMonth] = competence.split('-');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await getMonthlyExpenses(competence));
    } catch {
      toast.error('Erro ao carregar gastos.');
    } finally {
      setLoading(false);
    }
  }, [competence]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await deleteMonthlyExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success('Gasto excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const totalPaid = expenses.filter((e) => e.status === 'PAID').reduce((s, e) => s + e.value, 0);
  const totalPending = expenses.filter((e) => e.status === 'PENDING').reduce((s, e) => s + e.value, 0);
  const totalOverdue = expenses.filter((e) => e.status === 'OVERDUE').reduce((s, e) => s + e.value, 0);
  const totalAll = expenses.reduce((s, e) => s + e.value, 0);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Gastos Mensais</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Controle de despesas por competência</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selYear} onChange={(e) => setCompetence(`${e.target.value}-${selMonth}`)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={selectStyle}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selMonth} onChange={(e) => setCompetence(`${selYear}-${e.target.value}`)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={selectStyle}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {canCreate && (
            <button
              onClick={() => {/* Open modal */}}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
            >
              <Plus size={16} /> Novo
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Geral', value: totalAll, color: '#3b82f6' },
          { label: 'Pagos', value: totalPaid, color: '#10b981' },
          { label: 'Pendentes', value: totalPending, color: '#f59e0b' },
          { label: 'Vencidos', value: totalOverdue, color: '#ef4444' },
        ].map((c) => (
          <div key={c.label} className="kpi-card">
            <p className="text-xl font-bold" style={{ color: c.color }}>{formatCurrency(c.value)}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[700px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Fornecedor</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-center px-4 py-3">Vencimento</th>
                <th className="text-center px-4 py-3">Pagamento</th>
                <th className="text-center px-4 py-3">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 w-20">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-5" /></td>
                    ))}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <DollarSign size={40} className="text-blue-400/20" />
                      <p style={{ color: 'var(--text-muted)' }}>Nenhum gasto lançado para este período.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((e) => {
                  const StatusIcon = statusIcons[e.status];
                  return (
                    <tr key={e.id} className="border-t transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{e.supplierName}</p>
                        {e.invoiceNumber && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>NF {e.invoiceNumber}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                          {EXPENSE_CATEGORY_LABELS[e.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(e.value)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(e.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {e.paymentDate ? formatDate(e.paymentDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full"
                          style={{
                            background: `${statusColors[e.status]}18`,
                            border: `1px solid ${statusColors[e.status]}30`,
                            color: statusColors[e.status],
                          }}
                        >
                          <StatusIcon size={11} />
                          {EXPENSE_STATUS_LABELS[e.status]}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className={cn('p-1.5 rounded-lg transition-colors',
                                confirmDelete === e.id ? 'bg-red-500/20 text-red-400' : 'hover:bg-red-500/10 text-red-400/40 hover:text-red-400')}
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
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td className="px-4 py-3 text-sm font-semibold" colSpan={2} style={{ color: 'var(--text-primary)' }}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#60a5fa' }}>
                    {formatCurrency(totalAll)}
                  </td>
                  <td colSpan={isAdmin ? 4 : 3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
