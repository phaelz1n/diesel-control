'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Users, Plus, Edit2, Shield, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { getUsers, updateUser, toggleUserActive, resetUserPassword, createUser } from '@/services/users';
import { AppUser, UserRole } from '@/lib/types';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { USER_ROLE_LABELS } from '@/lib/constants';
import { useAuth } from '@/lib/hooks/useAuth';
import { createAuditLog } from '@/services/audit';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

const roleColors: Record<UserRole, string> = {
  admin: '#ef4444',
  operational: '#3b82f6',
  viewer: '#64748b',
};

export default function UsuariosPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'operational' as UserRole });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (user: AppUser) => {
    if (!profile) return;
    try {
      await toggleUserActive(user.uid, !user.active, profile.uid);
      await createAuditLog(
        profile.uid, profile.email, profile.name,
        'UPDATE', 'user', user.uid,
        `${profile.name} ${user.active ? 'desativou' : 'ativou'} o usuário ${user.name}`,
        { previousValues: { active: user.active }, newValues: { active: !user.active } }
      );
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: !u.active } : u));
      toast.success(`Usuário ${user.active ? 'desativado' : 'ativado'}.`);
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleResetPassword = async (user: AppUser) => {
    try {
      await resetUserPassword(user.email);
      toast.success(`E-mail de redefinição enviado para ${user.email}.`);
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao enviar e-mail.');
    }
  };

  const handleCreateUser = async () => {
    if (!profile) return;
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Preencha todos os campos.');
      return;
    }
    setCreating(true);
    try {
      const newUid = await createUser(
        formData.email,
        formData.password,
        formData.name,
        formData.role,
        profile.uid
      );
      
      const newUser: AppUser = {
        id: newUid,
        uid: newUid,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: profile.uid,
        updatedBy: profile.uid,
      };

      setUsers(prev => [newUser, ...prev]);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'operational' });
      toast.success('Usuário criado com sucesso!');
      
      await createAuditLog(
        profile.uid, profile.email, profile.name,
        'CREATE', 'user', newUid,
        `${profile.name} criou o usuário ${formData.name}`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao criar usuário.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Usuários</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{users.length} usuários cadastrados</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
        >
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-center px-4 py-3">Perfil</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Último Acesso</th>
                <th className="text-right px-4 py-3 w-28">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-5" /></td>
                  ))}</tr>
                ))
              ) : users.map((user) => (
                <tr key={user.id} className="border-t transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `${roleColors[user.role]}20`,
                          border: `1px solid ${roleColors[user.role]}30`,
                          color: roleColors[user.role],
                        }}
                      >
                        {getInitials(user.name)}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full"
                      style={{ background: `${roleColors[user.role]}15`, border: `1px solid ${roleColors[user.role]}25`, color: roleColors[user.role] }}
                    >
                      <Shield size={10} />
                      {USER_ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.active ? (
                      <span className="badge-active inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full">
                        <CheckCircle size={11} /> Ativo
                      </span>
                    ) : (
                      <span className="badge-inactive inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full">
                        <XCircle size={11} /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    {user.lastLogin ? formatDate(user.lastLogin) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors text-blue-400/50 hover:text-blue-400"
                        title="Redefinir senha"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          user.active
                            ? 'hover:bg-red-500/10 text-red-400/50 hover:text-red-400'
                            : 'hover:bg-green-500/10 text-green-400/50 hover:text-green-400'
                        )}
                        title={user.active ? 'Desativar' : 'Ativar'}
                      >
                        {user.active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border p-6 animate-scale-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Novo Usuário</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Nome Completo</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>E-mail</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Senha Provisória</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Perfil de Acesso</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option value="admin" style={{ background: 'var(--bg-card)' }}>Administrador</option>
                  <option value="operational" style={{ background: 'var(--bg-card)' }}>Operacional</option>
                  <option value="viewer" style={{ background: 'var(--bg-card)' }}>Visualizador</option>
                </select>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors" style={{ color: 'var(--text-primary)' }}>
                Cancelar
              </button>
              <button onClick={handleCreateUser} disabled={creating} className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
