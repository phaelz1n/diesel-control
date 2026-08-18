import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS, serializeQuerySnapshot } from '@/lib/firebase/firestore';
import { MonthlyExpense, VibraOrder } from '@/lib/types';
import { calcTotalValue } from '@/lib/utils';

// ============================================================
// MONTHLY EXPENSES
// ============================================================
export async function getMonthlyExpenses(competence?: string): Promise<MonthlyExpense[]> {
  const constraints = competence ? [where('competence', '==', competence)] : [];
  const q = query(collection(db, COLLECTIONS.MONTHLY_EXPENSES), ...constraints);
  const snapshot = await getDocs(q);
  const items = serializeQuerySnapshot<MonthlyExpense>(snapshot);
  return items.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
}

export async function createMonthlyExpense(
  data: Omit<MonthlyExpense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.MONTHLY_EXPENSES), {
    ...data,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateMonthlyExpense(
  id: string,
  data: Partial<MonthlyExpense>,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.MONTHLY_EXPENSES, id), {
    ...data,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMonthlyExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.MONTHLY_EXPENSES, id));
}

// ============================================================
// VIBRA ORDERS
// ============================================================
export function getVibraOrderIssueCompetence(order: Partial<VibraOrder>): string {
  if (order.issueDate) {
    const d = order.issueDate instanceof Date ? order.issueDate : new Date(order.issueDate);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return order.competence || '';
}

export function getVibraOrderPaymentCompetence(order: Partial<VibraOrder>): string {
  if (order.paymentDate) {
    const d = order.paymentDate instanceof Date ? order.paymentDate : new Date(order.paymentDate);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  if (order.issueDate) {
    const d = order.issueDate instanceof Date ? order.issueDate : new Date(order.issueDate);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return order.competence || '';
}

export const getVibraOrderCompetence = getVibraOrderPaymentCompetence;

export async function getVibraOrders(
  competence?: string,
  filterBy: 'payment' | 'issue' | 'all' = 'payment'
): Promise<VibraOrder[]> {
  const q = query(collection(db, COLLECTIONS.VIBRA_ORDERS));
  const snapshot = await getDocs(q);
  let items = serializeQuerySnapshot<VibraOrder>(snapshot);
  
  if (competence) {
    if (filterBy === 'issue') {
      items = items.filter((o) => getVibraOrderIssueCompetence(o) === competence);
    } else if (filterBy === 'payment') {
      items = items.filter((o) => getVibraOrderPaymentCompetence(o) === competence);
    } else {
      items = items.filter(
        (o) =>
          getVibraOrderPaymentCompetence(o) === competence ||
          getVibraOrderIssueCompetence(o) === competence
      );
    }
  }

  return items.sort((a, b) => {
    const timeA = a.paymentDate
      ? new Date(a.paymentDate).getTime()
      : a.issueDate
      ? new Date(a.issueDate).getTime()
      : 0;
    const timeB = b.paymentDate
      ? new Date(b.paymentDate).getTime()
      : b.issueDate
      ? new Date(b.issueDate).getTime()
      : 0;
    return timeB - timeA;
  });
}

export async function createVibraOrder(
  data: Omit<VibraOrder, 'id' | 'createdAt' | 'updatedAt' | 'totalValue' | 'createdBy' | 'updatedBy'> & { liters: number; unitPrice: number },
  userId: string
): Promise<string> {
  const totalValue = calcTotalValue(data.liters, data.unitPrice);
  const docRef = await addDoc(collection(db, COLLECTIONS.VIBRA_ORDERS), {
    ...data,
    totalValue,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateVibraOrder(
  id: string,
  data: Partial<VibraOrder>,
  userId: string
): Promise<void> {
  const updates: Partial<VibraOrder> = { ...data };
  if (data.liters !== undefined || data.unitPrice !== undefined) {
    const liters = data.liters ?? 0;
    const unitPrice = data.unitPrice ?? 0;
    if (liters > 0 && unitPrice > 0) {
      updates.totalValue = calcTotalValue(liters, unitPrice);
    }
  }
  await updateDoc(doc(db, COLLECTIONS.VIBRA_ORDERS, id), {
    ...updates,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVibraOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.VIBRA_ORDERS, id));
}

export async function deleteVibraOrdersByCompetence(competence: string): Promise<number> {
  const orders = await getVibraOrders(competence);
  if (orders.length === 0) return 0;

  const batchSize = 500;
  let count = 0;
  for (let i = 0; i < orders.length; i += batchSize) {
    const chunk = orders.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(doc(db, COLLECTIONS.VIBRA_ORDERS, d.id)));
    await batch.commit();
    count += chunk.length;
  }
  return count;
}

// ============================================================
// VIBRA SUMMARY by competence
// ============================================================
export interface VibraSummary {
  competence: string;
  // Pedidos emitidos no mês (Volume e Valor Comprado)
  issuedTotalLiters: number;
  issuedTotalValue: number;
  issuedAvgUnitPrice: number;
  issuedOrderCount: number;

  // Contas a pagar / Vencimentos no mês
  dueTotalValue: number;
  dueTotalLiters: number;
  duePaidValue: number;
  duePendingValue: number;
  duePaidCount: number;
  duePendingCount: number;
  dueOrderCount: number;

  // Legado / compatibilidade
  totalLiters: number;
  totalValue: number;
  avgUnitPrice: number;
  orderCount: number;
  avgLitersPerOrder: number;
}

export async function getVibraSummary(competence: string): Promise<VibraSummary> {
  const allOrders = await getVibraOrders();
  
  // Pedidos emitidos neste mês (data de emissão)
  const issuedOrders = allOrders.filter(o => getVibraOrderIssueCompetence(o) === competence);
  const issuedTotalLiters = issuedOrders.reduce((s, o) => s + o.liters, 0);
  const issuedTotalValue = issuedOrders.reduce((s, o) => s + o.totalValue, 0);
  const issuedAvgUnitPrice = issuedTotalLiters > 0 ? issuedTotalValue / issuedTotalLiters : 0;
  const issuedOrderCount = issuedOrders.length;

  // Vencimentos/Pagamentos no mês (data de vencimento/pagamento)
  const dueOrders = allOrders.filter(o => getVibraOrderPaymentCompetence(o) === competence);
  const dueTotalValue = dueOrders.reduce((s, o) => s + o.totalValue, 0);
  const dueTotalLiters = dueOrders.reduce((s, o) => s + o.liters, 0);
  const duePaidValue = dueOrders.filter(o => o.status === 'PAID').reduce((s, o) => s + o.totalValue, 0);
  const duePendingValue = dueOrders.filter(o => o.status !== 'PAID').reduce((s, o) => s + o.totalValue, 0);
  const duePaidCount = dueOrders.filter(o => o.status === 'PAID').length;
  const duePendingCount = dueOrders.filter(o => o.status !== 'PAID').length;
  const dueOrderCount = dueOrders.length;

  return {
    competence,
    issuedTotalLiters,
    issuedTotalValue,
    issuedAvgUnitPrice,
    issuedOrderCount,
    dueTotalValue,
    dueTotalLiters,
    duePaidValue,
    duePendingValue,
    duePaidCount,
    duePendingCount,
    dueOrderCount,
    totalLiters: dueTotalLiters,
    totalValue: dueTotalValue,
    avgUnitPrice: dueTotalLiters > 0 ? dueTotalValue / dueTotalLiters : 0,
    orderCount: dueOrderCount,
    avgLitersPerOrder: dueOrderCount > 0 ? dueTotalLiters / dueOrderCount : 0,
  };
}

// ============================================================
// VIBRA PROJECTION & HISTORY
// ============================================================
export interface VibraPendingBill {
  id: string;
  order: VibraOrder;
  dueDate: Date;
  daysRemaining: number;
  statusCategory: 'overdue' | 'today' | 'next_7_days' | 'next_30_days' | 'future';
}

export interface VibraProjectionSummary {
  totalPendingValue: number;
  totalPendingCount: number;
  overdueValue: number;
  overdueCount: number;
  todayValue: number;
  todayCount: number;
  next7DaysValue: number;
  next7DaysCount: number;
  next30DaysValue: number;
  next30DaysCount: number;
  futureValue: number;
  futureCount: number;
  bills: VibraPendingBill[];
  monthlyTimeline: {
    month: string;
    monthLabel: string;
    totalValue: number;
    paidValue: number;
    pendingValue: number;
    orderCount: number;
  }[];
}

export function calcVibraProjection(orders: VibraOrder[]): VibraProjectionSummary {
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const pendingBills: VibraPendingBill[] = [];
  let totalPendingValue = 0;
  let overdueValue = 0;
  let overdueCount = 0;
  let todayValue = 0;
  let todayCount = 0;
  let next7DaysValue = 0;
  let next7DaysCount = 0;
  let next30DaysValue = 0;
  let next30DaysCount = 0;
  let futureValue = 0;
  let futureCount = 0;

  const monthMap = new Map<string, { totalValue: number; paidValue: number; pendingValue: number; orderCount: number }>();

  for (const o of orders) {
    const rawDate = o.paymentDate || o.issueDate;
    const dueDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
    const comp = getVibraOrderPaymentCompetence(o);

    if (comp) {
      const existing = monthMap.get(comp) || { totalValue: 0, paidValue: 0, pendingValue: 0, orderCount: 0 };
      existing.totalValue += o.totalValue || 0;
      existing.orderCount += 1;
      if (o.status === 'PAID') {
        existing.paidValue += o.totalValue || 0;
      } else {
        existing.pendingValue += o.totalValue || 0;
      }
      monthMap.set(comp, existing);
    }

    if (o.status !== 'PAID') {
      const dueZero = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
      const diffDays = Math.round((dueZero - todayZero) / msPerDay);
      totalPendingValue += o.totalValue || 0;

      let category: VibraPendingBill['statusCategory'] = 'future';
      if (diffDays < 0) {
        category = 'overdue';
        overdueValue += o.totalValue || 0;
        overdueCount += 1;
      } else if (diffDays === 0) {
        category = 'today';
        todayValue += o.totalValue || 0;
        todayCount += 1;
      } else if (diffDays <= 7) {
        category = 'next_7_days';
        next7DaysValue += o.totalValue || 0;
        next7DaysCount += 1;
      } else if (diffDays <= 30) {
        category = 'next_30_days';
        next30DaysValue += o.totalValue || 0;
        next30DaysCount += 1;
      } else {
        category = 'future';
        futureValue += o.totalValue || 0;
        futureCount += 1;
      }

      pendingBills.push({
        id: o.id,
        order: o,
        dueDate,
        daysRemaining: diffDays,
        statusCategory: category,
      });
    }
  }

  // Sort bills by due date ascending (closest or overdue first)
  pendingBills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // Sort months chronologically
  const sortedMonths = Array.from(monthMap.keys()).sort();
  const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthlyTimeline = sortedMonths.map((m) => {
    const data = monthMap.get(m)!;
    const [, mNum] = m.split('-');
    const label = `${shortMonths[Number(mNum) - 1]}/${m.slice(2, 4)}`;
    return {
      month: m,
      monthLabel: label,
      ...data,
    };
  });

  return {
    totalPendingValue,
    totalPendingCount: pendingBills.length,
    overdueValue,
    overdueCount,
    todayValue,
    todayCount,
    next7DaysValue,
    next7DaysCount,
    next30DaysValue,
    next30DaysCount,
    futureValue,
    futureCount,
    bills: pendingBills,
    monthlyTimeline,
  };
}

export interface VibraAnnualHistoryMonth {
  month: string; // YYYY-MM
  monthLabel: string;
  issuedOrderCount: number;
  issuedTotalLiters: number;
  issuedTotalValue: number;
  issuedAvgUnitPrice: number;
  dueOrderCount: number;
  dueTotalLiters: number;
  dueTotalValue: number;
  duePaidValue: number;
  duePendingValue: number;
  duePaidCount: number;
  duePendingCount: number;
}

export interface VibraAnnualHistory {
  year: number;
  totalIssuedLiters: number;
  totalIssuedValue: number;
  avgIssuedUnitPrice: number;
  totalIssuedOrders: number;
  totalDueValue: number;
  totalPaidValue: number;
  totalPendingValue: number;
  totalDueOrders: number;
  months: VibraAnnualHistoryMonth[];
}

export function calcVibraAnnualHistory(year: number, orders: VibraOrder[]): VibraAnnualHistory {
  const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  let totalIssuedLiters = 0;
  let totalIssuedValue = 0;
  let totalIssuedOrders = 0;
  let totalDueValue = 0;
  let totalPaidValue = 0;
  let totalPendingValue = 0;
  let totalDueOrders = 0;

  const months: VibraAnnualHistoryMonth[] = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const label = shortMonths[i];

    const issued = orders.filter((o) => getVibraOrderIssueCompetence(o) === month);
    const due = orders.filter((o) => getVibraOrderPaymentCompetence(o) === month);

    const issuedOrderCount = issued.length;
    const issuedTotalLiters = issued.reduce((s, o) => s + (o.liters || 0), 0);
    const issuedTotalValue = issued.reduce((s, o) => s + (o.totalValue || 0), 0);
    const issuedAvgUnitPrice = issuedTotalLiters > 0 ? issuedTotalValue / issuedTotalLiters : 0;

    const dueOrderCount = due.length;
    const dueTotalLiters = due.reduce((s, o) => s + (o.liters || 0), 0);
    const dueTotalValue = due.reduce((s, o) => s + (o.totalValue || 0), 0);
    const duePaidValue = due.filter((o) => o.status === 'PAID').reduce((s, o) => s + (o.totalValue || 0), 0);
    const duePendingValue = due.filter((o) => o.status !== 'PAID').reduce((s, o) => s + (o.totalValue || 0), 0);
    const duePaidCount = due.filter((o) => o.status === 'PAID').length;
    const duePendingCount = due.filter((o) => o.status !== 'PAID').length;

    totalIssuedLiters += issuedTotalLiters;
    totalIssuedValue += issuedTotalValue;
    totalIssuedOrders += issuedOrderCount;
    totalDueValue += dueTotalValue;
    totalPaidValue += duePaidValue;
    totalPendingValue += duePendingValue;
    totalDueOrders += dueOrderCount;

    return {
      month,
      monthLabel: label,
      issuedOrderCount,
      issuedTotalLiters,
      issuedTotalValue,
      issuedAvgUnitPrice,
      dueOrderCount,
      dueTotalLiters,
      dueTotalValue,
      duePaidValue,
      duePendingValue,
      duePaidCount,
      duePendingCount,
    };
  });

  const avgIssuedUnitPrice = totalIssuedLiters > 0 ? totalIssuedValue / totalIssuedLiters : 0;

  return {
    year,
    totalIssuedLiters,
    totalIssuedValue,
    avgIssuedUnitPrice,
    totalIssuedOrders,
    totalDueValue,
    totalPaidValue,
    totalPendingValue,
    totalDueOrders,
    months,
  };
}
