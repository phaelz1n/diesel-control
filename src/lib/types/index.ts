// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export type UserRole = 'admin' | 'operational' | 'viewer';

export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

export type FuelType = 'Diesel S10' | 'Diesel S500' | 'Gasolina' | 'Etanol' | 'GNV' | 'Elétrico';

export type VehicleType = 'Micro-ônibus' | 'Ônibus' | 'Van' | 'Caminhão' | 'Utilitário' | 'Automóvel';

export type ExpenseCategory = 'NF' | 'CARD' | 'VIBRA' | 'OTHER';

export type ExpenseStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';

export type VibraStatus = 'PENDING' | 'PAID' | 'PARTIAL';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'IMPORT'
  | 'EXPORT'
  | 'PASSWORD_RESET';

export type AuditEntityType =
  | 'refuel'
  | 'vehicle'
  | 'station'
  | 'expense'
  | 'vibra_order'
  | 'user'
  | 'branch'
  | 'settings'
  | 'import';

// ============================================================
// BASE TYPES
// ============================================================

export interface BaseDocument {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// ============================================================
// USER
// ============================================================

export interface AppUser extends BaseDocument {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  phone?: string;
  avatar?: string;
  lastLogin?: Date;
}

// ============================================================
// BRANCH (FILIAL)
// ============================================================

export interface Branch extends BaseDocument {
  name: string;
  normalizedName: string;
  city: string;
  state: string;
  responsible?: string;
  phone?: string;
  active: boolean;
  observations?: string;
}

// ============================================================
// VEHICLE
// ============================================================

export interface Vehicle extends BaseDocument {
  plate: string;          // Placa (unique)
  prefix: string;         // Prefixo
  model: string;          // Modelo
  brand: string;          // Marca
  branchId: string;       // Filial ID
  branchName: string;     // Filial nome (desnormalizado)
  status: VehicleStatus;
  type: VehicleType;
  fuelType: FuelType;
  currentOdometer: number;
  year?: number;
  color?: string;
  observations?: string;
}

// ============================================================
// STATION (POSTO)
// ============================================================

export interface Station extends BaseDocument {
  name: string;
  normalizedName: string; // lowercase, sem acento, para busca
  city: string;
  state: string;
  type: string;           // Posto, Distribuidora, etc.
  active: boolean;
  cnpj?: string;
  phone?: string;
  address?: string;
  observations?: string;
}

// ============================================================
// REFUEL (ABASTECIMENTO)
// ============================================================

export interface Refuel extends BaseDocument {
  // Date/time
  date: Date;
  month: string;          // YYYY-MM (para filtros e índices)
  year: number;

  // Vehicle (desnormalizado para performance)
  vehicleId: string;
  vehiclePlate: string;
  vehiclePrefix: string;
  vehicleModel: string;
  vehicleBranch: string;
  vehicleBranchId: string;

  // Station (desnormalizado)
  stationId: string;
  stationName: string;
  city: string;
  state: string;

  // Fuel
  fuelType: FuelType;
  liters: number;
  unitPrice: number;
  totalValue: number;

  // Odometer
  previousOdometer: number;
  currentOdometer: number;
  kmTraveled: number;
  avgKmL: number;         // kmTraveled / liters

  // Financial
  paymentMethod?: string; // NF, Cartão, Vibra, etc.
  invoiceNumber?: string;

  observations?: string;

