// Re-export db so services can import from a single firebase module
export { db } from './config';

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
  writeBatch,
  QuerySnapshot,
} from 'firebase/firestore';
import { db as _db } from './config';
const db = _db;

// ============================================================
// COLLECTIONS
// ============================================================
export const COLLECTIONS = {
  USERS: 'users',
  BRANCHES: 'branches',
  VEHICLES: 'vehicles',
  STATIONS: 'stations',
  REFUELS: 'refuels',
  MONTHLY_EXPENSES: 'monthlyExpenses',
  VIBRA_ORDERS: 'vibraOrders',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings',
  ALERTS: 'alerts',
} as const;

// ============================================================
// HELPERS
// ============================================================
export function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

export function serializeDoc<T>(
  snapshot: DocumentSnapshot | QueryDocumentSnapshot
): T {
  const data = snapshot.data();
  if (!data) throw new Error('Document not found');

  const serialized: Record<string, unknown> = { id: snapshot.id };

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      serialized[key] = value.toDate();
    } else {
      serialized[key] = value;
    }
  }

  return serialized as T;
}

export function serializeQuerySnapshot<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map((doc) => serializeDoc<T>(doc));
}

// ============================================================
// GENERIC CRUD
// ============================================================

export async function createDocument<T extends { id?: string }>(
  collectionName: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateDocument<T>(
  collectionName: string,
  docId: string,
  data: Partial<T>,
  userId: string
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  } as Record<string, unknown>);
}

export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  await deleteDoc(doc(db, collectionName, docId));
}

export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const snapshot = await getDoc(doc(db, collectionName, docId));
  if (!snapshot.exists()) return null;
  return serializeDoc<T>(snapshot);
}

export async function queryDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<T>(snapshot);
}

// ============================================================
// BATCH WRITE
// ============================================================
export async function batchCreate<T>(
  collectionName: string,
  items: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[],
  userId: string
): Promise<number> {
  const batchSize = 500; // Firestore limit is 500 per batch
  let totalCreated = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(collection(db, collectionName));
      batch.set(docRef, {
        ...item,
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    totalCreated += chunk.length;
  }

  return totalCreated;
}

// Re-export Firestore query helpers for use in services
export { where, orderBy, limit, startAfter, query, collection, doc, serverTimestamp };
