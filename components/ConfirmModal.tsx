import React from 'react';
import { SpinnerGap, WarningDiamond, X } from '@phosphor-icons/react';
import { Button } from './ui/button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

const toneMap = {
  danger: {
    rail: 'bg-red-600 dark:bg-red-400',
    header: 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10',
    icon: 'border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
    label: 'text-red-700 dark:text-red-200',
    variant: 'destructive' as const
  },
  warning: {
    rail: 'bg-amber-500',
    header: 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10',
    icon: 'border-amber-200 bg-white text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
    label: 'text-amber-700 dark:text-amber-100',
    variant: 'primary' as const
  },
  info: {
    rail: 'bg-fti-blue-600 dark:bg-fti-blue-300',
    header: 'border-fti-blue-200 bg-fti-blue-50 dark:border-fti-blue-300/20 dark:bg-fti-blue-500/10',
    icon: 'border-fti-blue-200 bg-white text-fti-blue-700 dark:border-fti-blue-300/30 dark:bg-fti-blue-500/10 dark:text-fti-blue-100',
    label: 'text-fti-blue-700 dark:text-fti-blue-100',
    variant: 'primary' as const
  }
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'danger',
  isLoading = false
}) => {
  if (!isOpen) return null;

  const tone = toneMap[type];

  return (
    <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
        <div className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} />
        <div className={`border-b px-5 py-4 ${tone.header}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tone.icon}`}>
                <WarningDiamond size={22} weight="duotone" />
              </span>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${tone.label}`}>
                  Keputusan Sistem
                </p>
                {title && <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md p-1 text-slate-500 transition hover:bg-white/70 hover:text-slate-800 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Tutup konfirmasi"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        <div className="mobile-modal-body p-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
          <div className="mobile-modal-actions mt-6 flex justify-end gap-3">
            <Button onClick={onClose} disabled={isLoading} variant="secondary">
              {cancelText}
            </Button>
            <Button onClick={onConfirm} disabled={isLoading} variant={tone.variant} className="min-w-32">
              {isLoading && <SpinnerGap size={17} weight="bold" className="mr-2 animate-spin" />}
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
