import { Check, CaretLeft as ChevronLeft, SpinnerGap as Loader2, UploadSimple as Upload } from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';
import { Room } from '../types';
import SearchableSelect, { SelectOption } from './SearchableSelect';
import { Button, buttonVariants } from './ui/button';
import { cn } from '../lib/utils';

interface RoomFormProps {
  initialData: Partial<Room>;
  isEditing: boolean;
  onSave: (formData: Partial<Room>) => void;
  onCancel: () => void;
  staffList: { id: string; name: string; jabatan: string }[];
  availableFacilities: string[];
  isSaving?: boolean;
}

const RoomForm: React.FC<RoomFormProps> = ({ initialData, isEditing, onSave, onCancel, staffList, availableFacilities, isSaving = false }) => {
  const [formData, setFormData] = useState(initialData);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [newFacilityInput, setNewFacilityInput] = useState('');
  const [currentFacilities, setCurrentFacilities] = useState(availableFacilities);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsImageProcessing(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFormData(prev => ({ ...prev, image: result, imageChanged: true } as any));
        setIsImageProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNewFacility = () => {
    const newFac = newFacilityInput.trim();
    if (newFac && !currentFacilities.includes(newFac)) {
      setCurrentFacilities(prev => [...prev, newFac].sort());
      const currentRoomFacilities = formData.facilities || [];
      setFormData({ ...formData, facilities: [...currentRoomFacilities, newFac] });
      setNewFacilityInput('');
    }
  };

  const picOptions: SelectOption[] = [
    { value: '', label: '-- Tidak Ada PIC --' },
    ...staffList.map(s => ({
      value: s.id,
      label: s.name,
      subLabel: s.jabatan || 'Staff'
    }))
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.capacity || formData.capacity <= 0) {
      alert("Kapasitas ruangan harus lebih dari 0.");
      return;
    }
    const payload = {
      ...formData,
      facilities: formData.facilities?.filter(f => f.trim() !== '') || []
    };
    onSave(payload);
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center mb-6">
        <Button 
          type="button" 
          onClick={onCancel} 
          variant="ghost"
          size="icon"
          className="mr-3 text-gray-500 dark:text-gray-400"
          title="Kembali"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h2 className="text-2xl font-bold dark:text-white">{isEditing ? 'Edit Ruangan' : 'Tambah Ruangan Baru'}</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* --- Bagian 1: Informasi Dasar --- */}
        <div className="bg-gray-50 dark:bg-gray-700/20 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Informasi Dasar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Ruangan</label>
              <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Contoh: Lab Jaringan Komputer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori Ruangan</label>
              <select required value={formData.category || 'Laboratorium Komputer'} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm">
                <option value="Laboratorium Komputer">Laboratorium Komputer</option>
                <option value="Teori">Teori</option>
                <option value="Praktek">Praktek</option>
                <option value="Rekreasi">Rekreasi</option>
                <option value="Meeting">Meeting</option>
                <option value="Lounge">Lounge</option>
                <option value="Open Space">Open Space</option>
                <option value="Auditorium/Ruang Kuliah Umum">Auditorium/Ruang Kuliah Umum</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kapasitas (Orang)</label>
              <input type="number" min="0" required value={formData.capacity || ''} onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })} className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lantai</label>
              <select 
                value={formData.floor || 'Lantai 4'} 
                onChange={e => setFormData({ ...formData, floor: e.target.value })} 
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                <option value="Lantai 1">Lantai 1</option>
                <option value="Lantai 2">Lantai 2</option>
                <option value="Lantai 3">Lantai 3</option>
                <option value="Lantai 4">Lantai 4</option>
                <option value="Lantai 5">Lantai 5</option>
                <option value="Lantai 6">Lantai 6</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi Ruangan</label>
              <textarea rows={3} required value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Tuliskan deskripsi singkat mengenai ruangan ini..." />
            </div>
          </div>
        </div>

        {/* --- Bagian 2: Fasilitas & Pengelola --- */}
        <div className="bg-gray-50 dark:bg-gray-700/20 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Fasilitas & Pengelola</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fasilitas Tersedia</label>
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm">
                <div className="flex flex-wrap gap-2">
                {currentFacilities.map((fac) => {
                  const isSelected = (formData.facilities || []).includes(fac);
                  return (
                    <button type="button" key={fac} onClick={() => {
                      const currentRoomFacilities = formData.facilities || [];
                      const newFacilities = isSelected ? currentRoomFacilities.filter(f => f !== fac) : [...currentRoomFacilities, fac];
                      setFormData({ ...formData, facilities: newFacilities });
                    }} className={cn(buttonVariants({ variant: isSelected ? 'primary' : 'secondary', size: 'xs' }), 'rounded-full')}>
                      {isSelected && <Check className="w-3 h-3 mr-1.5" />}
                      {fac}
                    </button>
                  );
                })}
                </div>
                <div className="flex mt-4">
                  <input type="text" value={newFacilityInput} onChange={(e) => setNewFacilityInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewFacility(); } }} placeholder="Ketik fasilitas khusus lainnya..." className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-l-lg dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  <Button type="button" onClick={handleAddNewFacility} variant="secondary" className="rounded-l-none border-l-0">Tambah</Button>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIC (Penanggung Jawab)</label>
              <SearchableSelect
                options={picOptions}
                value={(formData as any).pic_id || (formData as any).picId || ''}
                onChange={(val) => {
                  const staff = staffList.find(s => s.id === val);
                  setFormData({ ...formData, pic: staff ? staff.name : '', pic_id: val, picId: val } as any);
                }}
                placeholder="-- Pilih PIC --"
                searchPlaceholder="Cari nama staff..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Calendar ID <span className="text-xs text-gray-400 font-normal ml-1">(Opsional)</span></label>
              <input type="text" value={formData.googleCalendarUrl || ''} onChange={e => setFormData({ ...formData, googleCalendarUrl: e.target.value })} placeholder='Contoh: fti.laboran@adm.uksw.edu' className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
          </div>
        </div>

        {/* --- Bagian 3: Media & Visual --- */}
        <div className="bg-gray-50 dark:bg-gray-700/20 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-600 pb-2">Media & Visual</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Gambar 360°</label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-xl p-8 text-center hover:bg-white dark:hover:bg-gray-800 transition-all group relative overflow-hidden bg-gray-50/50 dark:bg-gray-800/50">
              {isImageProcessing ? (
                <div className="flex flex-col items-center text-blue-600"><Loader2 className="w-10 h-10 animate-spin mb-3" /><span className="text-sm font-semibold">Memuat gambar...</span></div>
              ) : formData.image ? (
                <div className="flex flex-col items-center">
                  <img src={formData.image} alt="Preview" className="h-56 w-full object-cover rounded-lg shadow-sm mb-4 border border-gray-200 dark:border-gray-700" />
              <Button type="button" onClick={() => setFormData({ ...formData, image: '', imageChanged: true } as any)} variant="destructive">Hapus & Ganti Gambar</Button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center py-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Klik untuk upload gambar Equirectangular (360)</span>
                  <span className="text-xs text-gray-500">Mendukung format JPG/PNG</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* --- Tindakan (Actions) --- */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" onClick={onCancel} disabled={isSaving} variant="secondary">Batal</Button>
          <Button type="submit" disabled={isImageProcessing || isSaving} variant="primary">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RoomForm;
