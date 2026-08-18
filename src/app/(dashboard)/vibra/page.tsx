'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  Calendar,
  CalendarClock,
  History,
  FileText,
  Upload,
  Download,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  getVibraOrders,
  getVibraSummary,
  createVibraOrder,
  updateVibraOrder,
  deleteVibraOrder,
  deleteVibraOrdersByCompetence,
  calcVibraProjection,
  calcVibraAnnualHistory,
  getVibraOrderPaymentCompetence,
  getVibraOrderIssueCompetence,
  VibraSummary,
} from '@/services/expenses';
import { exportToPDF } from '@/lib/utils/exportUtils';
import { VibraOrder, VibraStatus } from '@/lib/types';
import { formatCurrency, formatNumber, formatDate, toYearMonth, cn } from '@/lib/utils';
import { MONTHS, YEARS, VIBRA_STATUS_LABELS } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/hooks/useAuth';
import Papa from 'papaparse';
import { batchCreate, COLLECTIONS } from '@/lib/firebase/firestore';

import { VibraMonthlyTab } from './components/VibraMonthlyTab';
import { VibraProjectionTab } from './components/VibraProjectionTab';
import { VibraHistoryTab } from './components/VibraHistoryTab';
import { VibraOrderModal } from './components/VibraOrderModal';

// Helpers for CSV parsing
function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getColValue(row: Record<string, any>, ...keys: string[]): string | undefined {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const target = normKey(k);
    const foundKey = rowKeys.find((rk) => normKey(rk) === target);
    if (
      foundKey !== undefined &&
      row[foundKey] !== undefined &&
      row[foundKey] !== null &&
      String(row[foundKey]).trim() !== ''
    ) {
      return String(row[foundKey]).trim();
    }
  }
  return undefined;
}

function parseBRNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim().replace(/^R\$\s*/i, '').trim();
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function parseBRDate(str?: string): Date | null {
  if (!str) return null;
  const clean = String(str).trim();
  const parts = clean.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    } else {
      const d = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const y = Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2]);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  const timestamp = Date.parse(clean);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

const MONTH_MAP: Record<string, string> = {
  JANEIRO: '01', JAN: '01',
  FEVEREIRO: '02', FEV: '02',
  MARCO: '03', MARÇO: '03', MAR: '03',
  ABRIL: '04', ABR: '04',
  MAIO: '05', MAI: '05',
  JUNHO: '06', JUN: '06',
  JULHO: '07', JUL: '07',
  AGOSTO: '08', AGO: '08',
  SETEMBRO: '09', SET: '09',
  OUTUBRO: '10', OUT: '10',
  NOVEMBRO: '11', NOV: '11',
  DEZEMBRO: '12', DEZ: '12',
};

