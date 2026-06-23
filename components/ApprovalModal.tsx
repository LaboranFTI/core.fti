import React from 'react';
import { CheckCircle, UserGear, X } from '@phosphor-icons/react';
import { Room } from '../types';
import { Button } from './ui/button';

interface LabStaff {
  id: string;
  name: string;
  jabatan: string;
  status: string;
}

const ApprovalModal = ({ isOpen, booking, rooms, staffList, approvalData, setApprovalData, onClose, onConfirm }: any) => {
  if (!isOpen || !booking) return null;

  const getRoomName = (roomId: string) => rooms.find((r: Room) => r.id === roomId)?.name || 'Ruangan Tidak Diketahui';

  return (
    <div className="mobile-modal-shell fixed inset-0 z-60 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle size={22} weight="duotone" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
                Verifikasi
              </p>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Setujui Peminjaman</h3>
            </div>
          </div>
        </div>

        <div className="mobile-modal-body space-y-4 p-5 sm:p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Peminjaman ruangan <strong>{getRoomName(booking.roomId)}</strong> untuk kegiatan{' '}
            <strong>{booking.purpose}</strong> akan disetujui.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <UserGear size={16} weight="duotone" />
              Technical Support
            </h4>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                PIC Laboran / Teknisi
              </label>
              <div className="mb-3 flex flex-wrap gap-2">
                {approvalData.pic.map((picId: string) => {
                  const staff = staffList.find((s: LabStaff) => s.id === picId);
                  return (
                    <span
                      key={picId}
                      className="inline-flex items-center gap-1 rounded-md border border-fti-blue-200 bg-fti-blue-50 px-2 py-1 text-xs font-semibold text-fti-blue-700 dark:border-fti-blue-300/30 dark:bg-fti-blue-500/10 dark:text-fti-blue-200"
                    >
                      {staff?.name}
                      <button
                        type="button"
                        onClick={() =>
                          setApprovalData((prev: any) => ({ ...prev, pic: prev.pic.filter((id: string) => id !== picId) }))
                        }
                        className="rounded text-fti-blue-600 transition hover:text-fti-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fti-blue-500/30 dark:text-fti-blue-200"
                        aria-label={`Hapus ${staff?.name || 'PIC'}`}
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </span>
                  );
                })}
              </div>

              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setApprovalData((prev: any) => ({ ...prev, pic: [...prev.pic, e.target.value] }));
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">+ Tambah PIC</option>
                {staffList
                  .filter((s: LabStaff) => !approvalData.pic.includes(s.id))
                  .map((staff: LabStaff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.jabatan})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="mobile-modal-actions flex justify-end gap-3 pt-2">
            <Button onClick={onClose} variant="secondary">
              Batal
            </Button>
            <Button onClick={onConfirm} variant="primary">
              Simpan & Setuju
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
