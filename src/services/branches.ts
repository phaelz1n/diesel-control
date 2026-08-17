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
} from 'firebase/firestore';
import { db, COLLECTIONS, serializeDoc, serializeQuerySnapshot } from '@/lib/firebase/firestore';
import { Branch } from '@/lib/types';
import { normalizeText } from '@/lib/utils';

// ============================================================
// GET ALL BRANCHES
// ============================================================
export async function getBranches(activeOnly = false): Promise<Branch[]> {
  const constraints = activeOnly
    ? [where('active', '==', true), orderBy('name')]
    : [orderBy('name')];
  const q = query(collection(db, COLLECTIONS.BRANCHES), ...constraints);
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<Branch>(snapshot);
}

// ============================================================
// GET BRANCH BY ID
// ============================================================
export async function getBranchById(id: string): Promise<Branch | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.BRANCHES, id));
  if (!snapshot.exists()) return null;
  return serializeDoc<Branch>(snapshot);
}

// ============================================================
// CREATE BRANCH
// ============================================================
export async function createBranch(
  data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'normalizedName' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.BRANCHES), {
    ...data,
    normalizedName: normalizeText(data.name),
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ============================================================
// UPDATE BRANCH
// ============================================================
export async function updateBranch(
  id: string,
  data: Partial<Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'normalizedName' | 'createdBy' | 'updatedBy'>>,
  userId: string
): Promise<void> {
  const updates: Record<string, unknown> = { ...data };
  if (data.name) {
    updates.normalizedName = normalizeText(data.name);
  }
  await updateDoc(doc(db, COLLECTIONS.BRANCHES, id), {
    ...updates,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// DELETE BRANCH
// ============================================================
export async function deleteBranch(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.BRANCHES, id));
}

// ============================================================
// SEARCH BRANCHES (for autocomplete)
// ============================================================
export async function searchBranches(term: string): Promise<Branch[]> {
  const all = await getBranches(true);
  const lower = normalizeText(term);
  return all.filter(
    (b) =>
      normalizeText(b.name).includes(lower) ||
      normalizeText(b.city).includes(lower)
  );
}
