import React from 'react';
import { Calendar } from 'lucide-react';
import { DashboardFilters } from '@/lib/types';
import { MONTHS, YEARS } from '@/lib/constants';

export interface FilterBarProps {
  filters: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
  className?: string;
}

export function FilterBar({ filters, onChange, className }: FilterBarProps) {
  const currentYear = new Date().getFullYear();

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className ?? ''}`}>
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Calendar size={15} />
        <span className="hidden sm:inline">Período:</span>
      </div>
      <select
        value={filters.year ?? currentYear}
        onChange={(e) => onChange({ ...filters, year: Number(e.target.value), month: undefined })}
        className="px-3 py-1.5 rounded-xl text-sm outline-none cursor-pointer"
        style={selectStyle}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={filters.month ?? ''}
        onChange={(e) => onChange({ ...filters, month: e.target.value || undefined })}
        className="px-3 py-1.5 rounded-xl text-sm outline-none cursor-pointer"
        style={selectStyle}
      >
        <option value="">Todos os meses</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={`${filters.year ?? currentYear}-${m.value}`}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
