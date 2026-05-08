import React, { useState, useEffect } from 'react';
import { Software } from '../types';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface SoftwareFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Software>) => void;
  initialData: Partial<Software> | null;
  isSaving: boolean;
}

const SoftwareForm: React.FC<SoftwareFormProps> = ({ isOpen, onClose, onSave, initialData, isSaving }) => {
  const [formData, setFormData] = useState<Partial<Software>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ name: '', version: '', licenseType: 'Free', category: '' });
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {initialData?.id ? 'Edit Software' : 'Tambah Software'}
          </h3>
          <Button type="button" onClick={onClose} variant="ghost" size="icon-sm" aria-label="Tutup formulir">
            <X className="w-5 h-5 text-gray-500" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="mobile-modal-body p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Software</label>
            <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Microsoft Office"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Versi</label>
              <input type="text" value={formData.version || ''} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="2021"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
              <select value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <option value="">-- Pilih --</option>
                <option value="Operating System">Operating System</option>
                <option value="Office">Office</option>
                <option value="Development Tool">Development Tool</option>
                <option value="Antivirus">Antivirus</option>
                <option value="Design">Design</option>
                <option value="Multimedia">Multimedia</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Lisensi</label>
            <select value={formData.licenseType || 'Free'} onChange={e => setFormData({...formData, licenseType: e.target.value as any})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="Free">Free</option>
              <option value="Commercial">Commercial</option>
              <option value="Open Source">Open Source</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
              <input type="text" value={formData.vendor || ''} onChange={e => setFormData({...formData, vendor: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Microsoft"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Install</label>
              <input type="date" value={formData.installDate || ''} onChange={e => setFormData({...formData, installDate: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <textarea value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={2} placeholder="Catatan opsional..."/>
          </div>
          <div className="mobile-modal-actions flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" onClick={onClose} variant="secondary">Batal</Button>
            <Button type="submit" disabled={isSaving} variant="primary">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SoftwareForm;
