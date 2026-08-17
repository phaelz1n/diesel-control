'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ScrollText, Filter, X } from 'lucide-react';
import { getAuditLogs, AuditFilters } from '@/services/audit';
import { AuditLog, AuditEntityType, AuditAction } from '@/lib/types';
import { formatDateTime, cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

const actionColors: Record<string, string> = {
  CREATE: '#10b981',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
  LOGIN: '#8b5cf6',
  LOGOUT: '#64748b',
  IMPORT: '#f59e0b',
  EXPORT: '#06b6d4',
  PASSWORD_RESET: '#ec4899',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await getAuditLogs(filters, 200));
    } catch {
      toast.error('Erro ao carregar logs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const entityLabels: Record<string, string> = {
    refuel: 'Abastecimento',
    vehicle: 'Veículo',
    station: 'Posto',
    expense: 'Gasto',
    vibra_order: 'Pedido Vibra',
    user: 'Usuário',
    branch: 'Filial',
    settings: 'Configurações',
    import: 'Importação',
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Logs do Sistema</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{logs.length} registros</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <select
          value={filters.action ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value as AuditAction || undefined }))}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={selectStyle}
        >
          <option value="">Todos os eventos</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'IMPORT', 'EXPORT'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filters.entityType ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value as AuditEntityType || undefined }))}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={selectStyle}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(entityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <input
          type="date"
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value ? new Date(e.target.value) : undefined }))}
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={selectStyle}
        />

        {(filters.action || filters.entityType || filters.startDate) && (
          <button
            onClick={() => setFilters({})}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm"
            style={{ color: '#60a5fa' }}
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[800px]">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Data/Hora</th>
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-center px-4 py-3">Evento</th>
                <th className="text-center px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-5" /></td>
                  ))}</tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <ScrollText size={40} className="mx-auto mb-3 text-blue-400/20" />
                    <p style={{ color: 'var(--text-muted)' }}>Nenhum log encontrado.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.userName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          background: `${actionColors[log.action] ?? '#64748b'}15`,
                          border: `1px solid ${actionColors[log.action] ?? '#64748b'}25`,
                          color: actionColors[log.action] ?? '#64748b',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                        {entityLabels[log.entityType] ?? log.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
