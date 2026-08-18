import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { VibraOrder, VibraStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export interface VibraOrderModalProps {
  isOpen: boolean;
  order: VibraOrder | null;
  defaultYear: string;
  defaultMonth: string;
  onClose: () => void;
  onSave: (data: {
    issueDate: string;
    paymentDate: string;
    orderNumber: string;
    invoiceNumber: string;
    liters: string;
    unitPrice: string;
    status: VibraStatus;
  }) => Promise<void>;
  saving: boolean;
}

export function VibraOrderModal({
  isOpen,
  order,
  defaultYear,
  defaultMonth,
  onClose,
  onSave,
  saving,
}: VibraOrderModalProps) {
  const [formData, setFormData] = useState({
    issueDate: `${defaultYear}-${defaultMonth}-01`,
    paymentDate: '',
    orderNumber: '',
    invoiceNumber: '',
    liters: '',
    unitPrice: '',
    status: 'PAID' as VibraStatus,
  });

  useEffect(() => {
    if (order) {
      const formatDateInput = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      setFormData({
        issueDate: formatDateInput(order.issueDate),
        paymentDate: order.paymentDate ? formatDateInput(order.paymentDate) : '',
        orderNumber: order.orderNumber || '',
        invoiceNumber: order.invoiceNumber || '',
        liters: String(order.liters),
        unitPrice: String(order.unitPrice),
        status: order.status || 'PAID',
      });
    } else {
      setFormData({
        issueDate: `${defaultYear}-${defaultMonth}-01`,
        paymentDate: '',
        orderNumber: '',
        invoiceNumber: '',
        liters: '',
        unitPrice: '',
        status: 'PAID',
      });
    }
  }, [order, defaultYear, defaultMonth, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const parsedLiters = parseFloat(formData.liters.replace(',', '.')) || 0;
  const parsedPrice = parseFloat(formData.unitPrice.replace(',', '.')) || 0;
  const estimatedTotal = parsedLiters * parsedPrice;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-scale-in"
        style={{
          position: 'relative',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '28rem',
          margin: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {order ? 'Editar Pedido Vibra' : 'Novo Pedido Vibra'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Data de Emissão (Pedido) *
              </label>
              <input
                type="date"
                required
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Data de Vencimento / Pagamento
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Nº do Pedido
              </label>
              <input
                type="text"
                placeholder="Ex: 4231521"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Nº Nota Fiscal
              </label>
              <input
                type="text"
                placeholder="Ex: 12345"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Litros Pedidos *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="Ex: 5000"
                value={formData.liters}
                onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Preço/Litro (R$) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="Ex: 5.38"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-main)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Status do Pagamento
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as VibraStatus })}
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none cursor-pointer"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
              <option value="PARTIAL">Parcial</option>
            </select>
          </div>

          {estimatedTotal > 0 && (
            <div
              className="p-3 rounded-xl border flex items-center justify-between text-sm"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--border)' }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Total Estimado:</span>
              <span className="font-bold text-blue-400">
                {formatCurrency(estimatedTotal)}
              </span>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
            >
              {saving ? 'Salvando...' : order ? 'Salvar Alterações' : 'Criar Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
