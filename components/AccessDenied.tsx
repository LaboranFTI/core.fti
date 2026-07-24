import React from 'react';
import { ArrowLeft, LockKey, ShieldWarning } from '@phosphor-icons/react';
import { Button } from './ui/button';
import { Role } from '../types';
import { getDefaultRouteForRole } from '../src/app/roles';

interface AccessDeniedProps {
  currentRole?: Role | string;
  onNavigate: (page: string) => void;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ currentRole, onNavigate }) => {
  const defaultRoute = currentRole ? getDefaultRouteForRole(currentRole).replace('/', '') : 'dashboard';

  const getButtonLabel = (route: string) => {
    if (route === 'layanan-tu') return 'Kembali ke Layanan Surat';
    if (route === 'ruangan') return 'Kembali ke Daftar Ruangan';
    return 'Kembali ke Dashboard';
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6 animate-fade-in-up">
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="pointer-events-none absolute inset-y-6 left-0 w-1 rounded-r-full bg-red-600 dark:bg-red-400" />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
          <ShieldWarning className="h-7 w-7" weight="duotone" />
        </div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Kode Akses 403</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Akses Ditolak</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          Anda tidak memiliki izin untuk membuka halaman ini. Halaman ini dibatasi untuk role tertentu.
        </p>
        <div className="mt-5 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          <LockKey className="mr-2 h-4 w-4" weight="bold" />
          Permission required
        </div>
        <div className="mt-7">
          <Button onClick={() => onNavigate(defaultRoute)} variant="primary" size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" weight="bold" />
            {getButtonLabel(defaultRoute)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
