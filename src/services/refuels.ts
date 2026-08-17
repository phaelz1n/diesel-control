import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  startAfter,
  DocumentSnapshot,
  getCountFromServer,
  QueryConstraint,
} from 'firebase/firestore';
import { db, COLLECTIONS, serializeDoc, serializeQuerySnapshot } from '@/lib/firebase/firestore';
import { Refuel, RefuelFilters, DashboardKPIs, MonthlyStats, StationStats, VehicleStats, DailyStats, YearlyStats, VibraOrder, MonthlyExpense } from '@/lib/types';
import { getVibraOrders, getMonthlyExpenses } from './expenses';
import { toYearMonth, calcTotalValue, calcKmTraveled, calcAvgKmL, formatCurrency } from '@/lib/utils';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

// ============================================================
// BUILD QUERY CONSTRAINTS FROM FILTERS
// ============================================================
function buildConstraints(filters: RefuelFilters): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (filters.month) {
    constraints.push(where('month', '==', filters.month));
  } else if (filters.year) {
    const start = `${filters.year}-01`;
    const end = `${filters.year}-12`;
    constraints.push(where('month', '>=', start), where('month', '<=', end));
  }

  if (filters.vehicleId) constraints.push(where('vehicleId', '==', filters.vehicleId));
  if (filters.vehiclePlate) constraints.push(where('vehiclePlate', '==', filters.vehiclePlate));
  if (filters.stationId) constraints.push(where('stationId', '==', filters.stationId));
  if (filters.branchId) constraints.push(where('vehicleBranchId', '==', filters.branchId));
  if (filters.fuelType) constraints.push(where('fuelType', '==', filters.fuelType));

  return constraints;
}

