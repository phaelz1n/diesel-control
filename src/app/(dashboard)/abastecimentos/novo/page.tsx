'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Car, MapPin, Fuel, Calculator, Save, ArrowLeft,
  ChevronDown, AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react';
import { refuelSchema, RefuelFormData } from '@/lib/validations';
import { createRefuel } from '@/services/refuels';
import { getVehicles, searchVehicles } from '@/services/vehicles';
import { getStations, searchStations } from '@/services/stations';
import { useAuth } from '@/lib/hooks/useAuth';
import { createAuditLog } from '@/services/audit';
import { Vehicle, Station } from '@/lib/types';
import { formatCurrency, formatNumber, calcTotalValue, calcKmTraveled, calcAvgKmL, cn } from '@/lib/utils';
import { FUEL_TYPES, PAYMENT_METHODS } from '@/lib/constants';

// ============================================================
// AUTOCOMPLETE INPUT
// ============================================================
interface AutocompleteProps<T> {
  label: string;
  placeholder: string;
  items: T[];
  displayKey: keyof T;
  secondaryKey?: keyof T;
  onSelect: (item: T) => void;
  onSearch: (term: string) => void;
  value: string;
  error?: string;
  icon?: React.ElementType;
}

function Autocomplete<T extends { id: string }>({
  label,
  placeholder,
  items,
  displayKey,
  secondaryKey,
  onSelect,
  onSearch,
  value,
  error,
  icon: Icon,
}: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(value);

  useEffect(() => { setTerm(value); }, [value]);

  return (
    <div className="space-y-1.5 relative">
      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        )}
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            onSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { onSearch(term); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn('w-full py-2.5 pr-9 rounded-xl text-sm outline-none transition-all', Icon ? 'pl-9' : 'pl-3')}
          style={{
            background: 'var(--bg-secondary)',
            border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
            color: 'var(--text-primary)',
          }}
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {open && items.length > 0 && (
        <div
          className="absolute z-50 w-full rounded-xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', top: '100%', marginTop: 4 }}
        >
          {items.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={() => {
                onSelect(item);
                setTerm(String(item[displayKey]));
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b last:border-0"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {String(item[displayKey])}
              </p>
              {secondaryKey && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {String(item[secondaryKey])}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FIELD
// ============================================================
interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, error, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
};

// ============================================================
// NOVO ABASTECIMENTO PAGE
// ============================================================
export default function NovoAbastecimentoPage() {
  const router = useRouter();
  const { profile } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAndNew, setSaveAndNew] = useState(false);

  // Calculated values
  const [totalValue, setTotalValue] = useState(0);
  const [kmTraveled, setKmTraveled] = useState(0);
  const [avgKmL, setAvgKmL] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
    control,
  } = useForm<RefuelFormData>({
    resolver: zodResolver(refuelSchema),
    defaultValues: {
      date: new Date(),
      fuelType: 'Diesel S10',
      previousOdometer: 0,
      currentOdometer: 0,
      liters: 0,
      unitPrice: 0,
      vehicleId: '',
      vehiclePlate: '',
      vehiclePrefix: '',
      vehicleModel: '',
      vehicleBranch: '',
      vehicleBranchId: '',
      stationId: '',
      stationName: '',
      city: '',
      state: '',
    },
  });

  const watchLiters = watch('liters');
  const watchUnitPrice = watch('unitPrice');
  const watchPrevOdometer = watch('previousOdometer');
  const watchCurrOdometer = watch('currentOdometer');

  // Auto-calculate
  useEffect(() => {
    const total = calcTotalValue(watchLiters || 0, watchUnitPrice || 0);
    const km = calcKmTraveled(watchCurrOdometer || 0, watchPrevOdometer || 0);
    const avg = calcAvgKmL(km, watchLiters || 0);
    setTotalValue(total);
    setKmTraveled(km);
    setAvgKmL(avg);
  }, [watchLiters, watchUnitPrice, watchPrevOdometer, watchCurrOdometer]);

  // Load initial data
  useEffect(() => {
    getVehicles(true).then(setVehicles).catch(console.error);
    getStations(true).then(setStations).catch(console.error);
  }, []);

  // Vehicle search
  const handleVehicleSearch = useCallback(
    (term: string) => {
      if (!term) {
        setFilteredVehicles(vehicles.slice(0, 10));
        return;
      }
      const lower = term.toLowerCase();
      setFilteredVehicles(
        vehicles
          .filter(
            (v) =>
              v.plate.toLowerCase().includes(lower) ||
              v.prefix.toLowerCase().includes(lower) ||
              v.model.toLowerCase().includes(lower)
          )
          .slice(0, 10)
      );
    },
    [vehicles]
  );

  // Station search
  const handleStationSearch = useCallback(
    (term: string) => {
      if (!term) {
        setFilteredStations(stations.slice(0, 10));
        return;
      }
      const lower = term.toLowerCase();
      setFilteredStations(
        stations
          .filter(
            (s) =>
              s.name.toLowerCase().includes(lower) ||
              s.city.toLowerCase().includes(lower)
          )
          .slice(0, 10)
      );
    },
    [stations]
  );

  // When vehicle is selected — auto-fill fields
  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setValue('vehicleId', vehicle.id);
    setValue('vehiclePlate', vehicle.plate);
    setValue('vehiclePrefix', vehicle.prefix);
    setValue('vehicleModel', vehicle.model);
    setValue('vehicleBranch', vehicle.branchName);
    setValue('vehicleBranchId', vehicle.branchId);
    setValue('fuelType', vehicle.fuelType as RefuelFormData['fuelType']);
    setValue('previousOdometer', vehicle.currentOdometer);
    setValue('currentOdometer', vehicle.currentOdometer);
  };

  // When station is selected — auto-fill
  const handleStationSelect = (station: Station) => {
    setSelectedStation(station);
    setValue('stationId', station.id);
    setValue('stationName', station.name);
    setValue('city', station.city);
    setValue('state', station.state);
  };

  const doSubmit = async (data: RefuelFormData) => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const id = await createRefuel(
        {
          ...data,
          date: data.date,
          state: data.state ?? '',
        },
        profile.uid
      );

      await createAuditLog(
        profile.uid, profile.email, profile.name,
        'CREATE', 'refuel', id,
        `${profile.name} lançou abastecimento: ${data.vehiclePlate} em ${data.stationName}`,
        { newValues: { vehiclePlate: data.vehiclePlate, liters: data.liters, totalValue } }
      );

      toast.success('Abastecimento lançado com sucesso!', {
        description: `${data.vehiclePlate} · ${formatNumber(data.liters, 2)} L · ${formatCurrency(totalValue)}`,
      });

      if (saveAndNew) {
        // Reset form but keep some context
        reset({
          date: new Date(),
          fuelType: data.fuelType,
          vehicleId: '', vehiclePlate: '', vehiclePrefix: '',
          vehicleModel: '', vehicleBranch: '', vehicleBranchId: '',
          stationId: data.stationId, stationName: data.stationName,
          city: data.city, state: data.state,
          liters: 0, unitPrice: data.unitPrice,
          previousOdometer: 0, currentOdometer: 0,
        });
        setSelectedVehicle(null);
        setSaveAndNew(false);
      } else {
        router.push('/abastecimentos');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const odometerWarning = kmTraveled < 0;
  const lowKmL = avgKmL > 0 && avgKmL < 2;

  return (
    <div className="page-container max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl transition-colors hover:bg-white/5"
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Novo Abastecimento
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Preencha os campos abaixo. Os cálculos são automáticos.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(doSubmit)} className="space-y-6">
        {/* Section: Veículo */}
        <div
          className="rounded-2xl p-6 border space-y-5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <Car size={18} className="text-blue-400" />
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Veículo</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Vehicle autocomplete */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Autocomplete<Vehicle>
                label="Placa / Veículo *"
                placeholder="Digite a placa ou modelo..."
                items={filteredVehicles}
                displayKey="plate"
                secondaryKey="model"
                value={selectedVehicle?.plate ?? ''}
                onSearch={handleVehicleSearch}
                onSelect={handleVehicleSelect}
                error={errors.vehicleId?.message}
                icon={Car}
              />
            </div>

            {/* Auto-filled: Prefix */}
            <Field label="Prefixo">
              <input
                value={watch('vehiclePrefix')}
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-60"
                style={{ ...inputStyle, cursor: 'not-allowed' }}
              />
            </Field>

            {/* Auto-filled: Model */}
            <Field label="Modelo">
              <input
                value={watch('vehicleModel')}
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-60"
                style={{ ...inputStyle, cursor: 'not-allowed' }}
              />
            </Field>

            {/* Auto-filled: Branch */}
            <Field label="Filial">
              <input
                value={watch('vehicleBranch')}
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-60"
                style={{ ...inputStyle, cursor: 'not-allowed' }}
              />
            </Field>

            {/* Date */}
            <Field label="Data e Hora *" error={errors.date?.message}>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <input
                    type="datetime-local"
                    value={field.value instanceof Date
                      ? field.value.toISOString().slice(0, 16)
                      : String(field.value)}
                    onChange={(e) => field.onChange(new Date(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  />
                )}
              />
            </Field>

            {/* Fuel type */}
            <Field label="Combustível *">
              <select
                {...register('fuelType')}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={inputStyle}
              >
                {FUEL_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Section: Posto */}
        <div
          className="rounded-2xl p-6 border space-y-5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <MapPin size={18} className="text-green-400" />
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Posto</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Station autocomplete */}
            <div className="sm:col-span-2">
              <Autocomplete<Station>
                label="Posto *"
                placeholder="Digite o nome do posto..."
                items={filteredStations}
                displayKey="name"
                secondaryKey="city"
                value={selectedStation?.name ?? ''}
                onSearch={handleStationSearch}
                onSelect={handleStationSelect}
                error={errors.stationId?.message}
                icon={MapPin}
              />
            </div>

            {/* City */}
            <Field label="Cidade">
              <input
                value={watch('city')}
                readOnly
                className="w-full px-3 py-2.5 rounded-xl text-sm opacity-60"
                style={{ ...inputStyle, cursor: 'not-allowed' }}
              />
            </Field>

            {/* Payment method */}
            <Field label="Forma de Pagamento">
              <select
                {...register('paymentMethod')}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="">Selecione...</option>
                {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            {/* Invoice number */}
            <Field label="Nº Nota Fiscal">
              <input
                {...register('invoiceNumber')}
                placeholder="Ex: 123456"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        {/* Section: Combustível + Hodômetro */}
        <div
          className="rounded-2xl p-6 border space-y-5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <Fuel size={18} className="text-amber-400" />
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Abastecimento</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {/* Liters */}
            <div className="col-span-2 sm:col-span-1">
              <Field label="Litros *" error={errors.liters?.message}>
                <input
                  {...register('liters', { valueAsNumber: true })}
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0,000"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ ...inputStyle, border: errors.liters ? '1px solid #ef4444' : '1px solid var(--border)' }}
                />
              </Field>
            </div>

            {/* Unit price */}
            <div className="col-span-2 sm:col-span-1">
              <Field label="Valor Unitário *" error={errors.unitPrice?.message}>
                <input
                  {...register('unitPrice', { valueAsNumber: true })}
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0,000"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ ...inputStyle, border: errors.unitPrice ? '1px solid #ef4444' : '1px solid var(--border)' }}
                />
              </Field>
            </div>

            {/* Total (calculated) */}
            <div className="col-span-2 sm:col-span-1">
              <Field label="Valor Total">
                <div
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
                >
                  <Calculator size={14} />
                  {formatCurrency(totalValue)}
                </div>
              </Field>
            </div>

            {/* Previous odometer */}
            <div className="col-span-2 sm:col-span-1">
              <Field label="Hodômetro Anterior *" error={errors.previousOdometer?.message}>
                <input
                  {...register('previousOdometer', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </Field>
            </div>

            {/* Current odometer */}
            <div className="col-span-2 sm:col-span-1">
              <Field label="Hodômetro Atual *" error={errors.currentOdometer?.message}>
                <input
                  {...register('currentOdometer', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ ...inputStyle, border: errors.currentOdometer ? '1px solid #ef4444' : '1px solid var(--border)' }}
                />
              </Field>
            </div>

            {/* KM + Average (calculated) */}
            <div className="col-span-2 sm:col-span-1">
              <Field label="KM / Média">
                <div className="space-y-1">
                  <div
                    className="w-full px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}
                  >
                    {kmTraveled >= 0 ? `${formatNumber(kmTraveled, 0)} km` : '—'}
                  </div>
                  <div
                    className={cn('w-full px-3 py-1.5 rounded-xl text-xs font-medium')}
                    style={{
                      background: lowKmL ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                      border: lowKmL ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)',
                      color: lowKmL ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {avgKmL > 0 ? `${formatNumber(avgKmL, 2)} km/L` : '—'}
                  </div>
                </div>
              </Field>
            </div>
          </div>

          {/* Warnings */}
          {odometerWarning && (
            <div
              className="flex items-center gap-3 rounded-xl p-3 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-400">
                Hodômetro atual ({formatNumber(watchCurrOdometer || 0, 0)}) é menor que o anterior ({formatNumber(watchPrevOdometer || 0, 0)}).
              </span>
            </div>
          )}

          {lowKmL && (
            <div
              className="flex items-center gap-3 rounded-xl p-3 text-sm"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <span className="text-amber-400">
                Média de {formatNumber(avgKmL, 2)} km/L está abaixo do mínimo esperado (2 km/L).
              </span>
            </div>
          )}
        </div>

        {/* Observations */}
        <div
          className="rounded-2xl p-6 border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <Field label="Observação">
            <textarea
              {...register('observations')}
              rows={2}
              placeholder="Informações adicionais..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={() => setSaveAndNew(true)}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa',
            }}
          >
            <RefreshCw size={15} />
            Salvar e lançar próximo
          </button>
          <button
            type="submit"
            onClick={() => setSaveAndNew(false)}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: isSaving ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              boxShadow: isSaving ? 'none' : '0 4px 16px rgba(37,99,235,0.4)',
            }}
          >
            {isSaving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <Save size={15} />
            )}
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