  // Alert flags
  hasAlerts?: boolean;
  alertTypes?: string[];
}

// ============================================================
// MONTHLY EXPENSE (GASTO MENSAL)
// ============================================================

export interface MonthlyExpense extends BaseDocument {
  competence: string;     // YYYY-MM
  supplierId?: string;
  supplierName: string;
  category: ExpenseCategory;
  categoryLabel: string;
  value: number;
  dueDate: Date;
  paymentDate?: Date;
  status: ExpenseStatus;
  invoiceNumber?: string;
  observations?: string;
}

// ============================================================
// VIBRA ORDER
// ============================================================

export interface VibraOrder extends BaseDocument {
  competence: string;     // YYYY-MM
  issueDate: Date;
  paymentDate?: Date;
  liters: number;
  unitPrice: number;
  totalValue: number;
  orderNumber?: string;
  invoiceNumber?: string;
  status: VibraStatus;
  observations?: string;
}

// ============================================================
// AUDIT LOG
// ============================================================

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  timestamp: Date;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================
// SETTINGS
// ============================================================

export interface AlertThresholds {
  minAvgKmL: number;
  maxAvgKmL: number;
  maxUnitPrice: number;
  maxLitersPerRefuel: number;
  minIntervalHours: number;   // horas mínimas entre abastecimentos do mesmo veículo
}

export interface AppSettings {
  id: string;
  alertThresholds: AlertThresholds;
  fuelTypes: FuelType[];
  vehicleTypes: VehicleType[];
  updatedAt: Date;
  updatedBy: string;
}

// ============================================================
// DASHBOARD / ANALYTICS
// ============================================================

export interface DashboardKPIs {
  totalValue: number;
  totalLiters: number;
  totalRefuels: number;
  avgUnitPrice: number;
  avgKmL: number;
  avgCostPerRefuel: number;
}

export interface MonthlyStats {
  month: string;          // YYYY-MM
  monthLabel: string;     // "Jan", "Fev", etc.
  totalValue: number;
  totalLiters: number;
  totalRefuels: number;
  avgUnitPrice: number;
  avgKmL: number;
}

export interface DailyStats {
  date: string;           // YYYY-MM-DD
  dayLabel: string;       // "01", "02", etc.
  totalValue: number;
  totalLiters: number;
  totalRefuels: number;
  avgUnitPrice: number;
  avgKmL: number;
}

export interface YearlyStats {
  year: number;           // YYYY
  totalValue: number;
  totalLiters: number;
  totalRefuels: number;
  avgUnitPrice: number;
  avgKmL: number;
}

export interface StationStats {
  stationId: string;
  stationName: string;
  city: string;
  totalRefuels: number;
  totalLiters: number;
  totalValue: number;
  avgUnitPrice: number;
}

export interface VehicleStats {
  vehicleId: string;
  vehiclePlate: string;
  vehiclePrefix: string;
  vehicleModel: string;
  vehicleBranch: string;
  totalRefuels: number;
  totalLiters: number;
  totalValue: number;
  totalKm: number;
  avgKmL: number;
}

export interface ComparisonData {
  period: string;
  label: string;
  totalValue: number;
  totalLiters: number;
  totalRefuels: number;
  avgUnitPrice: number;
  avgKmL: number;
  totalKm: number;
}

// ============================================================
// FILTERS
// ============================================================

export interface RefuelFilters {
  year?: number;
  month?: string;         // YYYY-MM
  vehicleId?: string;
  vehiclePlate?: string;
  stationId?: string;
  branchId?: string;
  fuelType?: FuelType;
  minValue?: number;
  maxValue?: number;
  minKmL?: number;
  maxKmL?: number;
  city?: string;
}

export interface DashboardFilters {
  year?: number;
  month?: string;
  branchId?: string;
  vehicleId?: string;
  stationId?: string;
  fuelType?: FuelType;
}

// ============================================================
// IMPORT
// ============================================================

export interface ImportRow {
  rowIndex: number;
  data: Record<string, string | number | null>;
  mapped?: Partial<Refuel>;
  errors?: string[];
  warnings?: string[];
  isDuplicate?: boolean;
  status: 'pending' | 'valid' | 'error' | 'duplicate';
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

// ============================================================
// ALERT
// ============================================================

export interface Alert {
  id: string;
  refuelId: string;
  vehiclePlate: string;
  vehicleModel: string;
  date: Date;
  type: 'LOW_KML' | 'HIGH_KML' | 'HIGH_PRICE' | 'HIGH_LITERS' | 'ODOMETER_ISSUE' | 'SHORT_INTERVAL';
  description: string;
  value: number;
  threshold: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ============================================================
// COMPARISON (Reports)
// ============================================================

export interface ComparisonData {
  period1: string;
  period2: string;
  kpis1: DashboardKPIs;
  kpis2: DashboardKPIs;
}

// ============================================================
// AUDIT FILTERS
// ============================================================

export interface AuditFilters {
  userId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================
// VIBRA SUMMARY
// ============================================================

export interface VibraSummary {
  totalLiters: number;
  totalValue: number;
  avgUnitPrice: number;
  orderCount: number;
  avgLitersPerOrder: number;
}

