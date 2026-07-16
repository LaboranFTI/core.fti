import {
  CheckCircle as CheckCircle2,
  FileText,
  SpinnerGap as Loader2,
  MagnifyingGlass as Search,
  PaperPlaneTilt as Send,
  X,
  XCircle
} from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { api } from '../../services/api';
import { useStudyPrograms } from '../../hooks/useStudyPrograms';
import { findStudyProgramByNim } from './activeStudentUtils';

interface CounselingFormValues {
  nim: string;
  email: string;
  name: string;
  studyProgramLevel: string;
  studyProgramName: string;
  faculty: string;
}

const defaultFormValues: CounselingFormValues = {
  nim: '',
  email: '',
  name: '',
  studyProgramLevel: '',
  studyProgramName: '',
  faculty: 'FTI'
};

const buildStudentEmail = (identifier?: string) => {
  const cleanIdentifier = String(identifier || '').trim();
  return cleanIdentifier ? `${cleanIdentifier}@student.uksw.edu` : '';
};

interface CounselingFormProps {
  onReturnToMenu?: () => void;
}

export function CounselingForm({ onReturnToMenu }: CounselingFormProps) {
  const { register, handleSubmit, watch, reset, setValue } = useForm<CounselingFormValues>({
    defaultValues: defaultFormValues
  });
  const nimValue = watch('nim');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [useStudentEmail, setUseStudentEmail] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { studyPrograms, fetchStudyPrograms } = useStudyPrograms();

  const resetVerifiedFields = () => {
    setValue('name', '');
    setValue('studyProgramLevel', '');
    setValue('studyProgramName', '');
    setValue('faculty', 'FTI');
  };

  const resetFormState = () => {
    reset(defaultFormValues);
    setIsVerified(false);
    setVerifyError('');
    setFormFeedback(null);
    setUseStudentEmail(false);
  };

  const handleClearNim = () => {
    setValue('nim', '', { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    setUseStudentEmail(false);
    setValue('email', '', { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    resetVerifiedFields();
    setIsVerified(false);
    setVerifyError('');
    setFormFeedback(null);
  };

  useEffect(() => {
    if (useStudentEmail) {
      setValue('email', buildStudentEmail(nimValue), { shouldDirty: true, shouldValidate: true });
    }
  }, [useStudentEmail, nimValue, setValue]);

  const handleVerifyStudent = async () => {
    if (!nimValue) {
      setVerifyError('Silakan masukkan NIM terlebih dahulu.');
      return;
    }

    const programs = studyPrograms.length > 0 ? studyPrograms : await fetchStudyPrograms();
    const derivedStudyProgram = findStudyProgramByNim(nimValue, programs);
    if (!derivedStudyProgram) {
      setVerifyError('Kode program studi dari NIM belum dikenali. Perbarui pemetaan prodi terlebih dahulu.');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');
    setFormFeedback(null);

    try {
      const nameRes = await api(`/api/siasat/mahasiswa/${nimValue}/nama`);
      if (!nameRes.ok) {
        throw new Error('Gagal mengambil nama mahasiswa dari SIASAT.');
      }

      const nameJson = await nameRes.json();
      const studentName = String(nameJson.data?.nama || '').trim();
      if (!studentName) {
        setIsVerified(false);
        resetVerifiedFields();
        setVerifyError('Nama mahasiswa tidak ditemukan di SIASAT.');
        return;
      }

      setValue('name', studentName);
      setValue('studyProgramLevel', derivedStudyProgram.studyProgramLevel);
      setValue('studyProgramName', derivedStudyProgram.studyProgramName);
      setValue('faculty', 'FTI');
      setIsVerified(true);
    } catch (error) {
      console.error(error);
      setIsVerified(false);
      resetVerifiedFields();
      setVerifyError(error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data SIASAT.');
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (data: CounselingFormValues) => {
    if (!isVerified) {
      setFormFeedback({ type: 'error', message: 'Cek data mahasiswa dari SIASAT terlebih dahulu.' });
      return;
    }
    if (!data.email.trim()) {
      setFormFeedback({ type: 'error', message: 'Email tujuan wajib diisi.' });
      return;
    }

    setIsSubmitting(true);
    setFormFeedback(null);

    try {
      const response = await api('/api/counseling-requests', {
        method: 'POST',
        data: {
          name: data.name,
          nim: data.nim,
          email: data.email,
          studyProgramLevel: data.studyProgramLevel,
          studyProgramName: data.studyProgramName,
          faculty: data.faculty
        }
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Gagal mengirim permohonan surat pengantar konseling.');
      }

      setSubmitSuccess(true);
      resetFormState();
    } catch (error) {
      console.error('Error submitting counseling letter:', error);
      setFormFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim permohonan. Silakan coba lagi.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden text-center py-12">
        <CardContent className="space-y-4 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Permohonan Berhasil Dikirim!</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Permohonan Surat Pengantar Konseling Anda telah masuk ke sistem.
            Admin akan melakukan verifikasi dan surat akan dikirimkan ke email Anda.
          </p>
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
            Pastikan email yang Anda masukkan aktif agar surat bisa diterima tanpa hambatan.
          </div>
          <Button
            onClick={() => {
              setSubmitSuccess(false);
              resetFormState();
              onReturnToMenu?.();
            }}
            className="mt-6 border-slate-300 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            variant="outline"
          >
            Selesai & Kembali ke Menu
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden border-0 shadow-xl ring-1 ring-slate-900/5 dark:ring-gray-700">
      <CardHeader className="border-b border-gray-200 bg-gray-50 px-6 py-5 dark:border-gray-700 dark:bg-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-slate-800 dark:text-white">Surat Pengantar Konseling</CardTitle>
            <CardDescription className="text-slate-500 dark:text-gray-400">
              Ajukan permohonan surat pengantar konseling. Setelah disetujui admin, surat akan dikirim ke email Anda.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className={`rounded-lg border px-4 py-3 ${isVerified ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Langkah 1</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-white">Cek SIASAT</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Masukkan NIM lalu cek status profil Anda di SIASAT.</p>
            </div>
            <div className={`rounded-lg border px-4 py-3 ${isVerified ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Langkah 2</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-white">Cek Data</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nama, jenjang, dan prodi akan terisi otomatis.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Langkah 3</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-white">Ajukan Permohonan</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lengkapi email tujuan lalu kirim permohonan ke TU.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counseling-nim" className="font-medium text-slate-700 dark:text-slate-300">NIM</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="counseling-nim"
                placeholder="Contoh: 682022013"
                {...register('nim', { required: true })}
                readOnly={isVerified}
                className={isVerified ? 'bg-slate-50 text-slate-500 dark:bg-slate-900/50 dark:text-slate-400 sm:flex-1' : 'sm:flex-1'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!isVerified && !isVerifying && nimValue) {
                      handleVerifyStudent();
                    }
                  }
                }}
              />
              <div className="flex gap-3 sm:shrink-0">
                {nimValue && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleClearNim}
                    disabled={isVerifying}
                    aria-label="Bersihkan NIM"
                    title="Bersihkan NIM"
                    className="border-slate-300 text-slate-600 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {!isVerified && (
                  <Button type="button" onClick={handleVerifyStudent} disabled={isVerifying || !nimValue} className="flex-1 bg-blue-600 hover:bg-blue-700 sm:flex-none">
                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    {isVerifying ? 'Memeriksa...' : 'Cek SIASAT'}
                  </Button>
                )}
              </div>
            </div>
            {verifyError && <p className="mt-1 flex items-center text-sm text-red-500"><XCircle className="mr-1 h-4 w-4" /> {verifyError}</p>}
            {isVerified && (
              <p className="mt-1 flex items-center text-sm font-medium text-green-600">
                <CheckCircle2 className="mr-1 h-4 w-4" /> Data mahasiswa berhasil diambil dari SIASAT.
              </p>
            )}
          </div>

          {isVerified && (
            <div className="space-y-5 border-t border-slate-100 pt-6 dark:border-slate-700/50">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="counseling-name" className="font-medium text-slate-700 dark:text-slate-300">Nama Mahasiswa</Label>
                  <Input id="counseling-name" {...register('name')} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="counseling-program" className="font-medium text-slate-700 dark:text-slate-300">Fak/Progdi</Label>
                  <Input
                    id="counseling-program"
                    value={`${watch('faculty')} - ${watch('studyProgramLevel')} ${watch('studyProgramName')}`.trim()}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>
              </div>

              <input type="hidden" {...register('studyProgramLevel')} />
              <input type="hidden" {...register('studyProgramName')} />
              <input type="hidden" {...register('faculty')} />

              <div className="space-y-1.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="counseling-email" className="font-medium text-slate-700 dark:text-slate-300">Email Tujuan (wajib)</Label>
                  <label htmlFor="counseling-email-student" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <input
                      id="counseling-email-student"
                      type="checkbox"
                      checked={useStudentEmail}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setUseStudentEmail(checked);
                        setValue('email', checked ? buildStudentEmail(nimValue) : '', {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500"
                    />
                    Email student?
                  </label>
                </div>
                <Input
                  id="counseling-email"
                  type="email"
                  placeholder={useStudentEmail ? `${nimValue || '682022013'}@student.uksw.edu` : "nama@domain.com"}
                  readOnly={useStudentEmail}
                  className={useStudentEmail ? "bg-slate-50 dark:bg-slate-900/50" : undefined}
                  {...register("email", { required: true })}
                  required
                />
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 w-full">
                  {formFeedback && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${
                      formFeedback.type === 'success'
                        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                    }`}>
                      {formFeedback.message}
                    </div>
                  )}
                </div>
                <Button type="submit" className="h-11 w-full bg-blue-600 text-base text-white hover:bg-blue-700 sm:w-auto sm:min-w-52" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengirim Permohonan...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Ajukan Permohonan
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
