'use client';

import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X,
  ArrowRight, Loader2, Eye, AlertCircle,
} from 'lucide-react';
import { ImportRow, ImportResult } from '@/lib/types';
import { batchCreate } from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/firestore';
import { useAuth } from '@/lib/hooks/useAuth';
import { createAuditLog } from '@/services/audit';
import { calcTotalValue, calcKmTraveled, calcAvgKmL, toYearMonth, normalizePlate, formatNumber, cn } from '@/lib/utils';

// ============================================================
// COLUMN MAPPINGS (flexible matching)
// ============================================================
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['data', 'data/hora', 'datetime', 'data hora'],
  vehiclePlate: ['placa', 'plate'],
  vehiclePrefix: ['prefixo', 'prefix'],
  vehicleModel: ['modelo', 'model'],
  vehicleBranch: ['filial', 'empresa', 'branch'],
  stationName: ['posto', 'fornecedor', 'station'],
  city: ['cidade', 'city'],
  fuelType: ['combustível', 'combustivel', 'fuel'],
  liters: ['litros', 'quantidade', 'qtd', 'liters'],
  unitPrice: ['valor unitário', 'valor unitario', 'preço unitário', 'preco unitario', 'unit price', 'price'],
  totalValue: ['valor total', 'total', 'total value'],
  previousOdometer: ['hodômetro anterior', 'hodometro anterior', 'km anterior', 'prev odometer'],
  currentOdometer: ['hodômetro atual', 'hodometro atual', 'km atual', 'current odometer', 'hodometro'],
  observations: ['observação', 'observacao', 'obs', 'notes'],
};

