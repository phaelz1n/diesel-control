import React from 'react';
import { formatVariation, cn } from '@/lib/utils';

export interface KPICardProps {
  title: string;
  value: string | React.ReactNode;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  trend?: number;
  trendGoodIfPositive?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
  trendGoodIfPositive = false,
  className,
}: KPICardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  const isGood = trendGoodIfPositive ? isPositive : !isPositive;

  return (
    <div className={cn('kpi-card group', className)}>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              isGood ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
            )}
          >
            {formatVariation(trend)}
          </span>
        )}
      </div>

      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>

      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
