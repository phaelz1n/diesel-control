'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCircle, AlertTriangle, Car, DollarSign, Activity, Clock } from 'lucide-react';
import { getRefuelsForPeriod } from '@/services/refuels';
import { Refuel } from '@/lib/types';
import { formatCurrency, formatNumber, formatDateTime, cn } from '@/lib/utils';
import { MONTHS, YEARS } from '@/lib/constants';

interface AlertItem {
  id: string;
  refuelId: string;
  vehiclePlate: string;
  vehicleModel: string;
  date: Date;
  type: string;
  description: string;
  value: number;
  threshold: number;
  resolved: boolean;
}

const ALERT_THRESHOLDS = {
  minAvgKmL: 2,
  maxUnitPrice: 7,
  maxLiters: 500,
  minIntervalHours: 2,
};

function detectAlerts(refuels: Refuel[]): AlertItem[] {
  const alerts: AlertItem[] = [];

  for (const r of refuels) {
    if (r.avgKmL > 0 && r.avgKmL < ALERT_THRESHOLDS.minAvgKmL) {
      alerts.push({
        id: `${r.id}_kmL`,
        refuelId: r.id,
        vehiclePlate: r.vehiclePlate,
        vehicleModel: r.vehicleModel,
        date: r.date,
        type: 'LOW_KML',
        description: `${r.vehiclePlate} com média ${formatNumber(r.avgKmL, 2)} km/L (mín: ${ALERT_THRESHOLDS.minAvgKmL})`,
        value: r.avgKmL,
        threshold: ALERT_THRESHOLDS.minAvgKmL,
        resolved: false,
      });
    }

    if (r.unitPrice > ALERT_THRESHOLDS.maxUnitPrice) {
      alerts.push({
        id: `${r.id}_price`,
        refuelId: r.id,
        vehiclePlate: r.vehiclePlate,
        vehicleModel: r.vehicleModel,
        date: r.date,
        type: 'HIGH_PRICE',
        description: `Preço R$ ${formatNumber(r.unitPrice, 3)}/L em ${r.stationName} acima de R$ ${ALERT_THRESHOLDS.maxUnitPrice}/L`,
        value: r.unitPrice,
        threshold: ALERT_THRESHOLDS.maxUnitPrice,
        resolved: false,
      });
    }

    if (r.liters > ALERT_THRESHOLDS.maxLiters) {
      alerts.push({
        id: `${r.id}_liters`,
        refuelId: r.id,
        vehiclePlate: r.vehiclePlate,
        vehicleModel: r.vehicleModel,
        date: r.date,
        type: 'HIGH_LITERS',
        description: `${r.vehiclePlate} abasteceu ${formatNumber(r.liters, 0)}L (máx esperado: ${ALERT_THRESHOLDS.maxLiters}L)`,
        value: r.liters,
        threshold: ALERT_THRESHOLDS.maxLiters,
        resolved: false,
      });
    }

    if (r.kmTraveled < 0) {
      alerts.push({
        id: `${r.id}_odo`,
        refuelId: r.id,
        vehiclePlate: r.vehiclePlate,
        vehicleModel: r.vehicleModel,
        date: r.date,
        type: 'ODOMETER_ISSUE',
        description: `${r.vehiclePlate} hodômetro atual < anterior`,
        value: r.currentOdometer,
        threshold: r.previousOdometer,
        resolved: false,
      });
    }
  }

  return alerts;
}

const alertIcons: Record<string, React.ElementType> = {
  LOW_KML: Activity,
  HIGH_KML: Activity,
  HIGH_PRICE: DollarSign,
  HIGH_LITERS: AlertTriangle,
  ODOMETER_ISSUE: Car,
  SHORT_INTERVAL: Clock,
};

const alertColors: Record<string, string> = {
  LOW_KML: '#f59e0b',
  HIGH_KML: '#3b82f6',
  HIGH_PRICE: '#ef4444',
  HIGH_LITERS: '#f59e0b',
  ODOMETER_ISSUE: '#ef4444',
  SHORT_INTERVAL: '#8b5cf6',
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export default function AlertasPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const refuels = await getRefuelsForPeriod({
        month: `${year}-${String(month).padStart(2, '0')}`,
      });
      setAlerts(detectAlerts(refuels));
    } catch (err) { console.error("Erro detalhado:", err);
      toast.error('Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  const groupedAlerts = alerts.reduce<Record<string, AlertItem[]>>((acc, a) => {
    acc[a.type] = [...(acc[a.type] ?? []), a];
    return acc;
  }, {});

  return (
    <div className="page-container animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Alertas de Consumo</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {alerts.length} alertas detectados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={selectStyle}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={String(month).padStart(2, '0')}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" style={selectStyle}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { type: 'LOW_KML', label: 'Consumo baixo' },
          { type: 'HIGH_PRICE', label: 'Preço alto' },
          { type: 'ODOMETER_ISSUE', label: 'Hodômetro' },
          { type: 'HIGH_LITERS', label: 'Litros alto' },
        ].map((t) => {
          const count = groupedAlerts[t.type]?.length ?? 0;
          const Icon = alertIcons[t.type];
          return (
            <div key={t.type} className="kpi-card">
              <Icon size={18} style={{ color: alertColors[t.type], marginBottom: 8 }} />
              <p className="text-2xl font-bold" style={{ color: count > 0 ? alertColors[t.type] : 'var(--text-muted)' }}>{count}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.label}</p>
            </div>
          );
        })}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={48} className="text-green-400/30" />
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nenhum alerta!</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Todos os abastecimentos estão dentro dos parâmetros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const Icon = alertIcons[alert.type] ?? AlertTriangle;
            const color = alertColors[alert.type] ?? '#64748b';
            return (
              <div
                key={alert.id}
                className="flex items-center gap-4 p-4 rounded-2xl border transition-all"
                style={{ background: 'var(--bg-card)', borderColor: `${color}30`, borderLeft: `3px solid ${color}` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}15`, border: `1px solid ${color}25` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{alert.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {alert.vehicleModel} · {formatDateTime(alert.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
                  >
                    {alert.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
