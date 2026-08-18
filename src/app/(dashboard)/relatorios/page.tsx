'use client';

import React, { useState } from 'react';
import {
  ArrowRightLeft,
  CalendarDays,
  Calendar,
  History,
  MapPin,
  Car,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { ComparativoTab } from './components/ComparativoTab';
import { DiarioTab } from './components/DiarioTab';
import { MensalTab } from './components/MensalTab';
import { AnualTab } from './components/AnualTab';
import { PostosTab } from './components/PostosTab';
import { VeiculosTab } from './components/VeiculosTab';

type Tab = 'comparativo' | 'diario' | 'mensal' | 'anual' | 'postos' | 'veiculos';

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
        active
          ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

export default function RelatoriosPage() {
  const [tab, setTab] = useState<Tab>('comparativo');

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Relatórios Avançados
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Análises multidimensionais de consumo e gastos da frota
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabBtn
          active={tab === 'comparativo'}
          onClick={() => setTab('comparativo')}
          icon={ArrowRightLeft}
          label="Comparativo"
        />
        <TabBtn
          active={tab === 'diario'}
          onClick={() => setTab('diario')}
          icon={CalendarDays}
          label="Dia a Dia"
        />
        <TabBtn
          active={tab === 'mensal'}
          onClick={() => setTab('mensal')}
          icon={Calendar}
          label="Mês a Mês"
        />
        <TabBtn
          active={tab === 'anual'}
          onClick={() => setTab('anual')}
          icon={History}
          label="Ano a Ano"
        />
        <TabBtn
          active={tab === 'postos'}
          onClick={() => setTab('postos')}
          icon={MapPin}
          label="Por Posto"
        />
        <TabBtn
          active={tab === 'veiculos'}
          onClick={() => setTab('veiculos')}
          icon={Car}
          label="Por Veículo"
        />
      </div>

      {/* Render Active Tab Component */}
      <div className="pt-2">
        {tab === 'comparativo' && <ComparativoTab />}
        {tab === 'diario' && <DiarioTab />}
        {tab === 'mensal' && <MensalTab />}
        {tab === 'anual' && <AnualTab />}
        {tab === 'postos' && <PostosTab />}
        {tab === 'veiculos' && <VeiculosTab />}
      </div>
    </div>
  );
}