// ============================================================
// GET REFUELS (paginated)
// ============================================================
export async function getRefuels(
  filters: RefuelFilters = {},
  pageSize = DEFAULT_PAGE_SIZE,
  lastDoc?: DocumentSnapshot
): Promise<{ items: Refuel[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [
    ...buildConstraints(filters),
    orderBy('date', 'desc'),
    limit(pageSize),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const q = query(collection(db, COLLECTIONS.REFUELS), ...constraints);
  const snapshot = await getDocs(q);
  const items = serializeQuerySnapshot<Refuel>(snapshot);
  const last = snapshot.docs[snapshot.docs.length - 1] ?? null;
  return { items, lastDoc: last };
}

// ============================================================
// GET ALL REFUELS FOR A PERIOD (for dashboard aggregations)
// ============================================================
export async function getRefuelsForPeriod(filters: RefuelFilters): Promise<Refuel[]> {
  const constraints: QueryConstraint[] = [
    ...buildConstraints(filters),
  ];
  const q = query(collection(db, COLLECTIONS.REFUELS), ...constraints);
  const snapshot = await getDocs(q);
  const items = serializeQuerySnapshot<Refuel>(snapshot);
  // Sort in memory to avoid Firestore composite index requirement on month + date
  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ============================================================
// COUNT REFUELS
// ============================================================
export async function countRefuels(filters: RefuelFilters = {}): Promise<number> {
  const constraints = [...buildConstraints(filters)];
  const q = query(collection(db, COLLECTIONS.REFUELS), ...constraints);
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

// ============================================================
// GET REFUEL BY ID
// ============================================================
export async function getRefuelById(id: string): Promise<Refuel | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.REFUELS, id));
  if (!snapshot.exists()) return null;
  return serializeDoc<Refuel>(snapshot);
}

// ============================================================
// CREATE REFUEL (with auto-calculations)
// ============================================================
export interface CreateRefuelInput {
  date: Date;
  vehicleId: string;
  vehiclePlate: string;
  vehiclePrefix: string;
  vehicleModel: string;
  vehicleBranch: string;
  vehicleBranchId: string;
  stationId: string;
  stationName: string;
  city: string;
  state: string;
  fuelType: string;
  liters: number;
  unitPrice: number;
  previousOdometer: number;
  currentOdometer: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  observations?: string;
}

export async function createRefuel(
  input: CreateRefuelInput,
  userId: string
): Promise<string> {
  const totalValue = calcTotalValue(input.liters, input.unitPrice);
  const kmTraveled = calcKmTraveled(input.currentOdometer, input.previousOdometer);
  const avgKmL = calcAvgKmL(kmTraveled, input.liters);
  const month = toYearMonth(input.date);

  const docRef = await addDoc(collection(db, COLLECTIONS.REFUELS), {
    ...input,
    totalValue,
    kmTraveled,
    avgKmL,
    month,
    year: input.date.getFullYear(),
    hasAlerts: false,
    alertTypes: [],
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update vehicle odometer
  await updateDoc(doc(db, COLLECTIONS.VEHICLES, input.vehicleId), {
    currentOdometer: input.currentOdometer,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return docRef.id;
}

// ============================================================
// UPDATE REFUEL
// ============================================================
export async function updateRefuel(
  id: string,
  data: Partial<Refuel>,
  userId: string
): Promise<void> {
  // Recalculate if values changed
  const updates: Partial<Refuel> = { ...data };
  if (data.liters !== undefined || data.unitPrice !== undefined) {
    const refuel = await getRefuelById(id);
    if (refuel) {
      const liters = data.liters ?? refuel.liters;
      const unitPrice = data.unitPrice ?? refuel.unitPrice;
      updates.totalValue = calcTotalValue(liters, unitPrice);
    }
  }
  if (data.currentOdometer !== undefined || data.previousOdometer !== undefined) {
    const refuel = await getRefuelById(id);
    if (refuel) {
      const curr = data.currentOdometer ?? refuel.currentOdometer;
      const prev = data.previousOdometer ?? refuel.previousOdometer;
      const liters = data.liters ?? refuel.liters;
      updates.kmTraveled = calcKmTraveled(curr, prev);
      updates.avgKmL = calcAvgKmL(updates.kmTraveled, liters);
    }
  }
  if (data.date) {
    updates.month = toYearMonth(data.date);
    updates.year = data.date.getFullYear();
  }

  await updateDoc(doc(db, COLLECTIONS.REFUELS, id), {
    ...updates,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// DELETE REFUEL
// ============================================================
export async function deleteRefuel(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.REFUELS, id));
}

// ============================================================
// DASHBOARD KPIs
// ============================================================
export async function getDashboardKPIs(filters: RefuelFilters): Promise<DashboardKPIs> {
  const refuels = await getRefuelsForPeriod(filters);

  // Fetch Vibra and Gastos Mensais to calculate totalSpent
  let totalSpent = 0;
  
  // se houver mês e ano, usamos a competence. Senão, teríamos que filtrar no frontend,
  // mas para simplificar, se não houver filtro, buscamos tudo e filtramos se necessário.
  let vOrders: VibraOrder[] = [];
  let mExpenses: MonthlyExpense[] = [];
  
  if (filters.year) {
    if (filters.month) {
      vOrders = await getVibraOrders(filters.month);
      mExpenses = await getMonthlyExpenses(filters.month);
    } else {
      // Fetch all and filter by year
      const allV = await getVibraOrders();
      const allM = await getMonthlyExpenses();
      vOrders = allV.filter(v => v.competence.startsWith(String(filters.year)));
      mExpenses = allM.filter(m => m.competence.startsWith(String(filters.year)));
    }
  } else {
    vOrders = await getVibraOrders();
    mExpenses = await getMonthlyExpenses();
  }

  totalSpent = vOrders.reduce((s, v) => s + v.totalValue, 0) + 
               mExpenses.reduce((s, m) => s + m.value, 0);

  if (refuels.length === 0) {
    return {
      totalValue: 0, totalSpent, totalLiters: 0, totalRefuels: 0,
      avgUnitPrice: 0, avgKmL: 0, avgCostPerRefuel: 0,
    };
  }

  const totalValue = refuels.reduce((s, r) => s + r.totalValue, 0);
  const totalLiters = refuels.reduce((s, r) => s + r.liters, 0);
  const totalKm = refuels.reduce((s, r) => s + r.kmTraveled, 0);

  return {
    totalValue,
    totalSpent,
    totalLiters,
    totalRefuels: refuels.length,
    avgUnitPrice: totalLiters > 0 ? totalValue / totalLiters : 0,
    avgKmL: totalLiters > 0 ? totalKm / totalLiters : 0,
    avgCostPerRefuel: refuels.length > 0 ? totalValue / refuels.length : 0,
  };
}

// ============================================================
// MONTHLY STATS (for charts)
// ============================================================
export async function getMonthlyStats(year: number, filters: Omit<RefuelFilters, 'year' | 'month'> = {}): Promise<MonthlyStats[]> {
  const refuels = await getRefuelsForPeriod({ ...filters, year });

  const monthMap = new Map<string, Refuel[]>();
  for (const r of refuels) {
    const list = monthMap.get(r.month) ?? [];
    list.push(r);
    monthMap.set(r.month, list);
  }

  const shortMonths = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const rList = monthMap.get(month) ?? [];
    const totalValue = rList.reduce((s, r) => s + r.totalValue, 0);
    const totalLiters = rList.reduce((s, r) => s + r.liters, 0);
    const totalKm = rList.reduce((s, r) => s + r.kmTraveled, 0);
    return {
      month,
      monthLabel: shortMonths[i],
      totalValue,
      totalLiters,
      totalRefuels: rList.length,
      avgUnitPrice: totalLiters > 0 ? totalValue / totalLiters : 0,
      avgKmL: totalLiters > 0 ? totalKm / totalLiters : 0,
    };
  });
}

// ============================================================
// STATION STATS
// ============================================================
export async function getStationStats(filters: RefuelFilters): Promise<StationStats[]> {
  const refuels = await getRefuelsForPeriod(filters);
  const map = new Map<string, StationStats>();

  for (const r of refuels) {
    const existing = map.get(r.stationId) ?? {
      stationId: r.stationId,
      stationName: r.stationName,
      city: r.city,
      totalRefuels: 0,
      totalLiters: 0,
      totalValue: 0,
      avgUnitPrice: 0,
    };
    existing.totalRefuels++;
    existing.totalLiters += r.liters;
    existing.totalValue += r.totalValue;
    map.set(r.stationId, existing);
  }

  return Array.from(map.values())
    .map((s) => ({ ...s, avgUnitPrice: s.totalLiters > 0 ? s.totalValue / s.totalLiters : 0 }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

// ============================================================
// VEHICLE STATS
// ============================================================
export async function getVehicleStats(filters: RefuelFilters): Promise<VehicleStats[]> {
  const refuels = await getRefuelsForPeriod(filters);
  const map = new Map<string, VehicleStats>();

  for (const r of refuels) {
    const existing = map.get(r.vehicleId) ?? {
      vehicleId: r.vehicleId,
      vehiclePlate: r.vehiclePlate,
      vehiclePrefix: r.vehiclePrefix,
      vehicleModel: r.vehicleModel,
      vehicleBranch: r.vehicleBranch,
      totalRefuels: 0,
      totalLiters: 0,
      totalValue: 0,
      totalKm: 0,
      avgKmL: 0,
    };
    existing.totalRefuels++;
    existing.totalLiters += r.liters;
    existing.totalValue += r.totalValue;
    existing.totalKm += r.kmTraveled;
    map.set(r.vehicleId, existing);
  }

  return Array.from(map.values())
    .map((v) => ({ ...v, avgKmL: v.totalLiters > 0 ? v.totalKm / v.totalLiters : 0 }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

// ============================================================
// DAILY STATS
// ============================================================
export async function getDailyStats(month: string, filters: Omit<RefuelFilters, 'month' | 'year'> = {}): Promise<DailyStats[]> {
  const refuels = await getRefuelsForPeriod({ ...filters, month });

  const map = new Map<string, Refuel[]>();
  for (const r of refuels) {
    const d = new Date(r.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = map.get(dateStr) ?? [];
    list.push(r);
    map.set(dateStr, list);
  }

  const [y, m] = month.split('-');
  const daysInMonth = new Date(Number(y), Number(m), 0).getDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const dateStr = `${month}-${day}`;
    const rList = map.get(dateStr) ?? [];
    
    const totalValue = rList.reduce((s, r) => s + r.totalValue, 0);
    const totalLiters = rList.reduce((s, r) => s + r.liters, 0);
    const totalKm = rList.reduce((s, r) => s + r.kmTraveled, 0);
    
    return {
      date: dateStr,
      dayLabel: day,
      totalValue,
      totalLiters,
      totalRefuels: rList.length,
      avgUnitPrice: totalLiters > 0 ? totalValue / totalLiters : 0,
      avgKmL: totalLiters > 0 ? totalKm / totalLiters : 0,
    };
  });
}

// ============================================================
// YEARLY STATS
// ============================================================
export async function getYearlyStats(filters: RefuelFilters = {}): Promise<YearlyStats[]> {
  const refuels = await getRefuelsForPeriod(filters);

  const map = new Map<number, Refuel[]>();
  for (const r of refuels) {
    const y = r.year;
    const list = map.get(y) ?? [];
    list.push(r);
    map.set(y, list);
  }

  const years = Array.from(map.keys()).sort();
  
  return years.map(year => {
    const rList = map.get(year) ?? [];
    const totalValue = rList.reduce((s, r) => s + r.totalValue, 0);
    const totalLiters = rList.reduce((s, r) => s + r.liters, 0);
    const totalKm = rList.reduce((s, r) => s + r.kmTraveled, 0);
    
    return {
      year,
      totalValue,
      totalLiters,
      totalRefuels: rList.length,
      avgUnitPrice: totalLiters > 0 ? totalValue / totalLiters : 0,
      avgKmL: totalLiters > 0 ? totalKm / totalLiters : 0,
    };
  });
}

