// f:\Silab FTI\silab.2\components\ProtectedRoute.tsx
import React from 'react';
import { Role } from '../types';
import AccessDenied from './AccessDenied';

interface ProtectedRouteProps {
  currentRole: Role;
  allowedRoles: Role[];
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  currentRole, 
  allowedRoles, 
  onNavigate, 
  children 
}) => {
  // Cek apakah role user saat ini ada di dalam daftar role yang diizinkan (Case Insensitive)
  const hasAccess = allowedRoles.some(r => r.toString().toUpperCase() === currentRole.toString().toUpperCase());

  if (!hasAccess) {
    // Jika tidak diizinkan, render halaman Access Denied
    return <AccessDenied currentRole={currentRole} onNavigate={onNavigate} />;
  }

  // Jika diizinkan, render halaman yang diminta
  return <>{children}</>;
};

export default ProtectedRoute;
