import React, { useEffect, useState } from 'react';
import { CalendarBlank, FloppyDisk, Package, SpinnerGap, X } from '@phosphor-icons/react';
import { Software } from '../types';
import { Button } from './ui/button';

interface SoftwareFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Software>) => void;
  initialData: Partial<Software> | null;
  isSaving: boolean;
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fti-blue-600 focus:ring-2 focus:ring-fti-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-fti-blue-300 dark:focus:ring-fti-blue-300/20';

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400';

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
    <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/30 dark:bg-fti-blue-500/10 dark:text-fti-blue-100">
                <Package size={22} weight="duotone" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Lisensi & Software
                </p>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  {initialData?.id ? 'Edit Software' : 'Tambah Software'}
                </h3>
              </div>
            </div>
            <Button type="button" onClick={onClose} variant="ghost" size="icon-sm" aria-label="Tutup formulir">
              <X size={19} weight="bold" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mobile-modal-body space-y-4 p-5 sm:p-6">
          <div>
            <label className={labelClass}>Nama Software</label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={fieldClass}
              placeholder="Microsoft Office"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Versi</label>
              <input
                type="text"
                value={formData.version || ''}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className={fieldClass}
                placeholder="2021"
              />
            </div>
            <div>
              <label className={labelClass}>Kategori</label>
              <select
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={fieldClass}
              >
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
            <label className={labelClass}>Tipe Lisensi</label>
            <select
              value={formData.licenseType || 'Free'}
              onChange={(e) => setFormData({ ...formData, licenseType: e.target.value as any })}
              className={fieldClass}
            >
              <option value="Free">Free</option>
              <option value="Commercial">Commercial</option>
              <option value="Open Source">Open Source</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Vendor</label>
              <input
                type="text"
                value={formData.vendor || ''}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className={fieldClass}
                placeholder="Microsoft"
              />
            </div>
            <div>
              <label className={labelClass}>Tanggal Install</label>
              <div className="relative">
                <CalendarBlank
                  size={17}
                  weight="duotone"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="date"
                  value={formData.installDate || ''}
                  onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Catatan</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className={`${fieldClass} min-h-20 resize-y`}
              rows={3}
              placeholder="Catatan opsional..."
            />
          </div>

          <div className="mobile-modal-actions flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" onClick={onClose} variant="secondary">
              Batal
            </Button>
            <Button type="submit" disabled={isSaving} variant="primary">
              {isSaving ? (
                <SpinnerGap size={17} weight="bold" className="mr-2 animate-spin" />
              ) : (
                <FloppyDisk size={17} weight="bold" className="mr-2" />
              )}
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SoftwareForm;
