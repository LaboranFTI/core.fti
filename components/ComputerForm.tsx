import React, { useEffect, useState } from 'react';
import {
  Cpu,
  FloppyDisk,
  HardDrive,
  Keyboard,
  Monitor,
  Mouse,
  SpinnerGap,
  X
} from '@phosphor-icons/react';
import { RoomComputer } from '../types';
import { Button } from './ui/button';

interface ComputerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<RoomComputer>) => void;
  initialData: Partial<RoomComputer> | null;
  isSaving: boolean;
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fti-blue-600 focus:ring-2 focus:ring-fti-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-fti-blue-300 dark:focus:ring-fti-blue-300/20';

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400';

const ComputerForm: React.FC<ComputerFormProps> = ({ isOpen, onClose, onSave, initialData, isSaving }) => {
  const [formData, setFormData] = useState<Partial<RoomComputer>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        pcNumber: '',
        cpu: '',
        gpuType: 'Integrated',
        gpuModel: '',
        vram: '',
        ram: '',
        storage: '',
        os: '',
        keyboard: '',
        mouse: '',
        monitor: '',
        condition: 'Baik'
      });
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/30 dark:bg-fti-blue-500/10 dark:text-fti-blue-100">
                <Cpu size={22} weight="duotone" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Spesifikasi Lab
                </p>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  {initialData?.id ? 'Edit Komputer' : 'Tambah Komputer'}
                </h3>
              </div>
            </div>
            <Button type="button" onClick={onClose} variant="ghost" size="icon-sm" aria-label="Tutup formulir">
              <X size={19} weight="bold" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mobile-modal-body grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <label className={labelClass}>Nomor PC</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-slate-400">
                #
              </span>
              <input
                type="text"
                required
                value={formData.pcNumber || ''}
                onChange={(e) => setFormData({ ...formData, pcNumber: e.target.value })}
                className={`${fieldClass} pl-9`}
                placeholder="PC-01"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>OS</label>
            <input
              type="text"
              value={formData.os || ''}
              onChange={(e) => setFormData({ ...formData, os: e.target.value })}
              className={fieldClass}
              placeholder="Windows 11 Pro"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>CPU</label>
            <div className="relative">
              <Cpu size={17} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={formData.cpu || ''}
                onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                className={`${fieldClass} pl-9`}
                placeholder="Intel Core i7-12700"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Tipe GPU</label>
            <select
              value={formData.gpuType || 'Integrated'}
              onChange={(e) => setFormData({ ...formData, gpuType: e.target.value as any })}
              className={fieldClass}
            >
              <option value="Integrated">Integrated</option>
              <option value="Dedicated">Dedicated (Card)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Model GPU</label>
            <input
              type="text"
              value={formData.gpuModel || ''}
              onChange={(e) => setFormData({ ...formData, gpuModel: e.target.value })}
              className={fieldClass}
              placeholder="NVIDIA RTX 3060"
            />
          </div>

          <div>
            <label className={labelClass}>VRAM</label>
            <input
              type="text"
              value={formData.vram || ''}
              onChange={(e) => setFormData({ ...formData, vram: e.target.value })}
              className={fieldClass}
              placeholder="12 GB"
            />
          </div>

          <div>
            <label className={labelClass}>RAM</label>
            <input
              type="text"
              value={formData.ram || ''}
              onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
              className={fieldClass}
              placeholder="16 GB DDR4"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Storage</label>
            <div className="relative">
              <HardDrive size={17} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.storage || ''}
                onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                className={`${fieldClass} pl-9`}
                placeholder="SSD NVMe 512GB"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Monitor</label>
            <div className="relative">
              <Monitor size={17} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.monitor || ''}
                onChange={(e) => setFormData({ ...formData, monitor: e.target.value })}
                className={`${fieldClass} pl-9`}
                placeholder="Dell 24 inch"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Keyboard</label>
            <div className="relative">
              <Keyboard size={17} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.keyboard || ''}
                onChange={(e) => setFormData({ ...formData, keyboard: e.target.value })}
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Mouse</label>
            <div className="relative">
              <Mouse size={17} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.mouse || ''}
                onChange={(e) => setFormData({ ...formData, mouse: e.target.value })}
                className={`${fieldClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Kondisi</label>
            <select
              value={formData.condition || 'Baik'}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
              className={fieldClass}
            >
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
            </select>
          </div>

          <div className="mobile-modal-actions col-span-1 mt-4 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:col-span-2">
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

export default ComputerForm;
