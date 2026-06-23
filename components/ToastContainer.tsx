import React, { useEffect } from 'react';
import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  sticky?: boolean;
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const toneMap = {
  success: {
    icon: CheckCircle,
    rail: 'bg-emerald-500',
    iconClass: 'text-emerald-600 dark:text-emerald-200',
    label: 'Berhasil'
  },
  error: {
    icon: WarningCircle,
    rail: 'bg-red-600 dark:bg-red-400',
    iconClass: 'text-red-600 dark:text-red-200',
    label: 'Gagal'
  },
  warning: {
    icon: Warning,
    rail: 'bg-amber-500',
    iconClass: 'text-amber-600 dark:text-amber-100',
    label: 'Perhatian'
  },
  info: {
    icon: Info,
    rail: 'bg-fti-blue-600 dark:bg-fti-blue-300',
    iconClass: 'text-fti-blue-600 dark:text-fti-blue-100',
    label: 'Informasi'
  }
};

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  useEffect(() => {
    const timers = toasts
      .filter((toast) => !toast.sticky)
      .map((toast) => window.setTimeout(() => removeToast(toast.id), toast.duration || 5000));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [removeToast, toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-3 top-16 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => {
        const tone = toneMap[toast.type];
        const Icon = tone.icon;

        return (
          <div
            key={toast.id}
            className="relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 pl-5 text-slate-900 shadow-lg shadow-slate-950/10 animate-in slide-in-from-top-4 fade-in dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-w-sm"
          >
            <div className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} />
            <Icon size={20} weight="duotone" className={`mt-0.5 shrink-0 ${tone.iconClass}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                {tone.label}
              </p>
              <p className="mt-1 wrap-break-words text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">
                {toast.message}
              </p>
            </div>
            {!toast.sticky && (
              <button
                onClick={() => removeToast(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Tutup notifikasi"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
