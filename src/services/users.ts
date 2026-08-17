import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { db, COLLECTIONS, serializeQuerySnapshot, serializeDoc } from '@/lib/firebase/firestore';
import { AppUser, UserRole } from '@/lib/types';

// ============================================================
// GET ALL USERS
// ============================================================
export async function getUsers(): Promise<AppUser[]> {
  const q = query(collection(db, COLLECTIONS.USERS), orderBy('name'));
  const snapshot = await getDocs(q);
  return serializeQuerySnapshot<AppUser>(snapshot);
}

// ============================================================
// GET USER BY ID
// ============================================================
export async function getUserById(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snapshot.exists()) return null;
  return serializeDoc<AppUser>(snapshot);
}

// ============================================================
// CREATE USER (Admin creates user with email + temporary password)
// ============================================================
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole,
  adminUid: string
): Promise<string> {
  const auth = getAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    uid,
    name,
    email,
    role,
    active: true,
    createdBy: adminUid,
    updatedBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return uid;
}

// ============================================================
// UPDATE USER
// ============================================================
export async function updateUser(
  uid: string,
  data: Partial<Pick<AppUser, 'name' | 'role' | 'active' | 'phone'>>,
  adminUid: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    ...data,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// TOGGLE USER ACTIVE STATUS
// ============================================================
export async function toggleUserActive(
  uid: string,
  active: boolean,
  adminUid: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    active,
    updatedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// RESET USER PASSWORD
// ============================================================
export async function resetUserPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getAuth(), email);
}
