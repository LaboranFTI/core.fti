import React from 'react';
import { SpinnerGap, Trash, WarningCircle } from '@phosphor-icons/react';
import { BookingStatus, Room } from '../types';
import { formatDateID } from '../src/utils/formatters';
import { Button } from './ui/button';

const DeleteBookingModal = ({
  isOpen,
  booking,
  rooms,
  isDeleting,
  onClose,
  onConfirm
}: any) => {
  if (!isOpen || !booking) return null;

  const getRoomName = (roomId: string) => rooms.find((r: Room) => r.id === roomId)?.name || 'Ruangan Tidak Diketahui';

  const detailRows = [
    ['Peminjam', booking.userName],
    ['Ruangan', getRoomName(booking.roomId)],
    ['Tanggal', formatDateID(booking.date)],
    ['Keperluan', booking.purpose]
  ];

  return (
    <div className="mobile-modal-shell fixed inset-0 z-80 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/20 dark:bg-red-500/10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <Trash size={22} weight="duotone" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-200">
                Penghapusan Data
              </p>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Hapus Data Peminjaman</h3>
            </div>
          </div>
        </div>

        <div className="mobile-modal-body space-y-4 p-5 sm:p-6">
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium">Tindakan ini tidak dapat dibatalkan.</p>
          </div>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Data peminjaman berikut akan dihapus secara permanen dari sistem.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <dl className="space-y-3">
              {detailRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[92px_1fr] gap-3 text-sm">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {label}
                  </dt>
                  <dd className="font-medium text-slate-950 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {booking.status === BookingStatus.APPROVED && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
              Jadwal terkait di CORE Calendar akan ikut dihapus otomatis oleh sistem.
            </div>
          )}

          <div className="mobile-modal-actions flex justify-end gap-3 pt-2">
            <Button onClick={onClose} variant="secondary">
              Batal
            </Button>
            <Button onClick={onConfirm} disabled={isDeleting} variant="destructive">
              {isDeleting ? (
                <SpinnerGap size={17} weight="bold" className="mr-2 animate-spin" />
              ) : (
                <Trash size={17} weight="bold" className="mr-2" />
              )}
              Hapus Permanen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteBookingModal;
