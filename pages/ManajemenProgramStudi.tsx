import {
  WarningCircle as AlertCircle,
  PencilSimpleLine as Edit2,
  GraduationCap,
  SpinnerGap as Loader2,
  Plus,
  Trash as Trash2,
  X
} from '@phosphor-icons/react';
import React, { useMemo, useState } from 'react';

import ConfirmModal from '../components/ConfirmModal';
import PageCard from '../components/PageCard';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import { Button, buttonVariants } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { StudyProgram, useStudyPrograms } from '../hooks/useStudyPrograms';
import { usePagination } from '../hooks/usePagination';
import { cn } from '../lib/utils';
import { api } from '../services/api';

interface StudyProgramManagementProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const emptyForm = { id: '', name: '', level: '' };

const StudyProgramManagement: React.FC<StudyProgramManagementProps> = ({ showToast }) => {
  const { studyPrograms, isLoading, error, fetchStudyPrograms } = useStudyPrograms();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studyProgramToDelete, setStudyProgramToDelete] = useState<StudyProgram | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredStudyPrograms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return studyPrograms;

    return studyPrograms.filter((studyProgram) =>
      studyProgram.id.toLowerCase().includes(query) ||
      studyProgram.name.toLowerCase().includes(query) ||
      studyProgram.level.toLowerCase().includes(query)
    );
  }, [searchQuery, studyPrograms]);

  const {
    currentPage,
    totalPages,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData,
  } = usePagination(filteredStudyPrograms, 10);

  const openCreateModal = () => {
    setFormMode('create');
    setFormData(emptyForm);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (studyProgram: StudyProgram) => {
    setFormMode('edit');
    setFormData({
      id: studyProgram.id,
      name: studyProgram.name,
      level: studyProgram.level,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const payload = {
      id: formData.id.trim(),
      name: formData.name.trim(),
      level: formData.level.trim(),
    };

    if (!payload.id || !payload.name || !payload.level) {
      setFormError('Kode NIM, nama program studi, dan jenjang wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = formMode === 'create'
        ? await api('/api/study-programs', { method: 'POST', data: payload })
        : await api(`/api/study-programs/${formData.id}`, { method: 'PUT', data: payload });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menyimpan program studi');
      }

      showToast?.(
        `Program studi berhasil ${formMode === 'create' ? 'ditambahkan' : 'diperbarui'}`,
        'success'
      );
      setIsFormModalOpen(false);
      await fetchStudyPrograms();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan program studi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studyProgramToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api(`/api/study-programs/${studyProgramToDelete.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghapus program studi');
      }

      showToast?.('Program studi berhasil dihapus', 'success');
      setStudyProgramToDelete(null);
      await fetchStudyPrograms();
    } catch (err) {
      showToast?.(
        err instanceof Error ? err.message : 'Gagal menghapus program studi',
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Program Studi"
        description="Kelola kode awal NIM, jenjang, dan nama program studi."
        actions={
          <Button onClick={openCreateModal} variant="primary" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Program Studi
          </Button>
        }
      />

      <PageCard padding="none" className="overflow-hidden rounded-2xl border-slate-200 dark:border-gray-700">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50 sm:flex-row">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari kode, jenjang, atau program studi..."
          />
          <div className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
            Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredStudyPrograms.length}</span> program studi
          </div>
        </div>

          <Table className="whitespace-nowrap text-left text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6">Kode Awal NIM</TableHead>
                <TableHead className="px-6">Jenjang</TableHead>
                <TableHead className="px-6">Nama Program Studi</TableHead>
                <TableHead className="w-24 px-6">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-200 dark:divide-gray-700">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <span>Memuat data program studi...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-10 text-center text-red-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-6 w-6" />
                      <span>{error}</span>
                      <button type="button" onClick={fetchStudyPrograms} className="text-sm underline">
                        Coba Lagi
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada program studi yang ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((studyProgram) => (
                  <TableRow key={studyProgram.id} className="group transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/80">
                    <TableCell className="px-6 py-4 font-mono font-semibold text-slate-900 dark:text-white">{studyProgram.id}</TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {studyProgram.level}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-slate-600 dark:text-slate-300">{studyProgram.name}</TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(studyProgram)}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-blue-600 dark:text-blue-400')}
                          aria-label={`Edit program studi ${studyProgram.name}`}
                          title="Edit Program Studi"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudyProgramToDelete(studyProgram)}
                          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-red-600 dark:text-red-400')}
                          aria-label={`Hapus program studi ${studyProgram.name}`}
                          title="Hapus Program Studi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredStudyPrograms.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </PageCard>

      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {formMode === 'create' ? 'Tambah Program Studi' : 'Edit Program Studi'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'text-slate-500 dark:text-slate-300')}
                aria-label="Tutup form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kode Awal NIM <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.id}
                  onChange={(event) => setFormData({ ...formData, id: event.target.value })}
                  disabled={formMode === 'edit'}
                  placeholder="Contoh: 67"
                  maxLength={10}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kode dipakai sebagai awalan NIM dan tidak dapat diubah setelah dibuat.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Jenjang <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.level}
                  onChange={(event) => setFormData({ ...formData, level: event.target.value })}
                  placeholder="Contoh: Sarjana"
                  maxLength={50}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Program Studi <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  placeholder="Contoh: Teknik Informatika"
                  maxLength={255}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" onClick={() => setIsFormModalOpen(false)} variant="secondary">
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} variant="primary">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(studyProgramToDelete)}
        onClose={() => setStudyProgramToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Program Studi"
        message={`Hapus ${studyProgramToDelete?.level || ''} ${studyProgramToDelete?.name || ''}? Relasi dosen ke program studi ini akan dikosongkan.`}
        confirmText="Ya, Hapus"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default StudyProgramManagement;
