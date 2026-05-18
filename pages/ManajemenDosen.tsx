import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useLecturers, Lecturer } from '../hooks/useLecturers';
import { useStudyPrograms } from '../hooks/useStudyPrograms';
import { usePagination } from '../hooks/usePagination';
import { api } from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

const JABATAN_OPTIONS = [
  { value: '', label: '— Tidak Ada —' },
  { value: 'Dekan', label: 'Dekan' },
  { value: 'Wakil Dekan', label: 'Wakil Dekan' },
  { value: 'Kepala Program Studi', label: 'Kepala Program Studi' },
  { value: 'Kepala Departemen', label: 'Kepala Departemen' },
];

// Asumsi komponen ini menerima fungsi showToast dari parent/layout untuk notifikasi
interface LecturerManagementProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  role?: string;
}

const LecturerManagement: React.FC<LecturerManagementProps> = ({ showToast, role }) => {
  const { lecturers, isLoading, error, fetchLecturers } = useLecturers();
  const { studyPrograms } = useStudyPrograms();

  // Hanya Admin dan Admin TU yang bisa CRUD, sisanya read-only
  const canEdit = !role || ['Admin', 'Admin TU'].includes(role);
  
  // State untuk Pencarian
  const [searchQuery, setSearchQuery] = useState('');

  // State untuk Modal Form (Create/Update)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({ id: '', nama: '', jabatan: '', study_program_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // State untuk Modal Hapus
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [lecturerToDelete, setLecturerToDelete] = useState<Lecturer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // State untuk Import/Export Excel
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter data berdasarkan pencarian
  const filteredLecturers = useMemo(() => {
    if (!searchQuery.trim()) return lecturers;
    const query = searchQuery.toLowerCase();
    return lecturers.filter(
      (l) => l.id.toLowerCase().includes(query) || 
             l.nama.toLowerCase().includes(query) ||
             (l.jabatan || '').toLowerCase().includes(query) ||
             (l.study_program_name || '').toLowerCase().includes(query)
    );
  }, [lecturers, searchQuery]);

  // Pagination
  const {
    currentPage,
    totalPages,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData,
  } = usePagination(filteredLecturers, 10);

  // Handler untuk membuka modal tambah
  const handleOpenCreate = () => {
    setFormMode('create');
    setFormData({ id: '', nama: '', jabatan: '', study_program_id: '' });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Handler untuk membuka modal edit
  const handleOpenEdit = (lecturer: Lecturer) => {
    setFormMode('edit');
    setFormData({ 
      id: lecturer.id, 
      nama: lecturer.nama, 
      jabatan: lecturer.jabatan || '',
      study_program_id: lecturer.study_program_id || ''
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Handler untuk membuka modal hapus
  const handleOpenDelete = (lecturer: Lecturer) => {
    setLecturerToDelete(lecturer);
    setIsDeleteModalOpen(true);
  };

  // Handler Submit Form (Create/Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.id.trim() || !formData.nama.trim()) {
      setFormError('Kode Dosen dan Nama wajib diisi');
      return;
    }

    // Validasi: Kaprodi harus punya prodi
    if (formData.jabatan === 'Kepala Program Studi' && !formData.study_program_id) {
      setFormError('Jabatan "Kepala Program Studi" wajib memilih Program Studi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = formMode === 'create' ? '/api/lecturers' : `/api/lecturers/${formData.id}`;
      const method = formMode === 'create' ? 'POST' : 'PUT';

      const response = await api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Terjadi kesalahan saat menyimpan data');
      }

      showToast?.(`Data dosen berhasil ${formMode === 'create' ? 'ditambahkan' : 'diperbarui'}`, 'success');
      setIsFormModalOpen(false);
      fetchLecturers(); // Refresh data
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Konfirmasi Hapus
  const handleConfirmDelete = async () => {
    if (!lecturerToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api(`/api/lecturers/${lecturerToDelete.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghapus data dosen');
      }

      showToast?.('Data dosen berhasil dihapus', 'success');
      setIsDeleteModalOpen(false);
      setLecturerToDelete(null);
      fetchLecturers(); // Refresh data
    } catch (err: any) {
      showToast?.(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Excel: Download Template ---
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Template Data Dosen');

    ws.columns = [
      { header: 'Kode Dosen', key: 'id', width: 15 },
      { header: 'Nama Lengkap (dengan Gelar)', key: 'nama', width: 40 },
      { header: 'Jabatan', key: 'jabatan', width: 25 },
      { header: 'Kode Program Studi', key: 'study_program_id', width: 22 },
    ];

    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    // Contoh data
    ws.addRow({ id: '67201', nama: 'Dr. Budi Santoso, M.Kom.', jabatan: '', study_program_id: '' });
    ws.addRow({ id: '68101', nama: 'Prof. Ani Rahmawati, Ph.D.', jabatan: 'Kepala Program Studi', study_program_id: '68' });
    ws.addRow({ id: '67301', nama: 'Ir. Candra Wijaya, M.T.', jabatan: 'Dekan', study_program_id: '' });

    // Sheet petunjuk
    const wsInfo = workbook.addWorksheet('Petunjuk');
    wsInfo.getColumn('A').width = 30;
    wsInfo.getColumn('B').width = 60;
    wsInfo.addRow(['Kolom', 'Keterangan']);
    wsInfo.getRow(1).font = { bold: true };
    wsInfo.addRow(['Kode Dosen', 'Kode unik dosen (WAJIB). Contoh: 67201']);
    wsInfo.addRow(['Nama Lengkap', 'Nama beserta gelar (WAJIB). Contoh: Dr. Budi, M.Kom.']);
    wsInfo.addRow(['Jabatan', 'Opsional. Pilihan: Dekan, Wakil Dekan, Kepala Program Studi, Kepala Departemen. Kosongkan jika dosen biasa.']);
    wsInfo.addRow(['Kode Program Studi', 'Wajib jika jabatan "Kepala Program Studi". Isi kode NIM 2 digit.']);
    wsInfo.addRow([]);
    wsInfo.addRow(['Daftar Kode Program Studi:']);
    wsInfo.getRow(wsInfo.lastRow!.number).font = { bold: true };
    studyPrograms.forEach(sp => {
      wsInfo.addRow([sp.id, `${sp.level} ${sp.name}`]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_data_dosen.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // --- Excel: Import ---
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
          showToast?.('File Excel kosong atau tidak valid.', 'error');
          return;
        }

        const existingIds = new Set(lecturers.map(l => l.id.toLowerCase().trim()));
        const validJabatanValues = JABATAN_OPTIONS.map(o => o.value).filter(Boolean);
        const validProdiIds = new Set(studyPrograms.map(sp => sp.id));
        let addedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const promises: Promise<any>[] = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const id = row.getCell(1).text?.trim();
          const nama = row.getCell(2).text?.trim();
          const jabatan = row.getCell(3).text?.trim() || '';
          const studyProgramId = row.getCell(4).text?.trim() || '';

          if (!id || !nama) {
            if (id || nama) errorCount++; // Partial data = error
            return;
          }

          // Skip duplicates
          if (existingIds.has(id.toLowerCase())) {
            skippedCount++;
            return;
          }

          // Validasi jabatan
          if (jabatan && !validJabatanValues.includes(jabatan)) {
            errorCount++;
            return;
          }

          // Validasi prodi untuk Kaprodi
          if (jabatan === 'Kepala Program Studi' && !validProdiIds.has(studyProgramId)) {
            errorCount++;
            return;
          }

          existingIds.add(id.toLowerCase());
          addedCount++;

          promises.push(
            api('/api/lecturers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id,
                nama,
                jabatan: jabatan || null,
                study_program_id: studyProgramId || null,
              }),
            })
          );
        });

        if (promises.length > 0) {
          await Promise.all(promises);
          fetchLecturers();
        }

        // Build summary toast
        const parts: string[] = [];
        if (addedCount > 0) parts.push(`${addedCount} berhasil diimport`);
        if (skippedCount > 0) parts.push(`${skippedCount} duplikat diabaikan`);
        if (errorCount > 0) parts.push(`${errorCount} baris gagal (data tidak valid)`);

        if (addedCount > 0) {
          showToast?.(parts.join('. ') + '.', skippedCount > 0 || errorCount > 0 ? 'warning' : 'success');
        } else if (skippedCount > 0) {
          showToast?.(`Semua data sudah ada (${skippedCount} duplikat diabaikan).`, 'info');
        } else if (errorCount > 0) {
          showToast?.(`${errorCount} baris gagal. Pastikan format sesuai template.`, 'error');
        } else {
          showToast?.('Tidak ada data valid ditemukan di file.', 'warning');
        }
      } catch (error) {
        console.error('Import error:', error);
        showToast?.('Gagal memproses file Excel.', 'error');
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      setIsImporting(false);
      showToast?.('Gagal membaca file Excel.', 'error');
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  // --- Excel: Export Data ---
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Data Dosen');

      ws.columns = [
        { header: 'Kode Dosen', key: 'id', width: 15 },
        { header: 'Nama Lengkap', key: 'nama', width: 40 },
        { header: 'Jabatan', key: 'jabatan', width: 25 },
        { header: 'Kode Program Studi', key: 'study_program_id', width: 22 },
        { header: 'Program Studi', key: 'study_program_full', width: 35 },
      ];

      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

      filteredLecturers.forEach(l => {
        ws.addRow({
          id: l.id,
          nama: l.nama,
          jabatan: l.jabatan || '',
          study_program_id: l.study_program_id || '',
          study_program_full: l.study_program_name ? `${l.study_program_level} ${l.study_program_name}` : '',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_dosen_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast?.('Data dosen berhasil diexport!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast?.('Gagal mengekspor data.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Helper untuk format jabatan badge
  const getJabatanBadge = (jabatan?: string) => {
    if (!jabatan) return <span className="text-slate-400 dark:text-slate-500 text-xs italic">—</span>;
    
    const colorMap: Record<string, string> = {
      'Dekan': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
      'Wakil Dekan': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
      'Kepala Program Studi': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
      'Kepala Departemen': 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[jabatan] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
        {jabatan}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Manajemen Dosen"
        description={
          <>
            Kelola data referensi dosen pengampu mata kuliah beserta jabatan struktural.
            {!canEdit && <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">Anda memiliki akses baca saja.</span>}
          </>
        }
        titleClassName="text-2xl font-bold text-slate-800 dark:text-white"
        descriptionClassName="mt-1 text-sm text-slate-500 dark:text-slate-400"
        actions={canEdit ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleDownloadTemplate} variant="secondary" size="sm" disabled={isImporting || isExporting}>
              <Download className="w-4 h-4 mr-2" /> Template
            </Button>
            <Button onClick={handleExportExcel} variant="secondary" size="sm" disabled={isImporting || isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              {isExporting ? 'Mengekspor...' : 'Export'}
            </Button>
            {isImporting ? (
              <Button variant="secondary" size="sm" disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengimport...
              </Button>
            ) : (
              <label className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Import
                <input type="file" accept=".xlsx" className="hidden" onChange={handleExcelUpload} disabled={isImporting || isExporting} />
              </label>
            )}
            <Button
              onClick={handleOpenCreate}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Dosen
            </Button>
          </div>
        ) : undefined}
      />

      {/* Table Section */}
      <PageCard padding="none" className="overflow-hidden rounded-2xl border-slate-200 dark:border-gray-700">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-gray-800/50">
          <div className="w-full sm:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari kode, nama, jabatan, atau prodi..."
            />
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredLecturers.length}</span> dosen
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-gray-900/50 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Kode Dosen (ID)</th>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">Jabatan</th>
                <th className="px-6 py-4">Program Studi</th>
                {canEdit && <th className="px-6 py-4 w-24">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <p>Memuat data dosen...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-6 py-8 text-center text-red-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6" />
                      <p>{error}</p>
                      <button onClick={fetchLecturers} className="text-sm underline hover:text-red-600 mt-2">Coba Lagi</button>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada data dosen yang ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedData.map((lecturer) => (
                  <tr key={lecturer.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/80 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {lecturer.id}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {lecturer.nama}
                    </td>
                    <td className="px-6 py-4">
                      {getJabatanBadge(lecturer.jabatan)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {lecturer.study_program_name ? (
                        <span className="text-sm">
                          {lecturer.study_program_level} {lecturer.study_program_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs italic">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEdit(lecturer)}
                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-blue-600 dark:text-blue-400')}
                            title="Edit Dosen"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(lecturer)}
                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-red-600 dark:text-red-400')}
                            title="Hapus Dosen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="print:hidden">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredLecturers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </PageCard>

      {/* Modal Form Create/Edit */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {formMode === 'create' ? 'Tambah Dosen Baru' : 'Edit Data Dosen'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-slate-500 dark:text-slate-300')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kode Dosen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={formMode === 'edit'}
                  placeholder="Contoh: 67201"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-gray-800"
                />
                {formMode === 'edit' && (
                  <p className="text-xs text-slate-500 mt-1">Kode dosen tidak dapat diubah setelah dibuat.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Lengkap Dosen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: Dr. Budi Santoso, M.Kom."
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                />
              </div>

              {/* Jabatan Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Jabatan
                </label>
                <select
                  value={formData.jabatan}
                  onChange={(e) => {
                    const newJabatan = e.target.value;
                    setFormData({ 
                      ...formData, 
                      jabatan: newJabatan,
                      // Reset prodi jika jabatan bukan Kaprodi
                      study_program_id: newJabatan === 'Kepala Program Studi' ? formData.study_program_id : ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                >
                  {JABATAN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kosongkan jika dosen biasa tanpa jabatan struktural.
                </p>
              </div>

              {/* Program Studi — muncul jika jabatan Kepala Program Studi */}
              {formData.jabatan === 'Kepala Program Studi' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Program Studi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.study_program_id}
                    onChange={(e) => setFormData({ ...formData, study_program_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                    required
                  >
                    <option value="">— Pilih Program Studi —</option>
                    {studyPrograms.map(sp => (
                      <option key={sp.id} value={sp.id}>
                        {sp.level} {sp.name} (Kode NIM: {sp.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kepala Program Studi wajib terikat ke satu program studi.
                  </p>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  variant="secondary"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setLecturerToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Data Dosen"
        message={`Apakah Anda yakin ingin menghapus dosen "${lecturerToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default LecturerManagement;
