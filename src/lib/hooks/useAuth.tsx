'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile, signIn, signOutUser } from '@/lib/firebase/auth';
import { AppUser } from '@/lib/types';

// ============================================================
// CONTEXT TYPES
// ============================================================
interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ============================================================
// CONTEXT
// ============================================================
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userProfile = await getUserProfile(firebaseUser.uid);
          setProfile(userProfile);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    // Auth state change will trigger the effect above
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
