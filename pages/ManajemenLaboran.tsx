import React, { useState, useEffect } from 'react';
import { Plus, Printer, Download, Edit, Trash2, X, Check, FileSpreadsheet, Users, Eye } from 'lucide-react';
import nocLogo from "../src/assets/noc.png";
import { api } from '../services/api';
import { Room } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import SearchBar from '../components/SearchBar';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import PrintableReportHeader from '../components/PrintableReportHeader';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

interface LabStaff {
  id: string;
  name: string;
  nim: string;
  email: string;
  phone: string;
  jabatan: 'Admin' | 'Teknisi' | 'Supervisor' | 'Kepala Sarpras';
  status: 'Aktif' | 'Non-Aktif';
}

interface LaboranManagementProps {
  onNavigate?: (page: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const LaboranManagement: React.FC<LaboranManagementProps> = ({ onNavigate, showToast }) => {
  const [staffList, setStaffList] = useState<LabStaff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Aktif' | 'Non-Aktif'>('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<LabStaff | null>(null);
  const [viewingStaff, setViewingStaff] = useState<LabStaff | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<Partial<LabStaff>>({
    name: '', nim: '', email: '', phone: '', jabatan: 'Teknisi', status: 'Aktif'
  });

  useEffect(() => {
    fetchStaff();
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api('/api/rooms?exclude_image=true');
      if (res.ok) {
        setRooms(await res.json());
      }
    } catch (error) {
      console.error("Gagal mengambil data ruangan", error);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await api('/api/staff');
      if (res.ok) {
        const data = await res.json();
        // Mapping data dari DB (staff) ke Frontend (LabStaff)
        const mappedData = data.map((s: any) => ({
            id: s.id,
            name: s.nama,
            nim: s.identifier,
            email: s.email,
            phone: s.telepon,
            jabatan: s.jabatan,
            status: s.status
        }));
        setStaffList(mappedData);
      }
    } catch (error) {
      console.error("Gagal mengambil data laboran", error);
    }
  };

  // Mengecek apakah user baru saja kembali dari halaman detail ruangan
  useEffect(() => {
    const returnId = localStorage.getItem('returnToLaboranId');
    if (returnId && staffList.length > 0) {
      const staff = staffList.find(s => s.id === returnId);
      if (staff) setViewingStaff(staff);
      localStorage.removeItem('returnToLaboranId'); // Bersihkan riwayat
    }
  }, [staffList]);

  // Filter Data
  const filteredStaff = staffList.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          staff.nim.includes(searchTerm);
    const matchesStatus = filterStatus === 'All' || staff.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["ID", "Nama", "NIM", "Email", "No HP", "Jabatan", "Status"];
    const rows = filteredStaff.map(s => [s.id, s.name, s.nim, s.email, s.phone, s.jabatan, s.status]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "data_laboran_fti.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // CRUD Operations
  const handleOpenModal = (staff?: LabStaff) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData(staff);
    } else {
      setEditingStaff(null);
      setFormData({ name: '', nim: '', email: '', phone: '', jabatan: 'Teknisi', status: 'Aktif' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingStaff) {
        // Update
        const res = await api(`/api/staff/${editingStaff.id}`, {
          method: 'PUT',
          data: formData
        });
        
        if (res.ok) {
          setStaffList(prev => prev.map(s => s.id === editingStaff.id ? { ...s, ...formData } as LabStaff : s));
          showToast("Data laboran berhasil diperbarui.", "success");
        }
      } else {
        // Create
        const res = await api('/api/staff', {
          method: 'POST',
          data: formData
        });

        if (res.ok) {
          const result = await res.json();
          const newStaff = { ...formData, id: result.id } as LabStaff;
          setStaffList(prev => [newStaff, ...prev]);
          showToast("Data laboran berhasil ditambahkan.", "success");
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      showToast("Terjadi kesalahan saat menyimpan data.", "error");
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api(`/api/staff/${deleteTargetId}`, { method: 'DELETE' });
      setStaffList(prev => prev.filter(s => s.id !== deleteTargetId));
      showToast("Data laboran berhasil dihapus.", "success");
    } catch (error) {
      showToast("Gagal menghapus data.", "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PrintableReportHeader title="Data Laboran" logoSrc={nocLogo} />

      <PageHeader
        title="Manajemen Laboran"
        description="Kelola data teknisi dan admin laboran"
        className="print:hidden"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportCSV} variant="secondary" size="sm">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={handlePrint} variant="secondary" size="sm">
              <Printer className="w-4 h-4 mr-2" /> Print Data
            </Button>
            <Button onClick={() => handleOpenModal()} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" /> Tambah Laboran
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <PageCard className="flex flex-col items-center justify-between gap-4 print:border-none print:p-0 print:shadow-none sm:flex-row">
         <div className="w-full sm:w-64 print:hidden">
            <SearchBar 
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cari nama atau NIM..."
              className="w-full"
            />
         </div>
         <div className="flex gap-2 w-full sm:w-auto print:hidden">
             {['All', 'Aktif', 'Non-Aktif'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    filterStatus === status 
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 font-medium' 
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                   {status}
                </button>
             ))}
         </div>
      </PageCard>

      {/* Table */}
      <PageCard padding="none" className="overflow-hidden print:border-2 print:border-black print:shadow-none">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700 print:bg-gray-200 print:text-black">
                  <tr>
                     <th className="px-6 py-4">Nama & NIM</th>
                     <th className="px-6 py-4">Kontak</th>
                     <th className="px-6 py-4">Jabatan</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4 print:hidden">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-400">
                  {filteredStaff.length > 0 ? filteredStaff.map((staff) => (
                     <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                           <div className="font-bold text-gray-900 dark:text-white">{staff.name}</div>
                           <div className="text-xs text-gray-500 font-mono">{staff.nim}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-gray-900 dark:text-gray-300">{staff.email}</div>
                           <div className="text-xs text-gray-500">{staff.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-xs font-medium print:border print:border-gray-300 ${staff.jabatan === 'Teknisi' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                              {staff.jabatan}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium print:border print:border-gray-300 ${staff.status === 'Aktif' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 print:hidden ${staff.status === 'Aktif' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              {staff.status}
                           </span>
                        </td>
                        <td className="px-6 py-4 print:hidden">
                           <div className="flex space-x-2">
                              <button onClick={() => setViewingStaff(staff)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-blue-600 dark:text-blue-400')} title="Detail">
                                 <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleOpenModal(staff)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-blue-600 dark:text-blue-400')} title="Edit">
                                 <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteClick(staff.id)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-red-600 dark:text-red-400')} title="Hapus">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </td>
                     </tr>
                  )) : (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                           <div className="flex flex-col items-center justify-center">
                              <Users className="w-12 h-12 text-gray-300 mb-3" />
                              <p>Tidak ada data laboran yang ditemukan.</p>
                           </div>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </PageCard>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 print:hidden">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-full sm:max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 shrink-0">
                 <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    {editingStaff ? 'Edit Data Laboran' : 'Tambah Laboran Baru'}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <form onSubmit={handleSave} className="p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                       <input 
                         type="text" required 
                         value={formData.name} 
                         onChange={e => setFormData({...formData, name: e.target.value})}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 transition-shadow"
                         placeholder="Contoh: John Doe"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIM</label>
                       <input 
                         type="text" required 
                         value={formData.nim} 
                         onChange={e => setFormData({...formData, nim: e.target.value})}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 transition-shadow"
                         placeholder="Contoh: 672019xxx"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. HP</label>
                       <input 
                         type="text" required 
                         value={formData.phone} 
                         onChange={e => {
                           const val = e.target.value;
                           if (/^\d*$/.test(val)) {
                             setFormData({...formData, phone: val});
                           }
                         }}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 transition-shadow"
                         placeholder="08xxxxxxxx"
                       />
                    </div>
                    <div className="col-span-2">
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                       <input 
                         type="email" required 
                         value={formData.email} 
                         onChange={e => setFormData({...formData, email: e.target.value})}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 transition-shadow"
                         placeholder="email@uksw.edu"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jabatan</label>
                       <select 
                          value={formData.jabatan}
                          onChange={e => setFormData({...formData, jabatan: e.target.value as any})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                       >
                          <option value="Admin">Admin</option>
                          <option value="Teknisi">Teknisi</option>
                          <option value="Supervisor">Supervisor</option>
                          <option value="Kepala Sarpras">Kepala Sarpras</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                       <select 
                          value={formData.status}
                          onChange={e => setFormData({...formData, status: e.target.value as any})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                       >
                          <option value="Aktif">Aktif</option>
                          <option value="Non-Aktif">Non-Aktif</option>
                       </select>
                    </div>
                 </div>
                 <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary">Batal</Button>
                    <Button type="submit" variant="primary">
                       <Check className="w-4 h-4 mr-2" /> Simpan
                    </Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                 <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                    <Users className="w-5 h-5 mr-2 text-blue-600" />
                    Detail Laboran
                 </h3>
                 <button onClick={() => setViewingStaff(null)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-6 space-y-4">
                 <div className="text-center mb-4">
                     <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                         {viewingStaff.name.charAt(0)}
                     </div>
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewingStaff.name}</h2>
                     <p className="text-sm text-gray-500 dark:text-gray-400">{viewingStaff.jabatan}</p>
                 </div>
                 
                 <div className="space-y-3 text-sm">
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">NIM / Identifier</span>
                         <span className="font-mono font-medium text-gray-900 dark:text-white">{viewingStaff.nim}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">Email</span>
                         <span className="font-medium text-gray-900 dark:text-white">{viewingStaff.email}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">No. Telepon</span>
                         <span className="font-medium text-gray-900 dark:text-white">{viewingStaff.phone || '-'}</span>
                     </div>
                     <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                         <span className="text-gray-500 dark:text-gray-400">Status</span>
                         <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewingStaff.status === 'Aktif' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                             {viewingStaff.status}
                         </span>
                     </div>
                 </div>

                 <div className="mt-6">
                     <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Penanggung Jawab (PIC) Ruangan:</h4>
                     <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                         {rooms.filter(r => r.pic_id === viewingStaff.id).length > 0 ? (
                             rooms.filter(r => r.pic_id === viewingStaff.id).map(room => (
                                 <div 
                                     key={room.id} 
                                     onClick={() => {
                                         localStorage.setItem('targetRoomId', room.id);
                                         localStorage.setItem('returnToLaboranId', viewingStaff.id);
                                     if (onNavigate) onNavigate('ruangan');
                                     }}
                                     className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg text-sm border border-blue-100 dark:border-blue-800 flex justify-between items-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group"
                                     title="Klik untuk melihat detail ruangan"
                                 >
                                     <span className="font-medium group-hover:underline">{room.name}</span>
                                     <span className="text-xs opacity-75">{room.category}</span>
                                 </div>
                             ))
                         ) : (
                             <p className="text-sm text-gray-500 italic bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg text-center border border-dashed border-gray-200 dark:border-gray-600">Belum ditugaskan sebagai PIC ruangan mana pun.</p>
                         )}
                     </div>
                 </div>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-end">
                  <Button onClick={() => setViewingStaff(null)} variant="secondary">
                      Tutup
                  </Button>
              </div>
           </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTargetId(null); }}
        onConfirm={confirmDelete}
        title="Hapus Data Laboran"
        message="Apakah Anda yakin ingin menghapus data laboran ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default LaboranManagement;
