'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Droplets, DollarSign } from 'lucide-react';
import { getVibraOrders, deleteVibraOrder, getVibraSummary, VibraSummary } from '@/services/expenses';
import { VibraOrder } from '@/lib/types';
import { formatCurrency, formatNumber, formatDate, toYearMonth, cn } from '@/lib/utils';
import { MONTHS, YEARS, VIBRA_STATUS_LABELS } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function VibraPage() {
  const { isAdmin } = usePermissions();
  const now = new Date();
  const [competence, setCompetence] = useState(toYearMonth(now));
  const [orders, setOrders] = useState<VibraOrder[]>([]);
  const [summary, setSummary] = useState<VibraSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [selYear, selMonth] = competence.split('-');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        getVibraOrders(competence),
        getVibraSummary(competence),
      ]);
      setOrders(o);
      setSummary(s);
    } catch {
      toast.error('Erro ao carregar dados Vibra.');
    } finally {
      setLoading(false);
    }
  }, [competence]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await deleteVibraOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success('Pedido excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Controle Vibra</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Pedidos e notas de combustível Vibra</p>
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
          {isAdmin && (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
            >
              <Plus size={16} /> Novo Pedido
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : summary ? (
          <>
            <div className="kpi-card">
              <Droplets size={20} className="text-blue-400 mb-2" />
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatNumber(summary.totalLiters, 0)} L</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Litros</p>
            </div>
            <div className="kpi-card">
              <DollarSign size={20} className="text-green-400 mb-2" />
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(summary.totalValue)}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Gasto</p>
            </div>
            <div className="kpi-card">
              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                R$ {formatNumber(summary.avgUnitPrice, 3)}/L
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Preço Médio</p>
            </div>
            <div className="kpi-card">
              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{summary.orderCount}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pedidos</p>
            </div>
            <div className="kpi-card">
              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {formatNumber(summary.avgLitersPerOrder, 0)} L
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Média/Pedido</p>
            </div>
          </>
        ) : null}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[750px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Emissão</th>
                <th className="text-left px-4 py-3">Nº Pedido / NF</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">Preço/L</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Pagamento</th>
                <th className="text-center px-4 py-3">Status</th>
                {isAdmin && <th className="w-20 px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-5" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Droplets size={40} className="mx-auto mb-3 text-blue-400/20" />
                    <p style={{ color: 'var(--text-muted)' }}>Nenhum pedido Vibra para este período.</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(o.issueDate)}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {o.orderNumber ?? '—'}
                      {o.invoiceNumber && <span style={{ color: 'var(--text-muted)' }}> / NF {o.invoiceNumber}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(o.liters, 2)} L
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      R$ {formatNumber(o.unitPrice, 3)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(o.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {o.paymentDate ? formatDate(o.paymentDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full',
                        o.status === 'PAID' ? 'badge-paid' : o.status === 'PENDING' ? 'badge-pending' : 'badge-partial'
                      )}>
                        {VIBRA_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(o.id)}
                            className={cn('p-1.5 rounded-lg',
                              confirmDelete === o.id ? 'bg-red-500/20 text-red-400' : 'hover:bg-red-500/10 text-red-400/40 hover:text-red-400')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {orders.length > 0 && summary && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td className="px-4 py-3 font-semibold text-sm" colSpan={2} style={{ color: 'var(--text-primary)' }}>Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#60a5fa' }}>{formatNumber(summary.totalLiters, 2)} L</td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>R$ {formatNumber(summary.avgUnitPrice, 3)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#60a5fa' }}>{formatCurrency(summary.totalValue)}</td>
                  <td colSpan={isAdmin ? 3 : 2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
