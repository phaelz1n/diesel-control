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
import { Station } from '@/lib/types';
import { normalizeText } from '@/lib/utils';

// ============================================================
// GET ALL STATIONS
// ============================================================
export async function getStations(activeOnly = false): Promise<Station[]> {
  const constraints = activeOnly
    ? [where('active', '==', true), orderBy('name')]
    : [orderBy('name')];
  const q = query(collection(db, COLLECTIONS.STATIONS), ...constraints);
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<Station>(snapshot);
}

// ============================================================
// GET STATION BY ID
// ============================================================
export async function getStationById(id: string): Promise<Station | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.STATIONS, id));
  if (!snapshot.exists()) return null;
  return serializeDoc<Station>(snapshot);
}

// ============================================================
// FIND SIMILAR STATIONS (duplicate detection)
// ============================================================
export async function findSimilarStations(name: string): Promise<Station[]> {
  const normalized = normalizeText(name);
  const all = await getStations();
  return all.filter((s) => {
    const sNorm = normalizeText(s.name);
    // Levenshtein distance or simple substring match
    return (
      sNorm.includes(normalized) ||
      normalized.includes(sNorm) ||
      sNorm === normalized
    );
  });
}

// ============================================================
// CREATE STATION
// ============================================================
export async function createStation(
  data: Omit<Station, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.STATIONS), {
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
// UPDATE STATION
// ============================================================
export async function updateStation(
  id: string,
  data: Partial<Station>,
  userId: string
): Promise<void> {
  const updates: Partial<Station> & { normalizedName?: string } = { ...data };
  if (data.name) {
    updates.normalizedName = normalizeText(data.name);
  }
  await updateDoc(doc(db, COLLECTIONS.STATIONS, id), {
    ...updates,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// DELETE STATION
// ============================================================
export async function deleteStation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.STATIONS, id));
}

// ============================================================
// SEARCH STATIONS (for autocomplete)
// ============================================================
export async function searchStations(term: string): Promise<Station[]> {
  const all = await getStations(true);
  const lower = normalizeText(term);
  return all.filter(
    (s) =>
      normalizeText(s.name).includes(lower) ||
      normalizeText(s.city).includes(lower)
  );
}
