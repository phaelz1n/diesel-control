'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings2, Bell, Building2, Plus, Edit2, Trash2, Save, X, Tag, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { getSettings, updateSettings } from '@/services/settings';
import { getBranches, createBranch, updateBranch, deleteBranch } from '@/services/branches';
import { wipeDatabase } from '@/services/database';
import { AppSettings, Branch } from '@/lib/types';
import { cn } from '@/lib/utils';

type Tab = 'geral' | 'alertas' | 'filiais' | 'perigo';

export default function ConfiguracoesPage() {
  const { profile } = useAuth();
  const { isAdmin } = usePermissions();

  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // General Settings State
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [newFuel, setNewFuel] = useState('');
  const [newVehicle, setNewVehicle] = useState('');

  // Alerts State
  const [thresholds, setThresholds] = useState<AppSettings['alertThresholds']>({
    minAvgKmL: 0,
    maxAvgKmL: 0,
    maxUnitPrice: 0,
    maxLitersPerRefuel: 0,
    minIntervalHours: 0,
  });

  // Branch Modal State
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    city: '',
    state: '',
    responsible: '',
    phone: '',
    active: true,
  });

  // Danger Zone State
  const [wipeConfirmWord, setWipeConfirmWord] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!isAdmin) return;
      try {
        const [settingsData, branchesData] = await Promise.all([
          getSettings(),
          getBranches(),
        ]);
        setSettings(settingsData);
        setThresholds(settingsData.alertThresholds);
        setFuelTypes(settingsData.fuelTypes);
        setVehicleTypes(settingsData.vehicleTypes);
        setBranches(branchesData);
      } catch (err) {
        console.error('Erro detalhado:', err);
        toast.error('Erro ao carregar configurações.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-red-500">
        Acesso negado. Você não tem permissão para acessar esta página.
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Carregando configurações...</div>;
  }

  // ==========================================
  // SAVE SETTINGS
  // ==========================================
  const handleSaveSettings = async () => {
    if (!profile) return;
    try {
      const payload: Partial<AppSettings> = {};
      if (activeTab === 'geral') {
        payload.fuelTypes = fuelTypes as any;
        payload.vehicleTypes = vehicleTypes as any;
      } else if (activeTab === 'alertas') {
        payload.alertThresholds = thresholds;
      }
      
      await updateSettings(payload, profile.uid);
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Erro detalhado:', err);
      toast.error('Erro ao salvar configurações.');
    }
  };

  // ==========================================
  // BRANCHES LOGIC
  // ==========================================
  const handleOpenBranchModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setBranchForm({
        name: branch.name,
        city: branch.city,
        state: branch.state,
        responsible: branch.responsible || '',
        phone: branch.phone || '',
        active: branch.active,
      });
    } else {
      setEditingBranch(null);
      setBranchForm({ name: '', city: '', state: '', responsible: '', phone: '', active: true });
    }
    setShowBranchModal(true);
  };

  const handleSaveBranch = async () => {
    if (!profile) return;
    if (!branchForm.name || !branchForm.city || !branchForm.state) {
      toast.error('Preencha os campos obrigatórios (Nome, Cidade, UF).');
      return;
    }
    
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchForm, profile.uid);
        setBranches((prev) => prev.map((b) => (b.id === editingBranch.id ? { ...b, ...branchForm } : b)));
        toast.success('Filial atualizada!');
      } else {
        const id = await createBranch(branchForm, profile.uid);
        const newB = { id, ...branchForm, createdAt: new Date(), updatedAt: new Date(), createdBy: profile.uid, updatedBy: profile.uid, normalizedName: branchForm.name.toLowerCase() } as Branch;
        setBranches((prev) => [...prev, newB]);
        toast.success('Filial criada!');
      }
      setShowBranchModal(false);
    } catch (err) {
      console.error('Erro detalhado:', err);
      toast.error('Erro ao salvar filial.');
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta filial?')) return;
    try {
      await deleteBranch(id);
      setBranches((prev) => prev.filter((b) => b.id !== id));
      toast.success('Filial excluída.');
    } catch (err) {
      console.error('Erro detalhado:', err);
      toast.error('Erro ao excluir filial.');
    }
  };

  // ==========================================
  // WIPE DATABASE LOGIC
  // ==========================================
  const handleWipeDatabase = async () => {
    if (wipeConfirmWord !== 'APAGAR TUDO') return;
    if (!profile) return;
    
    setIsWiping(true);
    try {
      await wipeDatabase(profile.uid, profile.email, profile.name);
      toast.success('Banco de dados completamente apagado com sucesso!');
      setWipeConfirmWord('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao apagar banco de dados.');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Configurações do Sistema</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Gerencie limites de alerta, tipos de cadastro e filiais.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveTab('geral')}
          className={cn('px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2', activeTab === 'geral' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-300')}
        >
          <Settings2 size={16} /> Cadastros Básicos
        </button>
        <button
          onClick={() => setActiveTab('alertas')}
          className={cn('px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2', activeTab === 'alertas' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-300')}
        >
          <Bell size={16} /> Parâmetros de Alerta
        </button>
        <button
          onClick={() => setActiveTab('filiais')}
          className={cn('px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2', activeTab === 'filiais' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-300')}
        >
          <Building2 size={16} /> Filiais
        </button>
        <button
          onClick={() => setActiveTab('perigo')}
          className={cn('px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2', activeTab === 'perigo' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-500 hover:text-red-400')}
        >
          <AlertTriangle size={16} /> Zona de Perigo
        </button>
      </div>

      {/* Tab Content: GERAL */}
      {activeTab === 'geral' && (
        <div className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fuel Types */}
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Tipos de Combustível</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newFuel}
                  onChange={(e) => setNewFuel(e.target.value)}
                  placeholder="Novo combustível..."
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => { if (newFuel) setFuelTypes([...fuelTypes, newFuel]); setNewFuel(''); }}
                  className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <ul className="space-y-2">
                {fuelTypes.map((ft, i) => (
                  <li key={i} className="flex justify-between items-center p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ft}</span>
                    <button onClick={() => setFuelTypes(fuelTypes.filter((_, idx) => idx !== i))} className="text-red-400 hover:bg-red-400/10 p-1 rounded">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Vehicle Types */}
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Tipos de Veículo</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newVehicle}
                  onChange={(e) => setNewVehicle(e.target.value)}
                  placeholder="Novo tipo..."
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => { if (newVehicle) setVehicleTypes([...vehicleTypes, newVehicle]); setNewVehicle(''); }}
                  className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <ul className="space-y-2">
                {vehicleTypes.map((vt, i) => (
                  <li key={i} className="flex justify-between items-center p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{vt}</span>
                    <button onClick={() => setVehicleTypes(vehicleTypes.filter((_, idx) => idx !== i))} className="text-red-400 hover:bg-red-400/10 p-1 rounded">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={handleSaveSettings} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">
            <Save size={18} /> Salvar Cadastros Básicos
          </button>
        </div>
      )}

      {/* Tab Content: ALERTAS */}
      {activeTab === 'alertas' && (
        <div className="space-y-6 max-w-2xl">
          <div className="p-5 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Estes limites disparam avisos automáticos caso um abastecimento exceda os padrões definidos.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Mínimo km/L esperado</label>
                <input type="number" step="0.1" value={thresholds.minAvgKmL} onChange={(e) => setThresholds({ ...thresholds, minAvgKmL: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Máximo km/L aceitável</label>
                <input type="number" step="0.1" value={thresholds.maxAvgKmL} onChange={(e) => setThresholds({ ...thresholds, maxAvgKmL: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Preço Máx. por Litro (R$)</label>
                <input type="number" step="0.01" value={thresholds.maxUnitPrice} onChange={(e) => setThresholds({ ...thresholds, maxUnitPrice: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Máx. Litros por Abastecimento</label>
                <input type="number" value={thresholds.maxLitersPerRefuel} onChange={(e) => setThresholds({ ...thresholds, maxLitersPerRefuel: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Intervalo Mínimo (Horas) entre abastecimentos</label>
                <input type="number" value={thresholds.minIntervalHours} onChange={(e) => setThresholds({ ...thresholds, minIntervalHours: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </div>
          <button onClick={handleSaveSettings} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors">
            <Save size={18} /> Salvar Parâmetros
          </button>
        </div>
      )}

      {/* Tab Content: FILIAIS */}
      {activeTab === 'filiais' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Gestão de Filiais</h2>
            <button
              onClick={() => handleOpenBranchModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              <Plus size={16} /> Nova Filial
            </button>
          </div>
          
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nome</th>
                  <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cidade/UF</th>
                  <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Responsável</th>
                  <th className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma filial cadastrada.</td></tr>
                ) : (
                  branches.map(b => (
                    <tr key={b.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{b.name}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{b.city}/{b.state}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{b.responsible || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', b.active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')}>
                          {b.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleOpenBranchModal(b)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteBranch(b.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors ml-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: ZONA DE PERIGO */}
      {activeTab === 'perigo' && (
        <div className="space-y-6 max-w-2xl">
          <div className="p-6 rounded-2xl border-2 border-red-500/30 bg-red-500/5 space-y-4">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={32} />
              <div>
                <h2 className="text-xl font-bold">Zona de Perigo</h2>
                <p className="text-sm text-red-500/80">Ações extremas e irreversíveis.</p>
              </div>
            </div>
            
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Esta ação irá <strong>apagar permanentemente</strong> todos os dados do sistema, incluindo:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1 text-red-400/80">
              <li>Abastecimentos e Despesas</li>
              <li>Filiais e Veículos</li>
              <li>Postos e Pedidos</li>
              <li>Alertas gerados</li>
            </ul>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Apenas as configurações de base e os usuários cadastrados não serão afetados.
            </p>

            <div className="mt-6 p-4 rounded-xl border border-red-500/20 bg-white/5 space-y-3">
              <label className="text-sm font-semibold block" style={{ color: 'var(--text-primary)' }}>
                Para confirmar a exclusão, digite a frase: <span className="text-red-500 select-all">APAGAR TUDO</span>
              </label>
              <input
                type="text"
                value={wipeConfirmWord}
                onChange={(e) => setWipeConfirmWord(e.target.value)}
                placeholder="Digite a confirmação..."
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleWipeDatabase}
                disabled={wipeConfirmWord !== 'APAGAR TUDO' || isWiping}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-white',
                  wipeConfirmWord === 'APAGAR TUDO' && !isWiping
                    ? 'bg-red-600 hover:bg-red-500 shadow-[0_2px_15px_rgba(220,38,38,0.5)]'
                    : 'bg-red-600/30 cursor-not-allowed opacity-50'
                )}
              >
                {isWiping ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {isWiping ? 'Apagando banco de dados...' : 'Apagar Todos os Dados'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border p-6 animate-scale-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingBranch ? 'Editar Filial' : 'Nova Filial'}
              </h2>
              <button onClick={() => setShowBranchModal(false)} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Nome (Ex: Matriz, Filial SP)</label>
                <input type="text" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Cidade</label>
                  <input type="text" value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>UF</label>
                  <input type="text" value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} maxLength={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent uppercase" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Responsável (Opcional)</label>
                <input type="text" value={branchForm.responsible} onChange={(e) => setBranchForm({ ...branchForm, responsible: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>Telefone (Opcional)</label>
                <input type="text" value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl text-sm outline-none border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input type="checkbox" checked={branchForm.active} onChange={(e) => setBranchForm({ ...branchForm, active: e.target.checked })} className="w-4 h-4 rounded border-gray-600 bg-transparent" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Filial Ativa</span>
              </label>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setShowBranchModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors" style={{ color: 'var(--text-primary)' }}>
                Cancelar
              </button>
              <button onClick={handleSaveBranch} className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
                Salvar Filial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
