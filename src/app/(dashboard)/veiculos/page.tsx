'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Search, Car, Edit2, Trash2, ChevronRight, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { getVehicles, deleteVehicle } from '@/services/vehicles';
import { Vehicle } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { createAuditLog } from '@/services/audit';
import { VEHICLE_STATUS_LABELS } from '@/lib/constants';

const statusColors: Record<string, string> = {
  active: '#10b981',
  inactive: '#64748b',
  maintenance: '#f59e0b',
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function VeiculosPage() {
  const { profile } = useAuth();
  const { canCreate, canDelete } = usePermissions();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch {
      toast.error('Erro ao carregar veículos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? vehicles.filter((v) =>
        v.plate.toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase()) ||
        v.prefix.toLowerCase().includes(search.toLowerCase()) ||
        v.branchName.toLowerCase().includes(search.toLowerCase())
      )
    : vehicles;

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      const v = vehicles.find((v) => v.id === id);
      await deleteVehicle(id);
      if (v && profile) {
        await createAuditLog(profile.uid, profile.email, profile.name, 'DELETE', 'vehicle', id,
          `${profile.name} excluiu o veículo ${v.plate}`);
      }
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      toast.success('Veículo excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full"
      style={{
        background: `${statusColors[status]}18`,
        border: `1px solid ${statusColors[status]}30`,
        color: statusColors[status],
      }}
    >
      {status === 'active' ? <CheckCircle size={11} /> : status === 'maintenance' ? <Wrench size={11} /> : <XCircle size={11} />}
      {VEHICLE_STATUS_LABELS[status as keyof typeof VEHICLE_STATUS_LABELS]}
    </span>
  );

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Veículos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{vehicles.length} veículos cadastrados</p>
        </div>
        {canCreate && (
          <Link
            href="/veiculos/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
          >
            <Plus size={16} /> Novo Veículo
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar placa, modelo, prefixo, filial..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Grid of cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="kpi-card group cursor-pointer relative"
              onClick={() => {}}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  <Car size={18} className="text-blue-400" />
                </div>
                <StatusBadge status={v.status} />
              </div>
              <div className="mb-3">
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{v.plate}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{v.model}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Prefixo: {v.prefix}</p>
              </div>
              <div
                className="text-xs rounded-lg px-2.5 py-1.5 mb-3"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                {v.branchName}
              </div>
              <div className="flex items-center justify-between">
                <Link
                  href={`/veiculos/${v.id}`}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ver análise <ChevronRight size={12} />
                </Link>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/veiculos/${v.id}/editar`}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit2 size={13} />
                  </Link>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                      className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        confirmDelete === v.id ? 'bg-red-500/20 text-red-400' : 'hover:bg-red-500/10 text-red-400/40 hover:text-red-400'
                      )}
                      title={confirmDelete === v.id ? 'Confirmar exclusão?' : 'Excluir'}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Car size={48} className="text-blue-400/20" />
          <p style={{ color: 'var(--text-muted)' }}>
            {search ? 'Nenhum veículo encontrado.' : 'Nenhum veículo cadastrado.'}
          </p>
          {canCreate && !search && (
            <Link href="/veiculos/novo" className="text-sm text-blue-400 hover:text-blue-300">
              Cadastrar primeiro veículo →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
