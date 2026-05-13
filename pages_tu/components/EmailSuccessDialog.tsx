import React from 'react';
import { CheckCircle2, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface EmailSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  recipientEmail?: string;
  letterNumber?: string | null;
  title?: string;
  description?: string;
}

export function EmailSuccessDialog({
  open,
  onClose,
  recipientEmail,
  letterNumber,
  title = 'Email berhasil terkirim',
  description = 'Surat sudah berhasil diproses dan dikirim ke alamat email tujuan.'
}: EmailSuccessDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-[28px] border border-white/15 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-gray-400">{description}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-200">
            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Tujuan pengiriman
          </div>
          <p className="break-all text-sm text-slate-600 dark:text-gray-400">{recipientEmail || '-'}</p>
          {letterNumber ? (
            <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
              Nomor surat: <span className="font-semibold text-slate-900 dark:text-white">{letterNumber}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Jika email belum muncul di inbox, silakan cek folder spam atau junk.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} className="min-w-32">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
