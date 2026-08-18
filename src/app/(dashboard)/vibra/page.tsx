'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  Plus,
  Edit2,
  Trash2,
  Droplets,
  DollarSign,
  Upload,
  Download,
  X,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  Clock,
  Wallet,
  Calendar,
  Layers,
  TrendingUp,
  BarChart3,
  CalendarClock,
  History,
  Check,
  AlertCircle,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  getVibraOrders,
  deleteVibraOrder,
  deleteVibraOrdersByCompetence,
  getVibraSummary,
  createVibraOrder,
  updateVibraOrder,
  getVibraOrderCompetence,
  getVibraOrderIssueCompetence,
  getVibraOrderPaymentCompetence,
  calcVibraProjection,
  calcVibraAnnualHistory,
  VibraSummary,
  VibraProjectionSummary,
  VibraAnnualHistory,
} from '@/services/expenses';
import { exportToPDF } from '@/lib/utils/exportUtils';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
import { VibraOrder, VibraStatus } from '@/lib/types';
import { formatCurrency, formatNumber, formatDate, toYearMonth, cn } from '@/lib/utils';
import { MONTHS, YEARS, VIBRA_STATUS_LABELS } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/hooks/useAuth';
import Papa from 'papaparse';
import { batchCreate, COLLECTIONS } from '@/lib/firebase/firestore';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

