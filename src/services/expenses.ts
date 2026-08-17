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
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS, serializeQuerySnapshot } from '@/lib/firebase/firestore';
import { MonthlyExpense, VibraOrder } from '@/lib/types';
import { calcTotalValue } from '@/lib/utils';

// ============================================================
// MONTHLY EXPENSES
// ============================================================
export async function getMonthlyExpenses(competence?: string): Promise<MonthlyExpense[]> {
  const constraints = competence
    ? [where('competence', '==', competence), orderBy('dueDate')]
    : [orderBy('competence', 'desc'), orderBy('dueDate')];
  const q = query(collection(db, COLLECTIONS.MONTHLY_EXPENSES), ...constraints);
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<MonthlyExpense>(snapshot);
}

export async function createMonthlyExpense(
  data: Omit<MonthlyExpense, 'id' | 'createdAt' | 'updatedAt'>,
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
export async function getVibraOrders(competence?: string): Promise<VibraOrder[]> {
  const constraints = competence
    ? [where('competence', '==', competence), orderBy('issueDate')]
    : [orderBy('competence', 'desc'), orderBy('issueDate')];
  const q = query(collection(db, COLLECTIONS.VIBRA_ORDERS), ...constraints);
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<VibraOrder>(snapshot);
}

export async function createVibraOrder(
  data: Omit<VibraOrder, 'id' | 'createdAt' | 'updatedAt' | 'totalValue'> & { liters: number; unitPrice: number },
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
    const q = query(collection(db, COLLECTIONS.VIBRA_ORDERS), where('__name__', '==', id));
    // Recalc
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

// ============================================================
// VIBRA SUMMARY by competence
// ============================================================
export interface VibraSummary {
  competence: string;
  totalLiters: number;
  totalValue: number;
  avgUnitPrice: number;
  orderCount: number;
  avgLitersPerOrder: number;
}

export async function getVibraSummary(competence: string): Promise<VibraSummary> {
  const orders = await getVibraOrders(competence);
  const totalLiters = orders.reduce((s, o) => s + o.liters, 0);
  const totalValue = orders.reduce((s, o) => s + o.totalValue, 0);
  return {
    competence,
    totalLiters,
    totalValue,
    avgUnitPrice: totalLiters > 0 ? totalValue / totalLiters : 0,
    orderCount: orders.length,
    avgLitersPerOrder: orders.length > 0 ? totalLiters / orders.length : 0,
  };
}
