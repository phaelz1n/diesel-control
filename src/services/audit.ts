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
import { AuditLog, AuditAction, AuditEntityType } from '@/lib/types';

// ============================================================
// CREATE AUDIT LOG
// ============================================================
export async function createAuditLog(
  userId: string,
  userEmail: string,
  userName: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  description: string,
  options?: {
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      userId,
      userEmail,
      userName,
      action,
      entityType,
      entityId,
      description,
      previousValues: options?.previousValues ?? null,
      newValues: options?.newValues ?? null,
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (err) {
    // Log errors should NOT break the main flow
    console.error('Failed to write audit log:', err);
  }
}

// ============================================================
// GET AUDIT LOGS (with filters)
// ============================================================
export interface AuditFilters {
  userId?: string;
  entityType?: AuditEntityType;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
}

export async function getAuditLogs(
  filters: AuditFilters = {},
  maxResults = 200
): Promise<AuditLog[]> {
  const constraints = [];

  if (filters.userId) constraints.push(where('userId', '==', filters.userId));
  if (filters.entityType) constraints.push(where('entityType', '==', filters.entityType));
  if (filters.action) constraints.push(where('action', '==', filters.action));
  if (filters.startDate) constraints.push(where('timestamp', '>=', filters.startDate));
  if (filters.endDate) constraints.push(where('timestamp', '<=', filters.endDate));

  constraints.push(orderBy('timestamp', 'desc'));

  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), ...constraints);
  const snapshot = await getDocs(q);
  const logs = serializeQuerySnapshot<AuditLog>(snapshot);
  return logs.slice(0, maxResults);
}