// Helpers for robust CSV parsing
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
      // YYYY-MM-DD
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    } else {
      // DD/MM/YYYY or DD/MM/YY
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
  'JANEIRO': '01', 'JAN': '01',
  'FEVEREIRO': '02', 'FEV': '02',
  'MARCO': '03', 'MARÇO': '03', 'MAR': '03',
  'ABRIL': '04', 'ABR': '04',
  'MAIO': '05', 'MAI': '05',
  'JUNHO': '06', 'JUN': '06',
  'JULHO': '07', 'JUL': '07',
  'AGOSTO': '08', 'AGO': '08',
  'SETEMBRO': '09', 'SET': '09',
  'OUTUBRO': '10', 'OUT': '10',
  'NOVEMBRO': '11', 'NOV': '11',
  'DEZEMBRO': '12', 'DEZ': '12',
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
  
  // Modal state (Create & Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<VibraOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    issueDate: formatDate(new Date()).split('/').reverse().join('-'),
    paymentDate: '',
    orderNumber: '',
    invoiceNumber: '',
    liters: '',
    unitPrice: '',
    status: 'PAID' as VibraStatus,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selYear, selMonth] = competence.split('-');

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

  const [viewFilter, setViewFilter] = useState<'all' | 'payment' | 'issue' | 'pending'>('all');

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

  const [mainTab, setMainTab] = useState<'monthly' | 'projection' | 'history'>('monthly');
  const [historyYear, setHistoryYear] = useState<number>(Number(selYear) || new Date().getFullYear());

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

  const handleOpenCreateModal = () => {
    setEditingOrder(null);
    setFormData({
      issueDate: `${selYear}-${selMonth}-01`,
      paymentDate: '',
      orderNumber: '',
      invoiceNumber: '',
      liters: '',
      unitPrice: '',
      status: 'PAID',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (order: VibraOrder) => {
    setEditingOrder(order);
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
    setModalOpen(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const liters = parseBRNumber(formData.liters);
      const unitPrice = parseBRNumber(formData.unitPrice);
      const totalValue = +(liters * unitPrice).toFixed(2);
      
      const issueDate = new Date(formData.issueDate + 'T12:00:00');
      const paymentDate = formData.paymentDate ? new Date(formData.paymentDate + 'T12:00:00') : undefined;
      
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
            orderNumber: formData.orderNumber ? formData.orderNumber.trim() : undefined,
            invoiceNumber: formData.invoiceNumber ? formData.invoiceNumber.trim() : undefined,
            status: formData.status,
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
            orderNumber: formData.orderNumber ? formData.orderNumber.trim() : undefined,
            invoiceNumber: formData.invoiceNumber ? formData.invoiceNumber.trim() : undefined,
            status: formData.status,
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

          let rowIdx = 0;
          for (const row of rows) {
            rowIdx++;
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
                    onClick={handleOpenCreateModal}
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
                  onClick={handleOpenCreateModal}
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

      {/* TAB 1: MONTHLY LAUNCHES & BILLS */}
      {mainTab === 'monthly' && (
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
                    <th className="text-right px-4 py-3">Litros Pedidos</th>
                    <th className="text-right px-4 py-3">Preço/L</th>
                    <th className="text-right px-4 py-3">Valor Total</th>
                    <th className="text-center px-4 py-3">Vencimento / Pagamento</th>
                    <th className="text-center px-4 py-3">Status</th>
                    {isAdmin && <th className="w-24 px-4 py-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-5" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
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
                          className="border-t hover:bg-white/[0.02] transition-colors"
                          style={{ borderColor: 'var(--border-subtle)' }}
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-col">
                              <span style={{ color: 'var(--text-primary)' }}>
                                {formatDate(o.issueDate)}
                              </span>
                              {!isIssueThisMonth && (
                                <span className="text-[10px] text-blue-400 font-medium">
                                  (Emitido em {formatDate(o.issueDate).substring(3)})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {o.orderNumber ? (
                              <span>Pedido #{o.orderNumber}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                            {o.invoiceNumber && (
                              <span className="ml-1 text-xs opacity-75 font-normal" style={{ color: 'var(--text-secondary)' }}>
                                (NF: {o.invoiceNumber})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-blue-400">
                            {formatNumber(o.liters, 2)} L
                          </td>
                          <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                            R$ {formatNumber(o.unitPrice, 3)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-slate-100">
                            {formatCurrency(o.totalValue)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {o.paymentDate ? (
                              <div className="flex flex-col items-center">
                                <span
                                  className={cn(
                                    'font-medium',
                                    o.status === 'PAID'
                                      ? 'text-emerald-400'
                                      : 'text-amber-400'
                                  )}
                                >
                                  {formatDate(o.paymentDate)}
                                </span>
                                {!isPaymentThisMonth && (
                                  <span className="text-[10px] text-slate-500">
                                    (Vence em {formatDate(o.paymentDate).substring(3)})
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
                                'inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full',
                                o.status === 'PAID'
                                  ? 'badge-paid'
                                  : o.status === 'PENDING'
                                  ? 'badge-pending'
                                  : 'badge-partial'
                              )}
                            >
                              {VIBRA_STATUS_LABELS[o.status] || o.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(o)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                  style={{ color: 'var(--text-secondary)' }}
                                  title="Editar pedido"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(o.id)}
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
      )}

      {/* TAB 2: PROJECTION & FUTURE BILLS */}
      {mainTab === 'projection' && (
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
                <span className="text-xs text-slate-400">Faturas Vencidas</span>
                <AlertTriangle
                  size={18}
                  className={projection.overdueCount > 0 ? 'text-red-400' : 'text-slate-500'}
                />
              </div>
              <p
                className={cn(
                  'text-2xl font-bold',
                  projection.overdueCount > 0 ? 'text-red-400' : 'text-slate-300'
                )}
              >
                {formatCurrency(projection.overdueValue)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {projection.overdueCount} fatura(s) em atraso
              </p>
            </div>

            <div className="kpi-card border-yellow-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">A Vencer nos Próximos 7 Dias</span>
                <CalendarClock size={18} className="text-yellow-400" />
              </div>
              <p className="text-2xl font-bold text-yellow-400">
                {formatCurrency(projection.next7DaysValue)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {projection.next7DaysCount} fatura(s) vencendo esta semana
              </p>
            </div>

            <div className="kpi-card border-blue-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">A Vencer em 8 a 30 Dias</span>
                <Calendar size={18} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(projection.next30DaysValue)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {projection.next30DaysCount} fatura(s) no próximo mês
              </p>
            </div>
          </div>

          {/* Monthly Cash Outflow Timeline Chart */}
          {projection.monthlyTimeline.length > 0 && (
            <div
              className="rounded-2xl p-6 border shadow-md"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <BarChart3 size={18} className="text-emerald-400" />
                    Projeção de Desembolso / Vencimentos por Mês
                  </h3>
                  <p className="text-xs text-slate-400">
                    Previsão de pagamentos distribuída mês a mês (Faturas Pagas vs Pendentes)
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ApexChart
                  type="bar"
                  height={280}
                  series={[
                    {
                      name: 'Faturas Pagas',
                      data: projection.monthlyTimeline.map((m) => m.paidValue),
                    },
                    {
                      name: 'Faturas Pendentes',
                      data: projection.monthlyTimeline.map((m) => m.pendingValue),
                    },
                  ]}
                  options={{
                    chart: {
                      type: 'bar',
                      stacked: true,
                      toolbar: { show: false },
                      background: 'transparent',
                    },
                    theme: { mode: 'dark' },
                    colors: ['#10b981', '#f59e0b'],
                    plotOptions: {
                      bar: {
                        borderRadius: 6,
                        columnWidth: '45%',
                      },
                    },
                    dataLabels: { enabled: false },
                    stroke: { width: 0 },
                    xaxis: {
                      categories: projection.monthlyTimeline.map((m) => m.monthLabel),
                      labels: { style: { colors: '#94a3b8', fontSize: '12px' } },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: {
                      labels: {
                        style: { colors: '#94a3b8', fontSize: '11px' },
                        formatter: (val) => `R$ ${(val / 1000).toFixed(0)}k`,
                      },
                    },
                    grid: {
                      borderColor: '#1e293b',
                      strokeDashArray: 4,
                    },
                    tooltip: {
                      theme: 'dark',
                      y: {
                        formatter: (val) => formatCurrency(val),
                      },
                    },
                    legend: {
                      position: 'top',
                      horizontalAlign: 'right',
                      labels: { colors: '#94a3b8' },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {/* Pending Bills Timeline Table */}
          <div
            className="rounded-2xl border overflow-hidden shadow-md"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <Clock size={18} className="text-amber-400" />
                  Cronograma de Faturas a Pagar da Vibra
                </h3>
                <p className="text-xs text-slate-400">
                  Todas as faturas pendentes organizadas por ordem de vencimento
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {projection.bills.length} faturas em aberto
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full data-table min-w-[750px]">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-left px-4 py-3">Prazo / Urgência</th>
                    <th className="text-left px-4 py-3">Nº Pedido / NF</th>
                    <th className="text-left px-4 py-3">Data Emissão</th>
                    <th className="text-right px-4 py-3">Litros</th>
                    <th className="text-right px-4 py-3">Preço/L</th>
                    <th className="text-right px-4 py-3">Valor da Fatura</th>
                    {isAdmin && <th className="w-36 px-4 py-3 text-right">Ação Rápida</th>}
                  </tr>
                </thead>
                <tbody>
                  {projection.bills.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400/40" />
                        <p className="font-semibold text-emerald-400">
                          Tudo em dia! Nenhuma fatura pendente de pagamento.
                        </p>
                        <p className="text-xs mt-1 text-slate-500">
                          Todas as faturas cadastradas no sistema já foram liquidadas.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    projection.bills.map((bill) => {
                      const o = bill.order;
                      return (
                        <tr
                          key={bill.id}
                          className={cn(
                            'border-t transition-colors',
                            bill.statusCategory === 'overdue'
                              ? 'bg-red-950/20 hover:bg-red-950/40 border-red-900/40'
                              : bill.statusCategory === 'today'
                              ? 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-900/40'
                              : 'hover:bg-white/[0.02] border-slate-800'
                          )}
                        >
                          <td className="px-4 py-3 text-sm font-bold">
                            <span
                              className={cn(
                                bill.statusCategory === 'overdue'
                                  ? 'text-red-400'
                                  : bill.statusCategory === 'today'
                                  ? 'text-amber-400'
                                  : 'text-slate-100'
                              )}
                            >
                              {formatDate(bill.dueDate)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {bill.statusCategory === 'overdue' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                                <AlertTriangle size={12} />
                                Vencido há {Math.abs(bill.daysRemaining)} dia(s)
                              </span>
                            )}
                            {bill.statusCategory === 'today' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 animate-pulse">
                                <Clock size={12} />
                                Vence Hoje!
                              </span>
                            )}
                            {bill.statusCategory === 'next_7_days' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 font-medium border border-yellow-500/40">
                                <Clock size={12} />
                                Vence em {bill.daysRemaining} dia(s)
                              </span>
                            )}
                            {bill.statusCategory === 'next_30_days' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/40">
                                <Calendar size={12} />
                                Vence em {bill.daysRemaining} dia(s)
                              </span>
                            )}
                            {bill.statusCategory === 'future' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                                <Calendar size={12} />
                                Vence em {bill.daysRemaining} dias
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-100">
                            {o.orderNumber ? <span>Pedido #{o.orderNumber}</span> : '—'}
                            {o.invoiceNumber && (
                              <span className="ml-1 text-xs opacity-75 font-normal text-slate-400">
                                (NF: {o.invoiceNumber})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {formatDate(o.issueDate)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-blue-400">
                            {formatNumber(o.liters, 2)} L
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-400">
                            R$ {formatNumber(o.unitPrice, 3)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-amber-400">
                            {formatCurrency(o.totalValue)}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleQuickMarkPaid(o.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 transition-all shadow-sm"
                                  title="Marcar esta fatura como paga"
                                >
                                  <Check size={13} />
                                  <span>Dar Baixa</span>
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(o)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                                  title="Editar detalhes da fatura"
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {projection.bills.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={4} className="px-4 py-3 font-semibold text-sm text-slate-100">
                        Total Geral a Pagar ({projection.bills.length} faturas pendentes)
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-blue-400">
                        {formatNumber(
                          projection.bills.reduce((s, b) => s + (b.order.liters || 0), 0),
                          2
                        )}{' '}
                        L
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-400">—</td>
                      <td className="px-4 py-3 text-right text-base font-bold text-amber-400">
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
      )}

      {/* TAB 3: CONSOLIDATED ORDER HISTORY */}
      {mainTab === 'history' && (
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
                    chart: {
                      type: 'bar',
                      toolbar: { show: false },
                      background: 'transparent',
                    },
                    theme: { mode: 'dark' },
                    colors: ['#3b82f6', '#10b981'],
                    plotOptions: {
                      bar: {
                        borderRadius: 4,
                        columnWidth: '55%',
                      },
                    },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: annualHistory.months.map((m) => m.monthLabel),
                      labels: { style: { colors: '#94a3b8', fontSize: '12px' } },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: {
                      labels: {
                        style: { colors: '#94a3b8', fontSize: '11px' },
                        formatter: (val) => `R$ ${(val / 1000).toFixed(0)}k`,
                      },
                    },
                    grid: {
                      borderColor: '#1e293b',
                      strokeDashArray: 4,
                    },
                    tooltip: {
                      theme: 'dark',
                      y: { formatter: (val) => formatCurrency(val) },
                    },
                    legend: {
                      position: 'top',
                      horizontalAlign: 'right',
                      labels: { colors: '#94a3b8' },
                    },
                  }}
                />
              </div>
            </div>

            {/* Chart 2: Volume & Average Price Evolution */}
            <div
              className="rounded-2xl p-6 border shadow-md"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <TrendingUp size={18} className="text-cyan-400" />
                    Volume de Litros & Preço Médio por Litro ({historyYear})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evolução do volume comprado (L) e do preço unitário médio (R$/L)
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
                      name: 'Preço Médio (R$/L)',
                      type: 'line',
                      data: annualHistory.months.map((m) => +m.issuedAvgUnitPrice.toFixed(3)),
                    },
                  ]}
                  options={{
                    chart: {
                      type: 'line',
                      toolbar: { show: false },
                      background: 'transparent',
                    },
                    theme: { mode: 'dark' },
                    colors: ['#06b6d4', '#f59e0b'],
                    stroke: {
                      width: [0, 3],
                      curve: 'smooth',
                    },
                    plotOptions: {
                      bar: {
                        borderRadius: 4,
                        columnWidth: '50%',
                      },
                    },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: annualHistory.months.map((m) => m.monthLabel),
                      labels: { style: { colors: '#94a3b8', fontSize: '12px' } },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: [
                      {
                        title: { text: 'Litros', style: { color: '#06b6d4' } },
                        labels: {
                          style: { colors: '#94a3b8', fontSize: '11px' },
                          formatter: (val) => `${(val / 1000).toFixed(0)}k L`,
                        },
                      },
                      {
                        opposite: true,
                        title: { text: 'Preço/L (R$)', style: { color: '#f59e0b' } },
                        labels: {
                          style: { colors: '#94a3b8', fontSize: '11px' },
                          formatter: (val) => `R$ ${val.toFixed(2)}`,
                        },
                      },
                    ],
                    grid: {
                      borderColor: '#1e293b',
                      strokeDashArray: 4,
                    },
                    tooltip: {
                      theme: 'dark',
                    },
                    legend: {
                      position: 'top',
                      horizontalAlign: 'right',
                      labels: { colors: '#94a3b8' },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Consolidated Monthly Breakdown Table */}
          <div
            className="rounded-2xl border overflow-hidden shadow-md"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-purple-400" />
                  Evolução Consolidada Mês a Mês ({historyYear})
                </h3>
                <p className="text-xs text-slate-400">
                  Resumo gerencial de compras, desembolsos e preços médios de todos os meses
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full data-table min-w-[800px]">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th className="text-left px-4 py-3">Mês</th>
                    <th className="text-right px-4 py-3">Pedidos Emitidos</th>
                    <th className="text-right px-4 py-3">Volume Comprado</th>
                    <th className="text-right px-4 py-3">Preço Médio/L</th>
                    <th className="text-right px-4 py-3">Total Compras (R$)</th>
                    <th className="text-right px-4 py-3">Vencimentos do Mês</th>
                    <th className="text-right px-4 py-3">Total Pago (R$)</th>
                    <th className="text-right px-4 py-3">Total Pendente (R$)</th>
                    <th className="w-28 px-4 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {annualHistory.months.map((m) => {
                    const hasData = m.issuedOrderCount > 0 || m.dueOrderCount > 0;
                    return (
                      <tr
                        key={m.month}
                        className={cn(
                          'hover:bg-white/[0.02] transition-colors',
                          !hasData ? 'opacity-50' : ''
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-bold text-slate-100">
                          {m.monthLabel}/{historyYear}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-300">
                          {m.issuedOrderCount}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-blue-400">
                          {formatNumber(m.issuedTotalLiters, 0)} L
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-300">
                          {m.issuedAvgUnitPrice > 0 ? `R$ ${formatNumber(m.issuedAvgUnitPrice, 3)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-100">
                          {formatCurrency(m.issuedTotalValue)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-300">
                          {formatCurrency(m.dueTotalValue)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-400">
                          {formatCurrency(m.duePaidValue)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-amber-400">
                          {m.duePendingValue > 0 ? formatCurrency(m.duePendingValue) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setCompetence(m.month);
                              setMainTab('monthly');
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 transition-all flex items-center justify-center gap-1 mx-auto"
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
      )}

      {/* Modal Novo/Editar Pedido — rendered via portal to bypass containing block */}
      {modalOpen && createPortal(
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
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="animate-scale-in" style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '28rem', margin: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingOrder ? 'Editar Pedido Vibra' : 'Novo Pedido Vibra'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4">
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

              {formData.liters && formData.unitPrice && (
                <div
                  className="p-3 rounded-xl border flex items-center justify-between text-sm"
                  style={{ background: 'var(--bg-main)', borderColor: 'var(--border)' }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Total Estimado:</span>
                  <span className="font-bold text-blue-400">
                    {formatCurrency(parseBRNumber(formData.liters) * parseBRNumber(formData.unitPrice))}
                  </span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-3">
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
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
                >
                  {saving ? 'Salvando...' : editingOrder ? 'Salvar Alterações' : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