export default function VibraPage() {
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const now = new Date();
  const [competence, setCompetence] = useState(toYearMonth(now));
  const [orders, setOrders] = useState<VibraOrder[]>([]);
  const [summary, setSummary] = useState<VibraSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [allDbOrders, setAllDbOrders] = useState<VibraOrder[] | null>(null);
  const [loadingDbAll, setLoadingDbAll] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<VibraOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selYear, selMonth] = competence.split('-');
  const [mainTab, setMainTab] = useState<'monthly' | 'projection' | 'history'>('monthly');
  const [historyYear, setHistoryYear] = useState<number>(Number(selYear) || new Date().getFullYear());
  const [viewFilter, setViewFilter] = useState<'all' | 'payment' | 'issue' | 'pending'>('all');

  const loadAllDbOrders = useCallback(async () => {
    setLoadingDbAll(true);
    try {
      const all = await getVibraOrders();
      setAllDbOrders(all);
    } catch (err: any) {
      console.error('Erro ao consultar banco geral:', err);
      toast.error('Erro ao consultar banco de dados.');
    } finally {
      setLoadingDbAll(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        getVibraOrders(competence, 'all'),
        getVibraSummary(competence),
      ]);
      setOrders(o);
      setSummary(s);
    } catch (err) {
      console.error('Erro detalhado:', err);
      toast.error('Erro ao carregar dados Vibra.');
    } finally {
      setLoading(false);
    }
  }, [competence]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAllDbOrders();
  }, [loadAllDbOrders]);

  const filteredOrders = useMemo(() => {
    if (viewFilter === 'issue') {
      return orders.filter((o) => getVibraOrderIssueCompetence(o) === competence);
    }
    if (viewFilter === 'payment') {
      return orders.filter((o) => getVibraOrderPaymentCompetence(o) === competence);
    }
    if (viewFilter === 'pending') {
      return orders.filter((o) => o.status !== 'PAID');
    }
    return orders;
  }, [orders, viewFilter, competence]);

  const filteredTotals = useMemo(() => {
    const totalLiters = filteredOrders.reduce((s, o) => s + (o.liters || 0), 0);
    const totalValue = filteredOrders.reduce((s, o) => s + (o.totalValue || 0), 0);
    const avgUnitPrice = totalLiters > 0 ? totalValue / totalLiters : 0;
    const paidCount = filteredOrders.filter((o) => o.status === 'PAID').length;
    const pendingCount = filteredOrders.filter((o) => o.status !== 'PAID').length;
    const paidValue = filteredOrders.filter((o) => o.status === 'PAID').reduce((s, o) => s + (o.totalValue || 0), 0);
    const pendingValue = filteredOrders.filter((o) => o.status !== 'PAID').reduce((s, o) => s + (o.totalValue || 0), 0);
    return {
      count: filteredOrders.length,
      totalLiters,
      totalValue,
      avgUnitPrice,
      paidCount,
      pendingCount,
      paidValue,
      pendingValue,
    };
  }, [filteredOrders]);

  const projection = useMemo(() => calcVibraProjection(allDbOrders || []), [allDbOrders]);
  const annualHistory = useMemo(() => calcVibraAnnualHistory(historyYear, allDbOrders || []), [historyYear, allDbOrders]);

  const handleQuickMarkPaid = async (orderId: string) => {
    if (!user) return;
    try {
      await updateVibraOrder(orderId, { status: 'PAID' }, user.uid);
      toast.success('Fatura marcada como PAGA com sucesso!');
      load();
      loadAllDbOrders();
    } catch (err) {
      console.error('Erro ao atualizar status da fatura:', err);
      toast.error('Erro ao atualizar status da fatura.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    try {
      await deleteVibraOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success('Pedido excluído.');
      load();
      loadAllDbOrders();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleClearPeriod = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    setClearing(true);
    try {
      const deletedCount = await deleteVibraOrdersByCompetence(competence);
      toast.success(`${deletedCount} faturas de ${selMonth}/${selYear} removidas.`);
      setConfirmClearAll(false);
      load();
      loadAllDbOrders();
    } catch (err) {
      console.error('Erro ao limpar período:', err);
      toast.error('Erro ao limpar faturas do período.');
    } finally {
      setClearing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'Mês,Emissão,Pagamento,Litros Pedidos,Vlr Unit (R$),Vlr Total,Nº Pedido\nAGOSTO,15/08/2026,29/08/2026,15000,5.80,87000.00,4231521';
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_vibra.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveOrder = async (form: {
    issueDate: string;
    paymentDate: string;
    orderNumber: string;
    invoiceNumber: string;
    liters: string;
    unitPrice: string;
    status: VibraStatus;
  }) => {
    if (!user) return;
    setSaving(true);
    try {
      const liters = parseBRNumber(form.liters);
      const unitPrice = parseBRNumber(form.unitPrice);
      const totalValue = +(liters * unitPrice).toFixed(2);

      const issueDate = new Date(form.issueDate + 'T12:00:00');
      const paymentDate = form.paymentDate ? new Date(form.paymentDate + 'T12:00:00') : undefined;
      const compDate = paymentDate || issueDate;
      const orderCompetence = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}`;

      if (editingOrder) {
        await updateVibraOrder(
          editingOrder.id,
          {
            competence: orderCompetence,
            issueDate,
            paymentDate: paymentDate || undefined,
            liters,
            unitPrice,
            totalValue,
            orderNumber: form.orderNumber ? form.orderNumber.trim() : undefined,
            invoiceNumber: form.invoiceNumber ? form.invoiceNumber.trim() : undefined,
            status: form.status,
          },
          user.uid
        );
        toast.success('Pedido atualizado com sucesso!');
      } else {
        await createVibraOrder(
          {
            competence: orderCompetence,
            issueDate,
            paymentDate: paymentDate || undefined,
            liters,
            unitPrice,
            orderNumber: form.orderNumber ? form.orderNumber.trim() : undefined,
            invoiceNumber: form.invoiceNumber ? form.invoiceNumber.trim() : undefined,
            status: form.status,
          },
          user.uid
        );
        toast.success('Pedido criado com sucesso!');
      }

      setModalOpen(false);
      load();
      loadAllDbOrders();
    } catch (err) {
      console.error('Erro ao salvar pedido:', err);
      toast.error('Erro ao salvar pedido');
    } finally {
      setSaving(false);
    }
  };

  const handleExportMonthlyPDF = () => {
    if (orders.length === 0) {
      toast.error('Nenhum dado para exportar.');
      return;
    }
    const columns = [
      'Data Emissão',
      'Nº Pedido / NF',
      'Litros',
      'Preço/L',
      'Valor Total',
      'Vencimento',
      'Status',
    ];
    const rows = filteredOrders.map((o) => [
      formatDate(o.issueDate),
      o.orderNumber ? `#${o.orderNumber}${o.invoiceNumber ? ` (NF: ${o.invoiceNumber})` : ''}` : o.invoiceNumber || '—',
      `${formatNumber(o.liters, 2)} L`,
      `R$ ${formatNumber(o.unitPrice, 3)}`,
      formatCurrency(o.totalValue),
      o.paymentDate ? formatDate(o.paymentDate) : '—',
      VIBRA_STATUS_LABELS[o.status] || o.status,
    ]);
    const foot = [
      [
        'Total',
        `${filteredTotals.count} pedidos`,
        `${formatNumber(filteredTotals.totalLiters, 2)} L`,
        `R$ ${formatNumber(filteredTotals.avgUnitPrice, 3)}`,
        formatCurrency(filteredTotals.totalValue),
        `Pago: ${formatCurrency(filteredTotals.paidValue)}`,
        `Pendente: ${formatCurrency(filteredTotals.pendingValue)}`,
      ],
    ];
    exportToPDF(
      `Relatório de Lançamentos Vibra - ${selMonth}/${selYear}`,
      columns,
      rows,
      `vibra_lancamentos_${competence}`,
      {
        subtitle: `Competência: ${selMonth}/${selYear} | Filtro: ${
          viewFilter === 'all'
            ? 'Todos os Lançamentos'
            : viewFilter === 'payment'
            ? 'Vencimentos no Mês'
            : viewFilter === 'issue'
            ? 'Pedidos Emitidos no Mês'
            : 'Pendentes a Pagar'
        }`,
        summaryInfo: [
          { label: 'Litros Pedidos', value: `${formatNumber(filteredTotals.totalLiters, 0)} L` },
          { label: 'Total Pedido', value: formatCurrency(filteredTotals.totalValue) },
          { label: 'Preço Médio/L', value: `R$ ${formatNumber(filteredTotals.avgUnitPrice, 3)}` },
          { label: 'Já Pago', value: formatCurrency(filteredTotals.paidValue) },
          { label: 'Pendente', value: formatCurrency(filteredTotals.pendingValue) },
        ],
        foot,
      }
    );
  };

  const handleExportProjectionPDF = () => {
    if (projection.bills.length === 0) {
      toast.error('Nenhuma fatura pendente para exportar.');
      return;
    }
    const columns = [
      'Vencimento',
      'Prazo / Urgência',
      'Nº Pedido / NF',
      'Data Emissão',
      'Litros',
      'Preço/L',
      'Valor Fatura',
    ];
    const rows = projection.bills.map((b) => [
      formatDate(b.dueDate),
      b.statusCategory === 'overdue'
        ? `Vencido há ${Math.abs(b.daysRemaining)} dia(s)`
        : b.statusCategory === 'today'
        ? 'Vence Hoje!'
        : `Vence em ${b.daysRemaining} dia(s)`,
      b.order.orderNumber ? `#${b.order.orderNumber}` : b.order.invoiceNumber || '—',
      formatDate(b.order.issueDate),
      `${formatNumber(b.order.liters, 2)} L`,
      `R$ ${formatNumber(b.order.unitPrice, 3)}`,
      formatCurrency(b.order.totalValue),
    ]);
    const foot = [
      [
        'Total Geral a Pagar',
        `${projection.bills.length} faturas pendentes`,
        '—',
        '—',
        `${formatNumber(projection.bills.reduce((s, b) => s + (b.order.liters || 0), 0), 2)} L`,
        '—',
        formatCurrency(projection.totalPendingValue),
      ],
    ];
    exportToPDF(
      'Projeção de Faturas a Pagar - Vibra Combustíveis',
      columns,
      rows,
      `vibra_projecao_faturas_${toYearMonth(new Date())}`,
      {
        subtitle: 'Cronograma e previsão de fluxo de caixa futuro para pagamento à Vibra',
        summaryInfo: [
          { label: 'Total a Pagar em Aberto', value: formatCurrency(projection.totalPendingValue) },
          { label: 'Vencidas', value: `${formatCurrency(projection.overdueValue)} (${projection.overdueCount} faturas)` },
          { label: 'Próximos 7 Dias', value: `${formatCurrency(projection.next7DaysValue)} (${projection.next7DaysCount} faturas)` },
          { label: '8 a 30 Dias', value: `${formatCurrency(projection.next30DaysValue)} (${projection.next30DaysCount} faturas)` },
        ],
        foot,
      }
    );
  };

  const handleExportHistoryPDF = () => {
    const columns = [
      'Mês',
      'Pedidos',
      'Volume (Litros)',
      'Preço Médio/L',
      'Total Compras (Emissão)',
      'Vencimentos do Mês',
      'Total Pago (Caixa)',
      'Total Pendente',
    ];
    const rows = annualHistory.months.map((m) => [
      `${m.monthLabel}/${historyYear}`,
      m.issuedOrderCount,
      `${formatNumber(m.issuedTotalLiters, 0)} L`,
      m.issuedAvgUnitPrice > 0 ? `R$ ${formatNumber(m.issuedAvgUnitPrice, 3)}` : '—',
      formatCurrency(m.issuedTotalValue),
      formatCurrency(m.dueTotalValue),
      formatCurrency(m.duePaidValue),
      m.duePendingValue > 0 ? formatCurrency(m.duePendingValue) : '—',
    ]);
    const foot = [
      [
        `Total Acumulado ${historyYear}`,
        `${annualHistory.totalIssuedOrders} pedidos`,
        `${formatNumber(annualHistory.totalIssuedLiters, 0)} L`,
        `R$ ${formatNumber(annualHistory.avgIssuedUnitPrice, 3)}`,
        formatCurrency(annualHistory.totalIssuedValue),
        formatCurrency(annualHistory.totalDueValue),
        formatCurrency(annualHistory.totalPaidValue),
        formatCurrency(annualHistory.totalPendingValue),
      ],
    ];
    exportToPDF(
      `Histórico Anual Consolidado Vibra - ${historyYear}`,
      columns,
      rows,
      `vibra_historico_anual_${historyYear}`,
      {
        subtitle: `Demonstrativo anual consolidado de compras faturadas e desembolsos de caixa (${historyYear})`,
        summaryInfo: [
          { label: 'Litros Comprados', value: `${formatNumber(annualHistory.totalIssuedLiters, 0)} L` },
          { label: 'Total em Compras', value: formatCurrency(annualHistory.totalIssuedValue) },
          { label: 'Total Liquidado', value: formatCurrency(annualHistory.totalPaidValue) },
          { label: 'Preço Médio Anual', value: `R$ ${formatNumber(annualHistory.avgIssuedUnitPrice, 3)}/L` },
        ],
        foot,
      }
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
      complete: async (results: any) => {
        try {
          const rows = results.data as Record<string, any>[];
          if (!rows || rows.length === 0) {
            toast.error('Arquivo vazio ou formato não reconhecido.');
            return;
          }

          const newOrders: Omit<VibraOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [];
          const competencesEncountered = new Set<string>();

          for (const row of rows) {
            const firstColKey = Object.keys(row)[0];
            const firstColVal = firstColKey ? String(row[firstColKey] || '').trim() : '';

            const rawMonth = getColValue(row, 'Mês', 'Mes', 'Competência', 'Competencia') || firstColVal;
            const upperMonth = normKey(rawMonth).toUpperCase();

            let detectedMonthCode: string | undefined = undefined;
            for (const [mName, mCode] of Object.entries(MONTH_MAP)) {
              if (normKey(mName) === upperMonth) {
                detectedMonthCode = mCode;
                break;
              }
            }

            const emissaoStr = getColValue(row, 'Emissão', 'Emissao', 'Data Emissão', 'Data', 'DataEmissao');
            const pagamentoStr = getColValue(row, 'Pagamento', 'Data Pagamento', 'Vencimento', 'Data Vencimento', 'DataPagamento');
            const litrosStr = getColValue(row, 'Litros Pedidos', 'Litros', 'Volume', 'Qtd', 'Quantidade', 'LitrosPedidos');
            const unitPriceStr = getColValue(row, 'Vlr Unit (R$)', 'Vlr Unit', 'Valor Unitario', 'Valor Unitário', 'Preço/L', 'Preco/L', 'Preço', 'Preco');
            const totalValueStr = getColValue(row, 'Vlr Total', 'Valor Total', 'Total', 'Valor', 'VlrTotal');

            let orderNumber = getColValue(row, 'Nº Pedido / NF', 'Nº Pedido', 'Pedido', 'Ordem', 'Numero Pedido', 'NF', 'Nota Fiscal', 'Nº NF');
            if (!orderNumber && firstColVal && !detectedMonthCode && /^\d+$/.test(firstColVal)) {
              orderNumber = firstColVal;
            }

            if (!emissaoStr && !pagamentoStr && !litrosStr) {
              continue;
            }

            const issueDate = parseBRDate(emissaoStr) || parseBRDate(pagamentoStr) || new Date();
            const paymentDate = parseBRDate(pagamentoStr) || undefined;

            let rowCompetence = competence;
            if (paymentDate) {
              rowCompetence = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
            } else if (issueDate) {
              rowCompetence = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
            } else if (detectedMonthCode) {
              const yr = Number(selYear) || new Date().getFullYear();
              rowCompetence = `${yr}-${detectedMonthCode}`;
            }

            competencesEncountered.add(rowCompetence);

            const liters = parseBRNumber(litrosStr);
            let unitPrice = parseBRNumber(unitPriceStr);
            let totalValue = parseBRNumber(totalValueStr);

            if (totalValue === 0 && liters > 0 && unitPrice > 0) {
              totalValue = +(liters * unitPrice).toFixed(2);
            }
            if (unitPrice === 0 && liters > 0 && totalValue > 0) {
              unitPrice = +(totalValue / liters).toFixed(3);
            }

            newOrders.push({
              competence: rowCompetence,
              issueDate: issueDate,
              paymentDate: paymentDate || undefined,
              liters,
              unitPrice,
              totalValue,
              orderNumber: orderNumber ? String(orderNumber).trim() : undefined,
              status: 'PAID',
            });
          }

          if (newOrders.length > 0) {
            const createdCount = await batchCreate(COLLECTIONS.VIBRA_ORDERS, newOrders, user.uid);
            const countMonths = competencesEncountered.size;
            toast.success(`${createdCount} pedidos Vibra importados em ${countMonths} ${countMonths === 1 ? 'mês' : 'meses'}!`);

            load();
            loadAllDbOrders();
          } else {
            toast.error('Nenhum dado válido encontrado no CSV para importar.');
          }
        } catch (err: any) {
          console.error('Erro na importação:', err);
          toast.error(`Erro ao processar o CSV: ${err?.message || 'Falha desconhecida'}`);
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        console.error('Papa parse error:', err);
        toast.error('Falha ao ler o arquivo CSV.');
        setImporting(false);
      },
    });
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="page-container animate-fade-in space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Controle Vibra
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Gestão de pedidos, faturas, projeção de pagamentos e histórico de combustível
          </p>
        </div>

        {/* Action Controls for Active Tab */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {mainTab === 'monthly' && (
            <>
              <select
                value={selYear}
                onChange={(e) => setCompetence(`${e.target.value}-${selMonth}`)}
                className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
                style={selectStyle}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                value={selMonth}
                onChange={(e) => setCompetence(`${selYear}-${e.target.value}`)}
                className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
                style={selectStyle}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleExportMonthlyPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                title="Exportar relatório de lançamentos do mês em PDF"
              >
                <FileText size={15} className="text-blue-400" />
                <span>Exportar PDF</span>
              </button>

              {isAdmin && (
                <div className="flex items-center flex-wrap gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    title="Importar planilha de faturas Vibra"
                  >
                    <Upload size={16} /> {importing ? 'Importando...' : 'Importar CSV'}
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    title="Baixar modelo de CSV"
                  >
                    <Download size={16} /> Modelo
                  </button>
                  <button
                    onClick={() => {
                      setEditingOrder(null);
                      setModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      boxShadow: '0 2px 12px rgba(37,99,235,0.4)',
                    }}
                  >
                    <Plus size={16} /> Novo Pedido
                  </button>

                  {orders.length > 0 && (
                    <button
                      onClick={handleClearPeriod}
                      disabled={clearing}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
                        confirmClearAll
                          ? 'bg-red-500 text-white border-red-600 animate-pulse'
                          : 'hover:bg-red-500/10 text-red-400 border-red-500/20'
                      )}
                      title="Limpar todos os pedidos importados deste mês selecionado"
                    >
                      <Trash2 size={15} />
                      {clearing ? 'Limpando...' : confirmClearAll ? 'Confirmar exclusão de todas?' : 'Limpar Mês'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {mainTab === 'projection' && (
            <div className="flex items-center gap-2">
              <button
                onClick={loadAllDbOrders}
                disabled={loadingDbAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <RefreshCw size={15} className={loadingDbAll ? 'animate-spin' : ''} />
                Atualizar
              </button>
              <button
                onClick={handleExportProjectionPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                title="Exportar projeção de faturas a pagar em PDF"
              >
                <FileText size={15} className="text-emerald-400" />
                <span>Exportar PDF</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingOrder(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  <Plus size={16} /> Novo Lançamento
                </button>
              )}
            </div>
          )}

          {mainTab === 'history' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium">Ano do Histórico:</label>
              <select
                value={historyYear}
                onChange={(e) => setHistoryYear(Number(e.target.value))}
                className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer font-bold"
                style={selectStyle}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={handleExportHistoryPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                title="Exportar histórico consolidado anual em PDF"
              >
                <FileText size={15} className="text-purple-400" />
                <span>Exportar PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setMainTab('monthly')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap',
            mainTab === 'monthly'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          )}
        >
          <Calendar size={16} />
          <span>Lançamentos do Mês ({selMonth}/{selYear})</span>
        </button>

        <button
          onClick={() => setMainTab('projection')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap',
            mainTab === 'projection'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          )}
        >
          <CalendarClock size={16} />
          <span>Projeção de Faturas a Pagar</span>
          {projection.totalPendingCount > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                projection.overdueCount > 0
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
              )}
            >
              {projection.totalPendingCount} pendente(s)
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('history')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap',
            mainTab === 'history'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          )}
        >
          <History size={16} />
          <span>Histórico Consolidado de Pedidos</span>
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      {mainTab === 'monthly' && (
        <VibraMonthlyTab
          orders={orders}
          filteredOrders={filteredOrders}
          filteredTotals={filteredTotals}
          summary={summary}
          loading={loading}
          viewFilter={viewFilter}
          setViewFilter={setViewFilter}
          selMonth={selMonth}
          selYear={selYear}
          competence={competence}
          isAdmin={isAdmin}
          confirmDelete={confirmDelete}
          onEditOrder={(order) => {
            setEditingOrder(order);
            setModalOpen(true);
          }}
          onDeleteOrder={handleDelete}
        />
      )}

      {mainTab === 'projection' && (
        <VibraProjectionTab
          projection={projection}
          isAdmin={isAdmin}
          onQuickMarkPaid={handleQuickMarkPaid}
        />
      )}

      {mainTab === 'history' && (
        <VibraHistoryTab
          annualHistory={annualHistory}
          historyYear={historyYear}
          onNavigateToMonth={(comp) => {
            setCompetence(comp);
            setMainTab('monthly');
          }}
        />
      )}

      {/* Modal Criar / Editar Pedido */}
      <VibraOrderModal
        isOpen={modalOpen}
        order={editingOrder}
        defaultYear={selYear}
        defaultMonth={selMonth}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveOrder}
        saving={saving}
      />
    </div>
  );
}
