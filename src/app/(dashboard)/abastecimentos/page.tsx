'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus, Search, Filter, Download, Edit2, Trash2,
  ChevronLeft, ChevronRight, Fuel, X, SlidersHorizontal,
} from 'lucide-react';
import { getRefuels, deleteRefuel } from '@/services/refuels';
import { Refuel, RefuelFilters } from '@/lib/types';
import { formatCurrency, formatNumber, formatDateTime, cn } from '@/lib/utils';
import { MONTHS, YEARS, FUEL_TYPES } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { createAuditLog } from '@/services/audit';
import { exportToExcel, exportToCSV } from '@/lib/utils/exportUtils';

const PAGE_SIZE = 25;

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function AbastecimentosPage() {
  const { profile } = useAuth();
  const { canCreate, canDelete, canExport } = usePermissions();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [refuels, setRefuels] = useState<Refuel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocRef, setLastDocRef] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<RefuelFilters>({
    year: currentYear,
    month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
  });

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const loadRefuels = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const { items, lastDoc } = await getRefuels(filters, PAGE_SIZE, reset ? undefined : (lastDocRef as never));
      if (reset) {
        setRefuels(items);
      } else {
        setRefuels((prev) => [...prev, ...items]);
      }
      setLastDocRef(lastDoc);
      setHasMore(items.length === PAGE_SIZE);
    } catch {
      toast.error('Erro ao carregar abastecimentos.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLastDocRef(null);
    loadRefuels(true);
  }, [filters]);

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeletingId(id);
    try {
      await deleteRefuel(id);
      const deleted = refuels.find((r) => r.id === id);
      if (deleted && profile) {
        await createAuditLog(
          profile.uid, profile.email, profile.name,
          'DELETE', 'refuel', id,
          `${profile.name} excluiu o abastecimento ${deleted.vehiclePlate} em ${formatDateTime(deleted.date)}`
        );
      }
      setRefuels((prev) => prev.filter((r) => r.id !== id));
      toast.success('Abastecimento excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  // Filtered view (client-side search)
  const displayed = search
    ? refuels.filter((r) =>
        r.vehiclePlate.toLowerCase().includes(search.toLowerCase()) ||
        r.vehicleModel.toLowerCase().includes(search.toLowerCase()) ||
        r.stationName.toLowerCase().includes(search.toLowerCase()) ||
        r.vehiclePrefix.toLowerCase().includes(search.toLowerCase())
      )
    : refuels;

  const handleExportExcel = () => {
    const rows = displayed.map((r) => ({
      Data: formatDateTime(r.date),
      Placa: r.vehiclePlate,
      Prefixo: r.vehiclePrefix,
      Modelo: r.vehicleModel,
      Posto: r.stationName,
      Cidade: r.city,
      Combustível: r.fuelType,
      Litros: r.liters,
      'Valor Unitário': r.unitPrice,
      'Valor Total': r.totalValue,
      'Hodômetro Anterior': r.previousOdometer,
      'Hodômetro Atual': r.currentOdometer,
      'KM Rodados': r.kmTraveled,
      'Média km/L': r.avgKmL,
      Observação: r.observations ?? '',
    }));
    exportToExcel(rows, `abastecimentos_${filters.month ?? filters.year}`);
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Abastecimentos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {refuels.length} registros carregados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <Download size={15} />
              Excel
            </button>
          )}
          {canCreate && (
            <Link
              href="/abastecimentos/novo"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
            >
              <Plus size={16} />
              Novo
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 border space-y-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar placa, modelo, posto..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Year */}
          <select
            value={filters.year ?? currentYear}
            onChange={(e) => setFilters((f) => ({ ...f, year: Number(e.target.value), month: undefined }))}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={selectStyle}
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Month */}
          <select
            value={filters.month ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value || undefined }))}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={selectStyle}
          >
            <option value="">Todos os meses</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={`${filters.year ?? currentYear}-${m.value}`}>{m.label}</option>
            ))}
          </select>

          {/* Fuel type */}
          <select
            value={filters.fuelType ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, fuelType: e.target.value as never || undefined }))}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={selectStyle}
          >
            <option value="">Todos combustíveis</option>
            {FUEL_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
          </select>

          {/* Clear filters */}
          {(filters.month || filters.fuelType) && (
            <button
              onClick={() => setFilters({ year: currentYear })}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-colors hover:opacity-80"
              style={{ color: '#60a5fa' }}
            >
              <X size={14} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[900px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Data/Hora</th>
                <th className="text-left px-4 py-3">Veículo</th>
                <th className="text-left px-4 py-3">Posto</th>
                <th className="text-right px-4 py-3">Litros</th>
                <th className="text-right px-4 py-3">Preço/L</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">km/L</th>
                <th className="text-right px-4 py-3 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Fuel size={40} className="text-blue-400/20" />
                      <p style={{ color: 'var(--text-muted)' }}>
                        {search ? 'Nenhum resultado para a busca.' : 'Nenhum abastecimento no período.'}
                      </p>
                      {canCreate && !search && (
                        <Link href="/abastecimentos/novo" className="text-sm text-blue-400 hover:text-blue-300">
                          Lançar abastecimento →
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayed.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDateTime(r.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.vehiclePlate}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.vehicleModel} · {r.vehiclePrefix}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{r.stationName}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.city}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(r.liters, 2)} L
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
                      R$ {formatNumber(r.unitPrice, 3)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(r.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: r.avgKmL >= 5 ? 'rgba(16,185,129,0.1)' : r.avgKmL >= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                          color: r.avgKmL >= 5 ? '#10b981' : r.avgKmL >= 2 ? '#f59e0b' : '#ef4444',
                        }}
                      >
                        {formatNumber(r.avgKmL, 2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/abastecimentos/${r.id}`}
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Edit2 size={14} />
                        </Link>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deletingId === r.id}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              confirmDelete === r.id
                                ? 'bg-red-500/20 text-red-400'
                                : 'hover:bg-red-500/10 text-red-400/50 hover:text-red-400'
                            )}
                            title={confirmDelete === r.id ? 'Clique novamente para confirmar' : 'Excluir'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => loadRefuels(false)}
              className="px-6 py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
