import React, { useState, useEffect } from 'react';
import { Plus, Printer, Download, Edit, Trash2, X, Check, FileText, Upload, Users, File, Eye } from 'lucide-react';
import nocLogo from "../src/assets/noc.png";
import { api } from '../services/api';
import { PKLStudent } from '../types';
import SearchableSelect, { SelectOption } from '../components/SearchableSelect';
import { formatDateID } from '../src/utils/formatters';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import PrintableReportHeader from '../components/PrintableReportHeader';
import { usePagination } from '../hooks/usePagination';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

interface PKLManagementProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface Staff {
  id: string;
  nama: string;
  jabatan: string;
}

interface BatchStudent {
  nama: string;
 Jurusan: string;
}

const PKLManagement: React.FC<PKLManagementProps> = ({ showToast }) => {
  const [pklList, setPklList] = useState<PKLStudent[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Aktif' | 'Selesai' | 'Dibatalkan'>('All');
  const [filterSekolah, setFilterSekolah] = useState('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [editingPKL, setEditingPKL] = useState<PKLStudent | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form State
  const [formSekolah, setFormSekolah] = useState('');
  const [formTanggalMulai, setFormTanggalMulai] = useState('');
  const [formTanggalSelesai, setFormTanggalSelesai] = useState('');
  const [formPembimbingId, setFormPembimbingId] = useState('');
  const [formStatus, setFormStatus] = useState<'Aktif' | 'Selesai' | 'Dibatalkan'>('Aktif');
  const [formSurat, setFormSurat] = useState<string | undefined>(undefined);
  
  // Batch students
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([
    { nama: '', Jurusan: '' }
  ]);

  useEffect(() => {
    fetchPKL();
    fetchStaff();
  }, []);

  const fetchPKL = async () => {
    try {
      const res = await api('/api/pkl');
      if (res.ok) {
        const data = await res.json();
        setPklList(data);
      }
    } catch (error) {
      console.error("Gagal mengambil data PKL", error);
      showToast("Gagal mengambil data PKL", 'error');
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await api('/api/staff');
      if (res.ok) {
        const data = await res.json();
        // Filter hanya staff dengan jabatan Teknisi
        const teknisi = data.filter((s: Staff) => s.jabatan === 'Teknisi');
        setStaffList(teknisi);
      }
    } catch (error) {
      console.error("Gagal mengambil data staff", error);
    }
  };

  // Get unique schools for filter
  const uniqueSekolah = [...new Set(pklList.map(p => p.sekolah))];

  // Filter Data
  const filteredPKL = pklList.filter(pkl => {
    const matchesSearch = pkl.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          pkl.sekolah.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || pkl.status === filterStatus;
    const matchesSekolah = filterSekolah === 'All' || pkl.sekolah === filterSekolah;
    return matchesSearch && matchesStatus && matchesSekolah;
  });

  // Pagination
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData: currentPKL,
    totalPages
  } = usePagination(filteredPKL, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSekolah, itemsPerPage, setCurrentPage]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("Ukuran file maksimal 5MB", 'error');
        return;
      }
      if (file.type !== 'application/pdf') {
        showToast("File harus format PDF", 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormSurat(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormSekolah('');
    setFormTanggalMulai('');
    setFormTanggalSelesai('');
    setFormPembimbingId('');
    setFormStatus('Aktif');
    setFormSurat(undefined);
    setBatchStudents([{ nama: '', Jurusan: '' }]);
    setEditingPKL(null);
  };

  // Open modal for single add
  const handleOpenSingleModal = () => {
    setIsBatchMode(false);
    resetForm();
    setIsModalOpen(true);
  };

  // Open modal for batch add
  const handleOpenBatchModal = () => {
    setIsBatchMode(true);
    resetForm();
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEditModal = (pkl: PKLStudent) => {
    setEditingPKL(pkl);
    setFormSekolah(pkl.sekolah);
    setFormTanggalMulai(pkl.tanggalMulai);
    setFormTanggalSelesai(pkl.tanggalSelesai);
    setFormPembimbingId(pkl.pembimbingId || '');
    setFormStatus(pkl.status);
    setFormSurat(undefined);
    setBatchStudents([{ nama: pkl.nama, Jurusan: pkl.Jurusan }]);
    setIsBatchMode(false);
    setIsModalOpen(true);
  };

  const staffOptions: SelectOption[] = staffList.map(s => ({
    value: s.id,
    label: s.nama,
    subLabel: s.jabatan
  }));

  // Add/Update single PKL
  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pklData = {
      nama: batchStudents[0].nama,
      sekolah: formSekolah,
      Jurusan: batchStudents[0].Jurusan,
      tanggalMulai: formTanggalMulai,
      tanggalSelesai: formTanggalSelesai,
      pembimbingId: formPembimbingId || null,
      status: formStatus,
      suratPengajuan: formSurat
    };

    try {
      if (editingPKL) {
        const res = await api(`/api/pkl/${editingPKL.id}`, {
          method: 'PUT',
          data: pklData
        });
        if (res.ok) {
          showToast("Data PKL berhasil diperbarui", 'success');
          fetchPKL();
          setIsModalOpen(false);
          resetForm();
        } else {
          showToast("Gagal memperbarui data PKL", 'error');
        }
      } else {
        const res = await api('/api/pkl', {
          method: 'POST',
          data: { students: [pklData] }
        });
        if (res.ok) {
          showToast("Data PKL berhasil ditambahkan", 'success');
          fetchPKL();
          setIsModalOpen(false);
          resetForm();
        } else {
          const err = await res.json();
          showToast(err.error || "Gagal menambahkan data PKL", 'error');
        }
      }
    } catch (error) {
      showToast("Terjadi kesalahan saat menyimpan", 'error');
    }
  };

  // Add batch PKL
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter valid students
    const validStudents = batchStudents.filter(s => s.nama.trim() !== '');
    
    if (validStudents.length === 0) {
      showToast("Masukkan minimal 1 nama siswa", 'error');
      return;
    }

    const students = validStudents.map(s => ({
      nama: s.nama,
      sekolah: formSekolah,
      Jurusan: s.Jurusan,
      tanggalMulai: formTanggalMulai,
      tanggalSelesai: formTanggalSelesai,
      pembimbingId: formPembimbingId || null,
      status: 'Aktif' as const,
      suratPengajuan: formSurat
    }));

    try {
      const res = await api('/api/pkl', {
        method: 'POST',
        data: { students }
      });
      if (res.ok) {
        const result = await res.json();
        showToast(result.message || `${students.length} data PKL berhasil ditambahkan`, 'success');
        fetchPKL();
        setIsModalOpen(false);
        resetForm();
      } else {
        const err = await res.json();
        showToast(err.error || "Gagal menambahkan data PKL", 'error');
      }
    } catch (error) {
      showToast("Terjadi kesalahan saat menyimpan", 'error');
    }
  };

  // Delete PKL
  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;

    setIsDeleting(true);
    try {
      const res = await api(`/api/pkl/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Data PKL berhasil dihapus", 'success');
        fetchPKL();
      } else {
        showToast("Gagal menghapus data PKL", 'error');
      }
    } catch (error) {
      showToast("Terjadi kesalahan saat menghapus", 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  // View Surat
  const handleViewSurat = async (id: string) => {
    try {
      showToast("Sedang memuat file...", "info");
      const res = await api(`/api/pkl/${id}/document`);
      if (res.ok) {
        const data = await res.json();
        const fetchRes = await fetch(data.file);
        const blob = await fetchRes.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        showToast("File tidak ditemukan.", 'error');
      }
    } catch (e) {
      console.error("Gagal membuka file", e);
      showToast("Gagal membuka file.", 'error');
    }
  };

  // Add student row for batch mode
  const addStudentRow = () => {
    setBatchStudents([...batchStudents, { nama: '', Jurusan: '' }]);
  };

  // Remove student row
  const removeStudentRow = (index: number) => {
    if (batchStudents.length > 1) {
      setBatchStudents(batchStudents.filter((_, i) => i !== index));
    }
  };

  // Update student row
  const updateStudentRow = (index: number, field: keyof BatchStudent, value: string) => {
    const updated = [...batchStudents];
    updated[index][field] = value;
    setBatchStudents(updated);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["Nama", "Sekolah", "Jurusan", "Tanggal Mulai", "Tanggal Selesai", "Status", "Pembimbing"];
    const rows = filteredPKL.map(p => [
      p.nama, 
      p.sekolah, 
      p.Jurusan, 
      p.tanggalMulai, 
      p.tanggalSelesai, 
      p.status, 
      p.pembimbingNama || '-'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "data_pkl_fti.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PrintableReportHeader title="Data PKL" logoSrc={nocLogo} />

      <PageHeader
        title="Manajemen PKL"
        description="Kelola data siswa magang (PKL) dari berbagai sekolah"
        className="print:hidden"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportCSV} variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => window.print()} variant="secondary" size="sm">
              <Printer className="w-4 h-4 mr-2" /> Print Data
            </Button>
            <Button onClick={handleOpenBatchModal} variant="secondary" size="sm">
              <Users className="w-4 h-4 mr-2" /> Tambah Batch
            </Button>
            <Button onClick={handleOpenSingleModal} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" /> Tambah PKL
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <PageCard className="flex flex-col items-center justify-between gap-4 print:border-none print:p-0 print:shadow-none sm:flex-row">
         <div className="w-full sm:w-auto print:hidden">
           <SearchBar 
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cari nama atau sekolah..."
           />
         </div>
         <div className="flex gap-2 w-full sm:w-auto print:hidden">
           <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
           >
              <option value="All">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Selesai">Selesai</option>
              <option value="Dibatalkan">Dibatalkan</option>
           </select>
           <select
              value={filterSekolah}
              onChange={(e) => setFilterSekolah(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
           >
              <option value="All">Semua Sekolah</option>
              {uniqueSekolah.map(sekolah => (
                <option key={sekolah} value={sekolah}>{sekolah}</option>
              ))}
           </select>
         </div>
      </PageCard>

      {/* Table */}
      <PageCard padding="none" className="overflow-hidden print:border-2 print:border-black print:shadow-none">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700 print:bg-gray-200 print:text-black">
                  <tr>
                     <th className="px-6 py-4">Nama Siswa</th>
                     <th className="px-6 py-4">Sekolah & Jurusan</th>
                     <th className="px-6 py-4">Periode</th>
                     <th className="px-6 py-4">Pembimbing</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4">Surat</th>
                     <th className="px-6 py-4 print:hidden">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-400">
                  {currentPKL.length > 0 ? currentPKL.map((pkl) => (
                     <tr key={pkl.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                           <div className="font-bold text-gray-900 dark:text-white">{pkl.nama}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-gray-900 dark:text-gray-300">{pkl.sekolah}</div>
                           <div className="text-xs text-gray-500">{pkl.Jurusan}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-gray-900 dark:text-gray-300 text-xs">
                             {formatDateID(pkl.tanggalMulai)} - {formatDateID(pkl.tanggalSelesai)}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-gray-900 dark:text-gray-300">
                             {pkl.pembimbingNama || '-'}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium print:border print:border-gray-300 ${
                             pkl.status === 'Aktif' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                             pkl.status === 'Selesai' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 
                             'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                           }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 print:hidden ${
                                pkl.status === 'Aktif' ? 'bg-green-500' : 
                                pkl.status === 'Selesai' ? 'bg-blue-500' : 'bg-red-500'
                              }`}></span>
                              {pkl.status}
                           </span>
                        </td>
                         <td className="px-6 py-4">
                            {pkl.hasSurat ? (
                              <button 
                                onClick={() => handleViewSurat(pkl.id)}
                                className="text-blue-600 hover:text-blue-800 flex items-center text-xs"
                              >
                                <Eye className="w-4 h-4 mr-1" /> Lihat
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                         </td>
                        <td className="px-6 py-4 print:hidden">
                           <div className="flex space-x-2">
                              <button onClick={() => handleOpenEditModal(pkl)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-blue-600 dark:text-blue-400')} title="Edit">
                                 <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteClick(pkl.id)} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-red-600 dark:text-red-400')} title="Hapus">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </td>
                     </tr>
                  )) : (
                     <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                           <div className="flex flex-col items-center justify-center">
                              <Users className="w-12 h-12 text-gray-300 mb-3" />
                              <p>Tidak ada data PKL yang ditemukan.</p>
                           </div>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
         <div className="print:hidden">
           <Pagination 
             currentPage={currentPage}
             totalPages={totalPages}
             totalItems={filteredPKL.length}
             itemsPerPage={itemsPerPage}
             onPageChange={setCurrentPage}
             onItemsPerPageChange={setItemsPerPage}
           />
         </div>
      </PageCard>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                 <h3 className="font-bold text-gray-900 dark:text-white">
                    {editingPKL ? 'Edit Data PKL' : isBatchMode ? 'Tambah PKL Batch' : 'Tambah PKL Baru'}
                 </h3>
                 <button onClick={() => { setIsModalOpen(false); resetForm(); }} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-gray-500 dark:text-gray-300')}>
                    <X className="w-5 h-5" />
                 </button>
              </div>
              
              <form onSubmit={isBatchMode ? handleSaveBatch : handleSaveSingle} className="p-6 space-y-4">
                 {/* School & Period */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Sekolah (SMK)</label>
                       <input 
                         type="text" required 
                         value={formSekolah} 
                         onChange={e => setFormSekolah(e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                         placeholder="Contoh: SMK N 1 Salatiga"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai</label>
                       <input 
                         type="date" required 
                         value={formTanggalMulai} 
                         onChange={e => setFormTanggalMulai(e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Selesai</label>
                       <input 
                         type="date" required 
                         value={formTanggalSelesai} 
                         onChange={e => setFormTanggalSelesai(e.target.value)}
                         className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pembimbing (Teknisi)</label>
                       <SearchableSelect
                         options={staffOptions}
                         value={formPembimbingId}
                         onChange={val => setFormPembimbingId(val)}
                         placeholder="-- Pilih Pembimbing --"
                         searchPlaceholder="Cari pembimbing..."
                       />
                    </div>
                    {editingPKL && (
                      <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                         <select 
                           value={formStatus}
                           onChange={e => setFormStatus(e.target.value as any)}
                           className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                         >
                            <option value="Aktif">Aktif</option>
                            <option value="Selesai">Selesai</option>
                            <option value="Dibatalkan">Dibatalkan</option>
                         </select>
                      </div>
                    )}
                 </div>

                 {/* Surat Pengajuan */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                     Surat Pengajuan (PDF)
                     {editingPKL && (formSurat || editingPKL.hasSurat) && <span className="text-green-500 ml-2">✓ File sudah ada</span>}
                   </label>
                   <div className="flex items-center gap-2">
                     <label className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                       <Upload className="w-4 h-4 mr-2" />
                       <span className="text-sm">Upload PDF</span>
                       <input 
                         type="file" 
                         accept="application/pdf"
                         onChange={handleFileChange}
                         className="hidden"
                       />
                     </label>
                     {formSurat && (
                       <span className="text-xs text-gray-500">File selected</span>
                     )}
                   </div>
                   <p className="text-xs text-gray-500 mt-1">Maksimal 5MB</p>
                 </div>

                 {/* Student Names */}
                 <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     {isBatchMode ? 'Daftar Siswa' : 'Nama Siswa'}
                   </label>
                   
                   {isBatchMode ? (
                     <div className="space-y-2 max-h-60 overflow-y-auto">
                       {batchStudents.map((student, index) => (
                         <div key={index} className="flex gap-2 items-center">
                           <span className="text-xs text-gray-400 w-6">{index + 1}.</span>
                           <input 
                             type="text" required 
                             value={student.nama}
                             onChange={e => updateStudentRow(index, 'nama', e.target.value)}
                             className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                             placeholder="Nama siswa"
                           />
                           <input 
                             type="text" required 
                             value={student.Jurusan}
                             onChange={e => updateStudentRow(index, 'Jurusan', e.target.value)}
                             className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                             placeholder="Jurusan"
                           />
                           {batchStudents.length > 1 && (
                             <button 
                               type="button"
                               onClick={() => removeStudentRow(index)}
                               className="p-1 text-red-500 hover:bg-red-50 rounded"
                             >
                               <X className="w-4 h-4" />
                             </button>
                           )}
                         </div>
                       ))}
                       <button 
                         type="button"
                         onClick={addStudentRow}
                         className="text-sm text-blue-600 hover:text-blue-700 flex items-center mt-2"
                       >
                         <Plus className="w-4 h-4 mr-1" /> Tambah baris
                       </button>
                     </div>
                   ) : (
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <input 
                           type="text" required 
                           value={batchStudents[0].nama}
                           onChange={e => setBatchStudents([{ ...batchStudents[0], nama: e.target.value }])}
                           className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                           placeholder="Nama lengkap siswa"
                         />
                       </div>
                       <div>
                         <input 
                           type="text" required 
                           value={batchStudents[0].Jurusan}
                           onChange={e => setBatchStudents([{ ...batchStudents[0], Jurusan: e.target.value }])}
                           className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                           placeholder="Jurusan"
                         />
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <Button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} variant="secondary">Batal</Button>
                    <Button type="submit" variant="primary">
                       <Check className="w-4 h-4 mr-2" /> Simpan
                    </Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Hapus Data PKL"
        message="Apakah Anda yakin ingin menghapus data PKL ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default PKLManagement;