function detectColumn(header: string): string | null {
  const lower = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => lower.includes(a))) return field;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    return XLSX.SSF.parse_date_code(value) ? new Date(Date.UTC(1899, 11, 30) + value * 86400000) : null;
  }
  const str = String(value);
  // DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
  const parts = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (parts) {
    return new Date(
      Number(parts[3]),
      Number(parts[2]) - 1,
      Number(parts[1]),
      Number(parts[4] ?? 0),
      Number(parts[5] ?? 0),
      Number(parts[6] ?? 0)
    );
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const str = String(value ?? '').replace(/[R$\s]/g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

// ============================================================
// STEP INDICATOR
// ============================================================
function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = ['Upload', 'Mapeamento', 'Prévia', 'Validação', 'Importação'];
  return (
    <div className="flex items-center gap-2">
      {steps.slice(0, total).map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            i + 1 < step ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            i + 1 === step ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            'bg-white/5 text-slate-500 border border-white/10'
          )}>
            {i + 1 < step ? <CheckCircle size={14} /> : i + 1}
          </div>
          <span className={cn(
            'text-xs hidden sm:block',
            i + 1 === step ? 'text-blue-400 font-medium' : 'text-slate-500'
          )}>{s}</span>
          {i < total - 1 && <ArrowRight size={14} className="text-slate-600 mx-1" />}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// IMPORT WIZARD
// ============================================================
export default function ImportacaoPage() {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const processFile = async (f: File) => {
    setFile(f);
    const buffer = await f.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null }) as Record<string, unknown>[];

    if (rows.length === 0) {
      toast.error('Planilha vazia ou formato não reconhecido.');
      return;
    }

    const hdrs = Object.keys(rows[0]);
    setHeaders(hdrs);
    setRawRows(rows);

    // Auto-detect column mapping
    const autoMap: Record<string, string> = {};
    for (const h of hdrs) {
      const field = detectColumn(h);
      if (field) autoMap[h] = field;
    }
    setColumnMap(autoMap);
    setStep(2);
  };

  const handleValidate = () => {
    const parsed: ImportRow[] = rawRows.map((row, idx) => {
      const mapped: Record<string, unknown> = {};
      for (const [header, field] of Object.entries(columnMap)) {
        mapped[field] = row[header];
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      const date = parseDate(mapped.date);
      const liters = parseNumber(mapped.liters);
      const unitPrice = parseNumber(mapped.unitPrice);
      const prevOdo = parseNumber(mapped.previousOdometer);
      const currOdo = parseNumber(mapped.currentOdometer);

      if (!date) errors.push('Data inválida');
      if (!mapped.vehiclePlate) errors.push('Placa obrigatória');
      if (liters <= 0) errors.push('Litros inválidos');
      if (unitPrice <= 0) errors.push('Valor unitário inválido');
      if (currOdo < prevOdo) warnings.push('Hodômetro atual < anterior');

      const totalValue = calcTotalValue(liters, unitPrice);
      const kmTraveled = calcKmTraveled(currOdo, prevOdo);
      const avgKmL = calcAvgKmL(kmTraveled, liters);

      const mappedData = {
        date: date ?? new Date(),
        vehiclePlate: normalizePlate(String(mapped.vehiclePlate ?? '')),
        vehiclePrefix: String(mapped.vehiclePrefix ?? ''),
        vehicleModel: String(mapped.vehicleModel ?? ''),
        vehicleBranch: String(mapped.vehicleBranch ?? ''),
        vehicleBranchId: 'imported',
        vehicleId: 'imported',
        stationId: 'imported',
        stationName: String(mapped.stationName ?? ''),
        city: String(mapped.city ?? ''),
        state: '',
        fuelType: String(mapped.fuelType ?? 'Diesel S10'),
        liters,
        unitPrice,
        totalValue,
        previousOdometer: prevOdo,
        currentOdometer: currOdo,
        kmTraveled,
        avgKmL,
        month: date ? toYearMonth(date) : '',
        year: date?.getFullYear() ?? new Date().getFullYear(),
        observations: String(mapped.observations ?? ''),
        hasAlerts: warnings.length > 0,
        alertTypes: warnings,
      };

      return {
        rowIndex: idx + 2,
        data: row as Record<string, string | number | null>,
        mapped: mappedData as never,
        errors,
        warnings,
        isDuplicate: false,
        status: errors.length > 0 ? 'error' : 'valid',
      } as ImportRow;
    });

    setParsedRows(parsed);
    setStep(3);
  };

  const handleImport = async () => {
    if (!profile) return;
    setImporting(true);

    const validRows = parsedRows.filter((r) => r.status === 'valid' && r.mapped);

    try {
      const importedCount = await batchCreate(
        COLLECTIONS.REFUELS,
        validRows.map((r) => r.mapped as never),
        profile.uid
      );

      await createAuditLog(
        profile.uid, profile.email, profile.name,
        'IMPORT', 'import', 'batch',
        `${profile.name} importou ${importedCount} abastecimentos da planilha ${file?.name}`,
        { newValues: { filename: file?.name, importedCount, totalRows: parsedRows.length } }
      );

      setResult({
        totalRows: parsedRows.length,
        validRows: validRows.length,
        errorRows: parsedRows.filter((r) => r.status === 'error').length,
        duplicateRows: parsedRows.filter((r) => r.isDuplicate).length,
        importedCount,
        skippedCount: parsedRows.length - validRows.length,
        errors: [],
      });

      setStep(5);
      toast.success(`${importedCount} registros importados com sucesso!`);
    } catch (err) {
      toast.error('Erro na importação. Tente novamente.');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setColumnMap({});
    setParsedRows([]);
    setResult(null);
  };

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;

  return (
    <div className="page-container max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Importação de Planilha</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Importe abastecimentos de uma planilha Excel (.xlsx)
        </p>
      </div>

      <StepIndicator step={step} total={5} />

      {/* Step 1: Upload */}
      {step === 1 && (
        <div
          className="rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5"
          style={{ borderColor: 'var(--border)' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-blue-400/40" />
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Arraste o arquivo ou clique para selecionar
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Suporta .xlsx, .xls e .csv
          </p>
          <div
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
          >
            <Upload size={16} /> Selecionar Arquivo
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="rounded-2xl border p-6 space-y-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Mapeamento de Colunas</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Arquivo: <strong>{file?.name}</strong> · {rawRows.length} linhas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {headers.map((h) => (
              <div key={h} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{h}</span>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={columnMap[h] ?? ''}
                  onChange={(e) => setColumnMap((m) => ({ ...m, [h]: e.target.value }))}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">— ignorar —</option>
                  {Object.keys(COLUMN_ALIASES).map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={reset} className="px-4 py-2 rounded-xl text-sm hover:bg-white/5"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button
              onClick={handleValidate}
              className="px-6 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
            >
              Validar dados →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview + Validation */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="kpi-card text-center">
              <p className="text-2xl font-bold text-green-400">{validCount}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Válidos</p>
            </div>
            <div className="kpi-card text-center">
              <p className="text-2xl font-bold text-red-400">{errorCount}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Com erros</p>
            </div>
            <div className="kpi-card text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{parsedRows.length}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Total</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full data-table min-w-[700px]">
                <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    <th className="text-left px-4 py-3">Linha</th>
                    <th className="text-left px-4 py-3">Placa</th>
                    <th className="text-left px-4 py-3">Posto</th>
                    <th className="text-right px-4 py-3">Litros</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 100).map((r) => (
                    <tr key={r.rowIndex} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{r.rowIndex}</td>
                      <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                        {r.mapped?.vehiclePlate}
                      </td>
                      <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {r.mapped?.stationName}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatNumber(r.mapped?.liters ?? 0, 2)} L
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm" style={{ color: 'var(--text-primary)' }}>
                        R$ {formatNumber(r.mapped?.totalValue ?? 0, 2)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.status === 'valid' ? (
                          <CheckCircle size={14} className="mx-auto text-green-400" />
                        ) : (
                          <div className="flex flex-col items-center">
                            <AlertTriangle size={14} className="text-red-400" />
                            {r.errors?.map((e, i) => (
                              <span key={i} className="text-xs text-red-400">{e}</span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm hover:bg-white/5"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              ← Voltar
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: validCount === 0 ? 'rgba(37,99,235,0.3)' : 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
            >
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? 'Importando...' : `Importar ${validCount} registros`}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Result */}
      {step === 5 && result && (
        <div className="rounded-2xl border p-8 text-center space-y-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Importação concluída!
            </h2>
            <p className="text-lg font-semibold text-green-400">{result.importedCount} registros importados</p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="kpi-card text-center p-4">
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{result.totalRows}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total</p>
            </div>
            <div className="kpi-card text-center p-4">
              <p className="text-xl font-bold text-green-400">{result.importedCount}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Importados</p>
            </div>
            <div className="kpi-card text-center p-4">
              <p className="text-xl font-bold text-red-400">{result.errorRows}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Erros</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
          >
            Nova importação
          </button>
        </div>
      )}
    </div>
  );
}
