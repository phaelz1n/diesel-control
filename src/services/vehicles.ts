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
  QueryConstraint,
} from 'firebase/firestore';
import { db, COLLECTIONS, serializeDoc, serializeQuerySnapshot } from '@/lib/firebase/firestore';
import { Vehicle } from '@/lib/types';
import { normalizePlate } from '@/lib/utils';

// ============================================================
// GET ALL VEHICLES
// ============================================================
export async function getVehicles(activeOnly = false): Promise<Vehicle[]> {
  const constraints: QueryConstraint[] = [orderBy('plate')];
  if (activeOnly) constraints.unshift(where('status', '==', 'active'));

  const q = query(collection(db, COLLECTIONS.VEHICLES), ...constraints);
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<Vehicle>(snapshot);
}

// ============================================================
// GET VEHICLE BY ID
// ============================================================
export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.VEHICLES, id));
  if (!snapshot.exists()) return null;
  return serializeDoc<Vehicle>(snapshot);
}

// ============================================================
// GET VEHICLE BY PLATE
// ============================================================
export async function getVehicleByPlate(plate: string): Promise<Vehicle | null> {
  const normalized = normalizePlate(plate);
  const q = query(
    collection(db, COLLECTIONS.VEHICLES),
    where('plate', '==', normalized)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return serializeDoc<Vehicle>(snapshot.docs[0]);
}

// ============================================================
// CREATE VEHICLE
// ============================================================
export async function createVehicle(
  data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const normalized = normalizePlate(data.plate);

  // Check uniqueness
  const existing = await getVehicleByPlate(normalized);
  if (existing) throw new Error(`Placa ${normalized} já cadastrada.`);

  const docRef = await addDoc(collection(db, COLLECTIONS.VEHICLES), {
    ...data,
    plate: normalized,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// ============================================================
// UPDATE VEHICLE
// ============================================================
export async function updateVehicle(
  id: string,
  data: Partial<Vehicle>,
  userId: string
): Promise<void> {
  if (data.plate) {
    data.plate = normalizePlate(data.plate);
  }
  await updateDoc(doc(db, COLLECTIONS.VEHICLES, id), {
    ...data,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// DELETE VEHICLE
// ============================================================
export async function deleteVehicle(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.VEHICLES, id));
}

// ============================================================
// SEARCH VEHICLES (for autocomplete)
// ============================================================
export async function searchVehicles(term: string): Promise<Vehicle[]> {
  const all = await getVehicles(true);
  const lower = term.toLowerCase();
  return all.filter(
    (v) =>
      v.plate.toLowerCase().includes(lower) ||
      v.prefix.toLowerCase().includes(lower) ||
      v.model.toLowerCase().includes(lower)
  );
}
