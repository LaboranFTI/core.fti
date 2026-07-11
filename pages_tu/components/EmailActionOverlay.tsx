import { SpinnerGap as Loader2, EnvelopeSimple as Mail } from '@phosphor-icons/react';
import React from 'react';

interface EmailActionOverlayProps {
  open: boolean;
  title?: string;
  description?: string;
}

export function EmailActionOverlay({
  open,
  title = 'Mengirim surat via email...',
  description = 'Mohon tunggu sebentar. Sistem sedang menyiapkan file PDF dan mengirimkannya ke penerima.'
}: EmailActionOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-6 text-center shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-gray-400">{description}</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
          <Mail className="h-3.5 w-3.5" />
          Pengiriman sedang diproses
        </div>
      </div>
    </div>
  );
}
