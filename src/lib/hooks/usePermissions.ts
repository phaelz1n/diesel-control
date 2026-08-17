'use client';

import { useAuth } from './useAuth';
import { UserRole } from '@/lib/types';

export function usePermissions() {
  const { profile } = useAuth();

  const role = profile?.role ?? 'viewer';
  const isActive = profile?.active ?? false;

  const isAdmin = isActive && role === 'admin';
  const isOperational = isActive && (role === 'admin' || role === 'operational');
  const isViewer = isActive && (role === 'admin' || role === 'operational' || role === 'viewer');

  function hasRole(requiredRole: UserRole): boolean {
    if (!isActive) return false;
    if (requiredRole === 'viewer') return isViewer;
    if (requiredRole === 'operational') return isOperational;
    if (requiredRole === 'admin') return isAdmin;
    return false;
  }

  return {
    role,
    isAdmin,
    isOperational,
    isViewer,
    isActive,
    hasRole,
    // Specific permissions
    canCreate: isOperational,
    canEdit: isOperational,
    canDelete: isAdmin,
    canViewAdmin: isAdmin,
    canViewLogs: isAdmin,
    canManageUsers: isAdmin,
    canImport: isAdmin,
    canExport: isOperational,
    canViewAlerts: isOperational,
    canResolveAlerts: isOperational,
    canManageSettings: isAdmin,
  };
}
