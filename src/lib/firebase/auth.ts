import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { AppUser } from '@/lib/types';

// ============================================================
// SIGN IN
// ============================================================
export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  
  // Atualiza lastLogin
  await updateDoc(doc(db, 'users', credential.user.uid), {
    lastLogin: serverTimestamp(),
  }).catch(() => {
    // Usuário pode não ter documento ainda — ignora
  });

  return credential.user;
}

// ============================================================
// SIGN OUT
// ============================================================
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// ============================================================
// GET USER PROFILE
// ============================================================
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const docRef = doc(db, 'users', uid);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  const data = snapshot.data();
  return {
    id: snapshot.id,
    uid: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    lastLogin: data.lastLogin?.toDate?.() ?? undefined,
  } as AppUser;
}

// ============================================================
// CREATE USER PROFILE (chamado após criar auth user)
// ============================================================
export async function createUserProfile(
  uid: string,
  data: Omit<AppUser, 'id' | 'uid' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// PASSWORD RESET
// ============================================================
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function changePassword(newPassword: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Usuário não autenticado');
  await updatePassword(auth.currentUser, newPassword);
}

// ============================================================
// AUTH STATE OBSERVER
// ============================================================
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
