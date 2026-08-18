'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Bug,
  RefreshCw,
  Database,
  Info,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  getVibraOrders,
  deleteVibraOrder,
  deleteVibraOrdersByCompetence,
  getVibraSummary,
  createVibraOrder,
  updateVibraOrder,
  VibraSummary,
} from '@/services/expenses';
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

const MONTH_NAME_MAP: Record<string, string> = {
  'JANEIRO': '01', 'JAN': '01',
  'FEVEREIRO': '02', 'FEV': '02',
  'MARÇO': '03', 'MARCO': '03', 'MAR': '03',
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

interface DebugLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error';
  title: string;
  details?: any;
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
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Debug Panel State
  const [showDebug, setShowDebug] = useState(false);
  const [debugTab, setDebugTab] = useState<'db' | 'logs'>('db');
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
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

  const addDebugLog = (type: DebugLog['type'], title: string, details?: any) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setDebugLogs((prev) => [
      { id: Math.random().toString(36).substring(7), time, type, title, details },
      ...prev,
    ]);
  };

  const loadAllDbOrders = useCallback(async () => {
    setLoadingDbAll(true);
    try {
      addDebugLog('info', 'Consultando coleção vibraOrders sem filtro...');
      const all = await getVibraOrders();
      setAllDbOrders(all);
      addDebugLog(
        'success',
        `Consulta concluída: ${all.length} documento(s) encontrado(s) no Firestore.`,
        { total: all.length, amostra: all.slice(0, 3) }
      );
    } catch (err: any) {
      console.error('Erro ao consultar banco geral:', err);
      addDebugLog('error', 'Falha ao buscar todos os registros do Firestore', err?.message || err);
      toast.error('Erro ao consultar banco de dados.');
    } finally {
      setLoadingDbAll(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        getVibraOrders(competence),
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    setShowDebug(true);
    setDebugTab('logs');
    addDebugLog('info', `Iniciando leitura do arquivo: ${file.name} (${file.size} bytes)...`);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
      complete: async (results: any) => {
        try {
          addDebugLog('info', 'Arquivo CSV analisado pelo PapaParse', {
            delimitador: results.meta.delimiter,
            camposDetectados: results.meta.fields,
            totalLinhasBrutas: results.data?.length,
          });

          const rows = results.data as Record<string, any>[];
          if (!rows || rows.length === 0) {
            addDebugLog('error', 'Arquivo vazio ou sem linhas de dados reconhecidas.');
            toast.error('Arquivo vazio ou formato não reconhecido.');
            return;
          }

          const newOrders: Omit<VibraOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [];
          const competencesEncountered = new Set<string>();
          const skippedRows: any[] = [];

          let rowIdx = 0;
          for (const row of rows) {
            rowIdx++;
            const firstColKey = Object.keys(row)[0];
            const firstColVal = firstColKey ? String(row[firstColKey] || '').trim() : '';

            const rawMonth = getColValue(row, 'Mês', 'Mes', 'Competência', 'Competencia') || firstColVal;
            const upperMonth = normKey(rawMonth).toUpperCase();
            
            let detectedMonthCode: string | undefined = undefined;
            for (const [mName, mCode] of Object.entries(MONTH_NAME_MAP)) {
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
              skippedRows.push({ linha: rowIdx, motivo: 'Sem data nem litros', row });
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

          addDebugLog('info', `Processamento das linhas: ${newOrders.length} válidas, ${skippedRows.length} ignoradas.`, {
            competenciasDetectadas: Array.from(competencesEncountered),
            primeirasOrdens: newOrders.slice(0, 3),
            linhasIgnoradasAmostra: skippedRows.slice(0, 3),
          });

          if (newOrders.length > 0) {
            addDebugLog('info', `Gravando em lote (batchCreate) ${newOrders.length} registros no Firestore na coleção '${COLLECTIONS.VIBRA_ORDERS}'...`);
            const createdCount = await batchCreate(COLLECTIONS.VIBRA_ORDERS, newOrders, user.uid);

            addDebugLog('success', `Gravação no Firestore concluída com sucesso! ${createdCount} documentos inseridos.`, { totalInseridos: createdCount, competencias: Array.from(competencesEncountered) });
            
            const countMonths = competencesEncountered.size;
            toast.success(`${createdCount} pedidos Vibra importados em ${countMonths} ${countMonths === 1 ? 'mês' : 'meses'}!`);
            
            const currentInImported = competencesEncountered.has(competence);
            if (!currentInImported && competencesEncountered.size > 0) {
              const firstComp = Array.from(competencesEncountered)[0];
              toast.info(`Os dados foram importados para o período ${firstComp}. Use o seletor ou o Painel de Debug para visualizar.`, { duration: 6000 });
            }
            
            load();
            loadAllDbOrders();
          } else {
            addDebugLog('warn', 'Nenhum registro válido extraído do arquivo CSV.', { linhasBrutas: rows.slice(0, 5) });
            toast.error('Nenhum dado válido encontrado no CSV para importar.');
          }
        } catch (err: any) {
          console.error('Erro na importação:', err);
          addDebugLog('error', 'Exceção ao gravar dados no Firestore', { mensagem: err?.message || String(err), stack: err?.stack });
          toast.error(`Erro ao processar o CSV: ${err?.message || 'Falha desconhecida'}`);
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        console.error('Papa parse error:', err);
        addDebugLog('error', 'Falha do analisador PapaParse', err);
        toast.error('Falha ao ler o arquivo CSV.');
        setImporting(false);
      },
    });
  };

  const dbCompetenceBreakdown = (allDbOrders || []).reduce(
    (acc, order) => {
      const comp = order.competence || 'Sem competência';
      if (!acc[comp]) {
        acc[comp] = { count: 0, totalLiters: 0, totalValue: 0 };
      }
      acc[comp].count += 1;
      acc[comp].totalLiters += order.liters || 0;
      acc[comp].totalValue += order.totalValue || 0;
      return acc;
    },
    {} as Record<string, { count: number; totalLiters: number; totalValue: number }>
  );

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Controle Vibra
            </h1>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all',
                showDebug
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
              )}
              title="Abrir/Fechar painel de diagnóstico e debug do banco de dados"
            >
              <Bug size={13} className={showDebug ? 'text-amber-400' : 'text-slate-400'} />
              <span>Diagnóstico DB</span>
              {allDbOrders !== null && (
                <span className="px-1.5 py-0.2 bg-black/40 rounded text-[10px]">
                  {allDbOrders.length} no BD
                </span>
              )}
            </button>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Pedidos e notas de combustível Vibra
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
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
        </div>
      </div>

      {showDebug && (
        <div
          className="rounded-2xl border p-5 shadow-xl transition-all animate-fade-in"
          style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
            borderColor: '#1e293b',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Database size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                  Painel de Diagnóstico & Debug (Firestore / CSV)
                </h3>
                <p className="text-xs text-slate-400">
                  Verifique se o banco de dados está reconhecendo os registros e analise logs de
                  importação.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAllDbOrders}
                disabled={loadingDbAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 transition-all"
              >
                <RefreshCw size={13} className={loadingDbAll ? 'animate-spin' : ''} />
                {loadingDbAll ? 'Consultando...' : 'Atualizar Dados do Banco'}
              </button>

              <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setDebugTab('db')}
                  className={cn(
                    'px-3 py-1 rounded-md transition-all font-medium',
                    debugTab === 'db'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  Banco de Dados ({allDbOrders?.length ?? '?'})
                </button>
                <button
                  onClick={() => setDebugTab('logs')}
                  className={cn(
                    'px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1',
                    debugTab === 'logs'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  Logs ({debugLogs.length})
                </button>
              </div>

              <button
                onClick={() => setShowDebug(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
                title="Minimizar painel de debug"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {debugTab === 'db' && (
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Total Geral no Firestore</span>
                  <span className="text-xl font-bold text-slate-100">
                    {allDbOrders ? `${allDbOrders.length} pedidos` : 'Carregando...'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Competência Atual Selecionada</span>
                  <span className="text-xl font-bold text-blue-400">{competence}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    ({orders.length} pedidos encontrados para {selMonth}/{selYear})
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 block">Meses com Registros no Banco</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {Object.keys(dbCompetenceBreakdown).length} períodos
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Períodos / Competências Encontrados no Firestore (Coleção vibraOrders)
                </h4>
                {Object.keys(dbCompetenceBreakdown).length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhum pedido encontrado no banco de dados. Faça a importação de um CSV ou adicione um novo pedido.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {Object.entries(dbCompetenceBreakdown).map(([comp, data]) => {
                      const isCurrent = comp === competence;
                      return (
                        <div
                          key={comp}
                          className={cn(
                            'p-3 rounded-xl border flex items-center justify-between transition-all',
                            isCurrent
                              ? 'bg-blue-950/40 border-blue-500/60 shadow-md'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          )}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100">{comp}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500 text-white font-bold">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              <span>{data.count} pedidos</span> •{' '}
                              <span className="text-blue-300">{formatNumber(data.totalLiters, 0)} L</span> •{' '}
                              <span className="text-emerald-400">{formatCurrency(data.totalValue)}</span>
                            </div>
                          </div>

                          {!isCurrent && (
                            <button
                              onClick={() => setCompetence(comp)}
                              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-all"
                            >
                              Ver Mês <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {allDbOrders && allDbOrders.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Últimos Registros Salvos no Banco (Sem filtro de competência)
                  </h4>
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-2">ID Doc</th>
                          <th className="p-2">Competência</th>
                          <th className="p-2">Data Emissão</th>
                          <th className="p-2">Nº Pedido</th>
                          <th className="p-2 text-right">Litros</th>
                          <th className="p-2 text-right">Preço/L</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 text-slate-300">
                        {allDbOrders.slice(0, 8).map((o) => (
                          <tr key={o.id} className="hover:bg-slate-900/50">
                            <td className="p-2 font-mono text-[10px] text-slate-500">
                              {o.id?.substring(0, 8)}...
                            </td>
                            <td className="p-2 font-semibold text-blue-400">{o.competence}</td>
                            <td className="p-2">{formatDate(o.issueDate)}</td>
                            <td className="p-2">{o.orderNumber || '—'}</td>
                            <td className="p-2 text-right font-medium">{formatNumber(o.liters, 2)} L</td>
                            <td className="p-2 text-right">R$ {formatNumber(o.unitPrice, 3)}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">
                              {formatCurrency(o.totalValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {debugTab === 'logs' && (
            <div className="pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Histórico de eventos do processador CSV:</span>
                <button
                  onClick={() => setDebugLogs([])}
                  className="text-slate-400 hover:text-slate-200 underline"
                >
                  Limpar Logs
                </button>
              </div>

              {debugLogs.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  Nenhum log gravado ainda. Clique em &ldquo;Importar CSV&rdquo; ou &ldquo;Atualizar Dados do Banco&rdquo; para ver a execução em tempo real.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {debugLogs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        'p-3 rounded-xl border text-xs font-mono transition-all',
                        log.type === 'error'
                          ? 'bg-red-950/30 border-red-800/60 text-red-200'
                          : log.type === 'warn'
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                          : log.type === 'success'
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          {log.type === 'error' && <AlertTriangle size={14} className="text-red-400" />}
                          {log.type === 'success' && <CheckCircle2 size={14} className="text-emerald-400" />}
                          {log.type === 'info' && <Info size={14} className="text-blue-400" />}
                          <span>{log.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{log.time}</span>
                      </div>

                      {log.details && (
                        <pre className="mt-2 p-2 rounded bg-black/50 overflow-x-auto text-[11px] text-slate-300">
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : summary ? (
          <>
            <div className="kpi-card">
              <Droplets size={20} className="text-blue-400 mb-2" />
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatNumber(summary.totalLiters, 0)} L
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Total Litros
              </p>
            </div>
            <div className="kpi-card">
              <DollarSign size={20} className="text-green-400 mb-2" />
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(summary.totalValue)}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Total Gasto
              </p>
            </div>
            <div className="kpi-card">
              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                R$ {formatNumber(summary.avgUnitPrice, 3)}/L
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Preço Médio
              </p>
            </div>
            <div className="kpi-card">
              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {summary.orderCount}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Pedidos
              </p>
            </div>
            <div className="kpi-card">
              <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {formatNumber(summary.avgLitersPerOrder, 0)} L
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Média/Pedido
              </p>
            </div>
          </>
        ) : null}
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
                <th className="text-left px-4 py-3">Emissão</th>
                <th className="text-left px-4 py-3">Nº Pedido / NF</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">Preço/L</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Pagamento</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Droplets size={40} className="mx-auto mb-3 text-blue-400/20" />
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Nenhum pedido Vibra para {selMonth}/{selYear}.
                    </p>
                    {allDbOrders && allDbOrders.length > 0 ? (
                      <div className="mt-4 max-w-md mx-auto p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 text-left">
                        <p className="text-xs text-blue-200 font-medium mb-2">
                          💡 Existem <strong>{allDbOrders.length} pedidos</strong> cadastrados no banco nos seguintes meses:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(dbCompetenceBreakdown).map(([comp, d]) => (
                            <button
                              key={comp}
                              onClick={() => setCompetence(comp)}
                              className="px-2.5 py-1 rounded-lg text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 font-medium transition-all"
                            >
                              {comp} ({d.count} pedidos)
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs mt-1 text-slate-500">
                        Utilize &ldquo;Importar CSV&rdquo; para carregar os pedidos ou selecione outro mês acima.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-white/[0.02] transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(o.issueDate)}
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
                    <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(o.liters, 2)} L
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      R$ {formatNumber(o.unitPrice, 3)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#60a5fa' }}>
                      {formatCurrency(o.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {o.paymentDate ? formatDate(o.paymentDate) : '—'}
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
                ))
              )}
            </tbody>
            {orders.length > 0 && summary && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td className="px-4 py-3 font-semibold text-sm" colSpan={2} style={{ color: 'var(--text-primary)' }}>
                    Total ({summary.orderCount} pedidos)
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#60a5fa' }}>
                    {formatNumber(summary.totalLiters, 2)} L
                  </td>
                  <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                    R$ {formatNumber(summary.avgUnitPrice, 3)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#60a5fa' }}>
                    {formatCurrency(summary.totalValue)}
                  </td>
                  <td colSpan={isAdmin ? 3 : 2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Novo/Editar Pedido */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
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
                    Data de Emissão *
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
                    Data de Pagamento
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
        </div>
      )}
    </div>
  );
}
