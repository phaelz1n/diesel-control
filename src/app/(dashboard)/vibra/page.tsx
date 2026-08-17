'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Droplets, DollarSign, Upload, Download, X } from 'lucide-react';
import { getVibraOrders, deleteVibraOrder, getVibraSummary, VibraSummary } from '@/services/expenses';
import { VibraOrder } from '@/lib/types';
import { formatCurrency, formatNumber, formatDate, toYearMonth, cn } from '@/lib/utils';
import { MONTHS, YEARS, VIBRA_STATUS_LABELS } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/hooks/useAuth';
import Papa from 'papaparse';
import { batchCreate, COLLECTIONS, createDocument } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function VibraPage() {
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const now = new Date();
  const [competence, setCompetence] = useState(toYearMonth(now));
  const [orders, setOrders] = useState<VibraOrder[]>([]);
  const [summary, setSummary] = useState<VibraSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    issueDate: formatDate(new Date()).split('/').reverse().join('-'), // YYYY-MM-DD
    liters: '',
    unitPrice: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err) { console.error("Erro detalhado:", err);
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
    } catch (err) { console.error("Erro detalhado:", err);
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

  const monthMap: Record<string, string> = {
    'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'MARCO': '03',
    'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06', 'JULHO': '07',
    'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Mês,Emissão,Pagamento,Litros Pedidos,Vlr Unit (R$),Vlr Total\nAGOSTO,15/08/2026,,15000,5.80,87000.00";
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_importacao_vibra.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const liters = parseFloat(formData.liters);
      const unitPrice = parseFloat(formData.unitPrice);
      const totalValue = liters * unitPrice;
      const [year, month, day] = formData.issueDate.split('-');
      
      const newOrder = {
        competence: `${year}-${month}`,
        issueDate: Timestamp.fromDate(new Date(Number(year), Number(month) - 1, Number(day))),
        paymentDate: null,
        liters,
        unitPrice,
        totalValue,
        status: 'PAID' as const,
      };

      await createDocument(COLLECTIONS.VIBRA_ORDERS, newOrder, user.uid);
      toast.success('Pedido criado com sucesso!');
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error('Erro ao criar pedido');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        try {
          const rows = results.data as any[];
          const newOrders: Omit<VibraOrder, 'id' | 'createdAt' | 'updatedAt'>[] = [];
          
          let currentMonth = 'JANEIRO';

          for (const row of rows) {
            if (row['Mês']) {
              currentMonth = String(row['Mês']).toUpperCase().trim();
            }
            if (!row['Emissão'] || !row['Litros Pedidos']) continue;

            const parseDate = (str: string) => {
              const parts = str.split('/');
              if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
              return new Date();
            };

            const issueDate = parseDate(row['Emissão']);
            const paymentDate = row['Pagamento'] ? parseDate(row['Pagamento']) : undefined;
            
            const mm = monthMap[currentMonth] || '01';

            newOrders.push({
              competence: `2026-${mm}`, // Hardcoded year based on sheet
              issueDate: issueDate,
              paymentDate: paymentDate,
              liters: parseFloat(row['Litros Pedidos']),
              unitPrice: parseFloat(row['Vlr Unit (R$)'] || '0'),
              totalValue: parseFloat(row['Vlr Total'] || '0'),
              status: 'PAID',
              createdBy: user.uid,
              updatedBy: user.uid,
            });
          }

          if (newOrders.length > 0) {
            await batchCreate(COLLECTIONS.VIBRA_ORDERS, newOrders, user.uid);
            toast.success(`${newOrders.length} pedidos Vibra importados!`);
            load();
          }
        } catch (err) {
          console.error(err);
          toast.error('Erro na importação');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
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
            <div className="flex gap-2">
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                <Upload size={16} /> {importing ? 'Importando...' : 'Importar CSV'}
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                <Download size={16} /> Baixar Modelo
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
              >
                <Plus size={16} /> Novo Pedido
              </button>
            </div>
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

      {/* Modal Novo Pedido */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Novo Pedido Vibra</h2>
              <button onClick={() => setModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Data de Emissão</label>
                <input
                  type="date"
                  required
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl outline-none"
                  style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Litros Pedidos</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.liters}
                  onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl outline-none"
                  style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Valor Unitário (R$)</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl outline-none"
                  style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
                >
                  {saving ? 'Salvando...' : 'Salvar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
