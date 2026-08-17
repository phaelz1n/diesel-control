'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Search, MapPin, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { getStations, deleteStation } from '@/services/stations';
import { Station } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuth } from '@/lib/hooks/useAuth';
import { createAuditLog } from '@/services/audit';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function PostosPage() {
  const { profile } = useAuth();
  const { canCreate, canDelete } = usePermissions();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStations(await getStations());
    } catch {
      toast.error('Erro ao carregar postos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? stations.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.city.toLowerCase().includes(search.toLowerCase())
      )
    : stations;

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      const s = stations.find((s) => s.id === id);
      await deleteStation(id);
      if (s && profile) {
        await createAuditLog(profile.uid, profile.email, profile.name, 'DELETE', 'station', id,
          `${profile.name} excluiu o posto ${s.name}`);
      }
      setStations((prev) => prev.filter((s) => s.id !== id));
      toast.success('Posto excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Postos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{stations.length} postos cadastrados</p>
        </div>
        {canCreate && (
          <Link
            href="/postos/novo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
          >
            <Plus size={16} /> Novo Posto
          </Link>
        )}
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, cidade..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Posto</th>
                <th className="text-left px-4 py-3">Cidade / Estado</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <MapPin size={40} className="text-blue-400/20" />
                      <p style={{ color: 'var(--text-muted)' }}>
                        {search ? 'Nenhum resultado.' : 'Nenhum posto cadastrado.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-t transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                      {s.observations && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.observations}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {s.city} / {s.state}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{s.type}</td>
                    <td className="px-4 py-3 text-center">
                      {s.active ? (
                        <span className="badge-active inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full">
                          <CheckCircle size={11} /> Ativo
                        </span>
                      ) : (
                        <span className="badge-inactive inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full">
                          <XCircle size={11} /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/postos/${s.id}/editar`}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Edit2 size={14} />
                        </Link>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(s.id)}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              confirmDelete === s.id ? 'bg-red-500/20 text-red-400' : 'hover:bg-red-500/10 text-red-400/40 hover:text-red-400'
                            )}
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
      </div>
    </div>
  );
}
