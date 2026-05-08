import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle, Loader2, Users, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { useLecturers, Lecturer } from '../hooks/useLecturers';
import { usePagination } from '../hooks/usePagination';
import { api } from '../services/api';

// Asumsi komponen ini menerima fungsi showToast dari parent/layout untuk notifikasi
interface LecturerManagementProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const LecturerManagement: React.FC<LecturerManagementProps> = ({ showToast }) => {
  const { lecturers, isLoading, error, fetchLecturers } = useLecturers();
  
  // State untuk Pencarian
  const [searchQuery, setSearchQuery] = useState('');

  // State untuk Modal Form (Create/Update)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({ id: '', nama: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // State untuk Modal Hapus
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [lecturerToDelete, setLecturerToDelete] = useState<Lecturer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter data berdasarkan pencarian
  const filteredLecturers = useMemo(() => {
    if (!searchQuery.trim()) return lecturers;
    const query = searchQuery.toLowerCase();
    return lecturers.filter(
      (l) => l.id.toLowerCase().includes(query) || l.nama.toLowerCase().includes(query)
    );
  }, [lecturers, searchQuery]);

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedData,
    nextPage,
    prevPage,
    setItemsPerPage
  } = usePagination(filteredLecturers, 10);

  // Handler untuk membuka modal tambah
  const handleOpenCreate = () => {
    setFormMode('create');
    setFormData({ id: '', nama: '' });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Handler untuk membuka modal edit
  const handleOpenEdit = (lecturer: Lecturer) => {
    setFormMode('edit');
    setFormData({ id: lecturer.id, nama: lecturer.nama });
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Manajemen Dosen</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola data dosen internal dan eksternal fakultas.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Dosen
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-gray-800/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode atau nama dosen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            {searchQuery && (
              <div className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:block">
                Hasil: <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredLecturers.length}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold whitespace-nowrap border border-blue-100 dark:border-blue-800">
              <Users className="w-4 h-4" />
              <span>Total {lecturers.length} Dosen</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-gray-900/50 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Kode Dosen (ID)</th>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4 w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <p>Memuat data dosen...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-red-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6" />
                      <p>{error}</p>
                      <button onClick={fetchLecturers} className="text-sm underline hover:text-red-600 mt-2">Coba Lagi</button>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
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
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(lecturer)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Dosen"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(lecturer)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Hapus Dosen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && filteredLecturers.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/50">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Halaman <span className="font-medium text-slate-700 dark:text-slate-200">{currentPage}</span> dari{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{totalPages || 1}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 border border-slate-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form Create/Edit */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {formMode === 'create' ? 'Tambah Dosen Baru' : 'Edit Data Dosen'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {isDeleteModalOpen && lecturerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 mx-auto flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Hapus Data Dosen?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Apakah Anda yakin ingin menghapus dosen <span className="font-semibold text-slate-700 dark:text-slate-300">"{lecturerToDelete.nama}"</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl transition-colors"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerManagement;