import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase/firestore';
import { createAuditLog } from './audit';

export async function wipeDatabase(adminUid: string, adminEmail: string, adminName: string): Promise<void> {
  const collectionsToWipe = [
    COLLECTIONS.BRANCHES,
    COLLECTIONS.VEHICLES,
    COLLECTIONS.STATIONS,
    COLLECTIONS.REFUELS,
    COLLECTIONS.MONTHLY_EXPENSES,
    COLLECTIONS.VIBRA_ORDERS,
    COLLECTIONS.ALERTS,
  ];

  for (const collName of collectionsToWipe) {
    const collRef = collection(db, collName);
    const snapshot = await getDocs(collRef);
    
    let batch = writeBatch(db);
    let count = 0;
    
    for (const document of snapshot.docs) {
      batch.delete(doc(db, collName, document.id));
      count++;
      
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
  }

  // Create an audit log about this extreme action
  await createAuditLog(
    adminUid,
    adminEmail,
    adminName,
    'DELETE',
    'settings',
    'wipe',
    `${adminName} executou uma limpeza total no banco de dados (Wipe Database).`
  );
}
