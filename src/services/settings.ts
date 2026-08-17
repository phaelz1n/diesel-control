import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase/firestore';
import { AppSettings, FuelType, VehicleType } from '@/lib/types';

const SETTINGS_DOC_ID = 'general';

const DEFAULT_SETTINGS: Omit<AppSettings, 'id' | 'updatedAt' | 'updatedBy'> = {
  alertThresholds: {
    minAvgKmL: 1.5,
    maxAvgKmL: 5.0,
    maxUnitPrice: 7.5,
    maxLitersPerRefuel: 800,
    minIntervalHours: 4,
  },
  fuelTypes: ['Diesel S10', 'Diesel S500', 'Gasolina', 'Etanol', 'GNV', 'Elétrico'] as FuelType[],
  vehicleTypes: ['Micro-ônibus', 'Ônibus', 'Van', 'Caminhão', 'Utilitário', 'Automóvel'] as VehicleType[],
};

// ============================================================
// GET SETTINGS
// ============================================================
export async function getSettings(): Promise<AppSettings> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID));
  
  if (!snapshot.exists()) {
    // Return default settings if none exist yet
    return {
      id: SETTINGS_DOC_ID,
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
      updatedBy: 'system',
    };
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    alertThresholds: data.alertThresholds ?? DEFAULT_SETTINGS.alertThresholds,
    fuelTypes: data.fuelTypes ?? DEFAULT_SETTINGS.fuelTypes,
    vehicleTypes: data.vehicleTypes ?? DEFAULT_SETTINGS.vehicleTypes,
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
    updatedBy: data.updatedBy ?? 'system',
  };
}

// ============================================================
// UPDATE SETTINGS
// ============================================================
export async function updateSettings(
  data: Partial<AppSettings>,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
  
  // Clean payload
  const updatePayload: Record<string, unknown> = {
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  };

  if (data.alertThresholds) updatePayload.alertThresholds = data.alertThresholds;
  if (data.fuelTypes) updatePayload.fuelTypes = data.fuelTypes;
  if (data.vehicleTypes) updatePayload.vehicleTypes = data.vehicleTypes;

  await setDoc(docRef, updatePayload, { merge: true });
}
