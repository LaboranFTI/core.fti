import React, { useEffect, useState } from 'react';
import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  isDarkMode?: boolean;
}

const Toast: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(18px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(18px); }
        }
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-slide-in { animation: slideIn 0.22s ease-out forwards; }
        .animate-slide-out { animation: slideOut 0.2s ease-in forwards; }
        .animate-progress { animation: progress 5s linear forwards; }
        .toast-item:hover .animate-progress { animation-play-state: paused; }
      `}</style>
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
        ))}
      </div>
    </>
  );
};

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
  info: {
    icon: Info,
    rail: 'bg-fti-blue-600 dark:bg-fti-blue-300',
    iconClass: 'text-fti-blue-600 dark:text-fti-blue-100',
    label: 'Informasi'
  },
  warning: {
    icon: Warning,
    rail: 'bg-amber-500',
    iconClass: 'text-amber-600 dark:text-amber-100',
    label: 'Perhatian'
  }
};

const ToastItem = ({ toast, removeToast }: { toast: ToastMessage; removeToast: (id: string) => void }) => {
  const [isExiting, setIsExiting] = useState(false);
  const tone = toneMap[toast.type];
  const Icon = tone.icon;

  useEffect(() => {
    if (isExiting) {
      const timer = window.setTimeout(() => removeToast(toast.id), 220);
      return () => window.clearTimeout(timer);
    }
  }, [isExiting, removeToast, toast.id]);

  return (
    <div
      className={`toast-item pointer-events-auto relative min-w-75 max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white p-4 pl-5 text-slate-900 shadow-lg shadow-slate-950/10 transition-all duration-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${
        isExiting ? 'animate-slide-out' : 'animate-slide-in'
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} />
      <div className="flex items-start gap-3">
        <Icon size={20} weight="duotone" className={`mt-0.5 shrink-0 ${tone.iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {tone.label}
          </p>
          <p className="mt-1 wrap-break-words text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => setIsExiting(true)}
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-fti-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Tutup notifikasi"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
      {!toast.sticky && (
        <div
          className="absolute bottom-0 left-0 h-0.75 bg-slate-900/30 animate-progress dark:bg-white/30"
          onAnimationEnd={() => setIsExiting(true)}
        />
      )}
    </div>
  );
};

export default Toast;
