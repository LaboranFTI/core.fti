import React from 'react';
import { Prohibit, Warning } from '@phosphor-icons/react';
import { BookingStatus, Room } from '../types';
import { Button } from './ui/button';

const RejectionModal = ({
  isOpen,
  booking,
  rooms,
  rejectionReason,
  setRejectionReason,
  deleteOption,
  setDeleteOption,
  onClose,
  onConfirm
}: any) => {
  if (!isOpen || !booking) return null;

  const getRoomName = (roomId: string) => rooms.find((r: Room) => r.id === roomId)?.name || 'Ruangan Tidak Diketahui';
  const isCancel = booking.status === BookingStatus.APPROVED;

  return (
    <div className="mobile-modal-shell fixed inset-0 z-60 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/20 dark:bg-red-500/10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {isCancel ? <Warning size={22} weight="duotone" /> : <Prohibit size={22} weight="duotone" />}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-200">
                Keputusan Admin
              </p>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                {isCancel ? 'Batalkan Peminjaman' : 'Tolak Peminjaman'}
              </h3>
            </div>
          </div>
        </div>

        <div className="mobile-modal-body space-y-4 p-5 sm:p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Anda akan {isCancel ? 'membatalkan' : 'menolak'} peminjaman ruangan{' '}
            <strong>{getRoomName(booking.roomId)}</strong>. Berikan alasan yang jelas untuk peminjam.
          </p>

          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            rows={4}
            placeholder="Contoh: Ruangan sedang dalam perbaikan atau jadwal bentrok dengan kegiatan fakultas."
            autoFocus
          />

          {isCancel && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Hapus dari Google Calendar</p>
              <div className="space-y-2">
                {(['single', 'thisAndFollowing', 'all'] as const).map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center rounded-lg border p-3 transition ${
                      deleteOption === opt
                        ? 'border-red-400 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteOption"
                      value={opt}
                      checked={deleteOption === opt}
                      onChange={() => setDeleteOption(opt)}
                      className="mr-3 h-4 w-4 accent-red-600 focus:ring-red-500/30"
                    />
                    <span className="text-sm">
                      {opt === 'single' && 'Hapus event ini saja'}
                      {opt === 'thisAndFollowing' && 'Ini dan event selanjutnya'}
                      {opt === 'all' && 'Semua event terkait'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mobile-modal-actions flex justify-end gap-3 pt-2">
            <Button onClick={onClose} variant="secondary">
              Batal
            </Button>
            <Button onClick={onConfirm} variant="destructive">
              Simpan & {isCancel ? 'Batalkan' : 'Tolak'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RejectionModal;
