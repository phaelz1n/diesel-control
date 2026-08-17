import { FuelType, VehicleType, VehicleStatus, ExpenseCategory, ExpenseStatus, VibraStatus, UserRole } from '@/lib/types';

export const FUEL_TYPES: FuelType[] = [
  'Diesel S10',
  'Diesel S500',
  'Gasolina',
  'Etanol',
  'GNV',
  'Elétrico',
];

export const VEHICLE_TYPES: VehicleType[] = [
  'Micro-ônibus',
  'Ônibus',
  'Van',
  'Caminhão',
  'Utilitário',
  'Automóvel',
];

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  maintenance: 'Em manutenção',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  operational: 'Operacional',
  viewer: 'Visualização',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  NF: 'Nota Fiscal',
  CARD: 'Cartão',
  VIBRA: 'Vibra',
  OTHER: 'Outros',
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
  PARTIAL: 'Parcial',
};

export const VIBRA_STATUS_LABELS: Record<VibraStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  PARTIAL: 'Parcial',
};

export const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export const CURRENT_YEAR = new Date().getFullYear();

export const YEARS = Array.from(
  { length: 10 },
  (_, i) => CURRENT_YEAR - i
);

export const DEFAULT_ALERT_THRESHOLDS = {
  minAvgKmL: 2,
  maxAvgKmL: 20,
  maxUnitPrice: 7,
  maxLitersPerRefuel: 500,
  minIntervalHours: 2,
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

export const ALERT_TYPE_LABELS = {
  LOW_KML: 'Consumo baixo (km/L)',
  HIGH_KML: 'Consumo alto (km/L)',
  HIGH_PRICE: 'Preço elevado',
  HIGH_LITERS: 'Litros acima do limite',
  ODOMETER_ISSUE: 'Hodômetro inconsistente',
  SHORT_INTERVAL: 'Abastecimento em intervalo curto',
} as const;

export const PAYMENT_METHODS = [
  'Nota Fiscal',
  'Cartão Veloe GO',
  'Vibra',
  'Dinheiro',
  'Outros',
];

export const STATION_TYPES = [
  'Posto',
  'Distribuidora',
  'Frota',
  'Tanque Próprio',
  'Outros',
];

export const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];
