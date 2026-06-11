import React from 'react';
import { Room } from '../types';
import { CheckCircle, Wrench, X } from 'lucide-react';
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
    <div className="mobile-modal-shell fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <h3 className="font-bold text-green-800 dark:text-green-400 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" /> Setuju Peminjaman
          </h3>
        </div>
        <div className="mobile-modal-body p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Anda akan menyetujui peminjaman ruangan <strong>{getRoomName(booking.roomId)}</strong> untuk kegiatan <strong>{booking.purpose}</strong>.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center"><Wrench className="w-3 h-3 mr-1" /> Data Technical Support (Opsional)</h4>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">PIC Laboran / Teknisi</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {approvalData.pic.map((picId: string) => {
                  const staff = staffList.find((s: LabStaff) => s.id === picId);
                  return (
                    <span key={picId} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {staff?.name}
                      <button type="button" onClick={() => setApprovalData((prev: any) => ({ ...prev, pic: prev.pic.filter((id: string) => id !== picId) }))} className="ml-1 rounded-full text-blue-600 transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <select
                value=""
                onChange={e => { if (e.target.value) setApprovalData((prev: any) => ({ ...prev, pic: [...prev.pic, e.target.value] })) }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="">+ Tambah PIC</option>
                {staffList.filter((s: LabStaff) => !approvalData.pic.includes(s.id)).map((staff: LabStaff) => (
                  <option key={staff.id} value={staff.id}>{staff.name} ({staff.jabatan})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mobile-modal-actions flex justify-end gap-3 pt-2">
            <Button onClick={onClose} variant="secondary">Batal</Button>
            <Button onClick={onConfirm} variant="primary">Simpan & Setuju</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
