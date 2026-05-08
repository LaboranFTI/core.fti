import React, { useState, useEffect } from 'react';
import { RoomComputer } from '../types';
import { X, Save, Loader2, Cpu, HardDrive, Monitor, Keyboard, Mouse } from 'lucide-react';
import { Button } from './ui/button';

interface ComputerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<RoomComputer>) => void;
  initialData: Partial<RoomComputer> | null;
  isSaving: boolean;
}

const ComputerForm: React.FC<ComputerFormProps> = ({ isOpen, onClose, onSave, initialData, isSaving }) => {
  const [formData, setFormData] = useState<Partial<RoomComputer>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ pcNumber: '', cpu: '', gpuType: 'Integrated', gpuModel: '', vram: '', ram: '', storage: '', os: '', keyboard: '', mouse: '', monitor: '', condition: 'Baik' });
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {initialData?.id ? 'Edit Komputer' : 'Tambah Komputer'}
          </h3>
          <Button type="button" onClick={onClose} variant="ghost" size="icon-sm" aria-label="Tutup formulir">
            <X className="w-5 h-5 text-gray-500" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="mobile-modal-body p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor PC</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">#</span>
              <input type="text" required value={formData.pcNumber || ''} onChange={e => setFormData({...formData, pcNumber: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="PC-01"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">OS</label>
            <input type="text" value={formData.os || ''} onChange={e => setFormData({...formData, os: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Windows 11 Pro"/>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">CPU</label>
            <div className="relative">
              <Cpu className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" required value={formData.cpu || ''} onChange={e => setFormData({...formData, cpu: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Intel Core i7-12700"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe GPU</label>
            <select value={formData.gpuType || 'Integrated'} onChange={e => setFormData({...formData, gpuType: e.target.value as any})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="Integrated">Integrated</option>
              <option value="Dedicated">Dedicated (Card)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Model GPU</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px] border border-gray-400 rounded-sm px-0.5">G</span>
              <input type="text" value={formData.gpuModel || ''} onChange={e => setFormData({...formData, gpuModel: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="NVIDIA RTX 3060"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">VRAM</label>
            <input type="text" value={formData.vram || ''} onChange={e => setFormData({...formData, vram: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="12 GB"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">RAM</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px] border border-gray-400 rounded-sm px-0.5">R</span>
              <input type="text" value={formData.ram || ''} onChange={e => setFormData({...formData, ram: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="16 GB DDR4"/>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Storage</label>
            <div className="relative">
              <HardDrive className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={formData.storage || ''} onChange={e => setFormData({...formData, storage: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="SSD NVMe 512GB"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Monitor</label>
            <div className="relative">
              <Monitor className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={formData.monitor || ''} onChange={e => setFormData({...formData, monitor: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Dell 24 inch"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Keyboard</label>
            <div className="relative">
              <Keyboard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={formData.keyboard || ''} onChange={e => setFormData({...formData, keyboard: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mouse</label>
            <div className="relative">
              <Mouse className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={formData.mouse || ''} onChange={e => setFormData({...formData, mouse: e.target.value})} className="w-full pl-9 pr-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kondisi</label>
            <select value={formData.condition || 'Baik'} onChange={e => setFormData({...formData, condition: e.target.value as any})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
            </select>
          </div>
          <div className="mobile-modal-actions col-span-1 sm:col-span-2 flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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

export default ComputerForm;
