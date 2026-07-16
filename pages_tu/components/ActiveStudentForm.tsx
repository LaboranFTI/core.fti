import {
  CheckCircle as CheckCircle2,
  GraduationCap,
  SpinnerGap as Loader2,
  Plus,
  MagnifyingGlass as Search,
  PaperPlaneTilt as Send,
  Trash as Trash2,
  X,
  XCircle
} from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { api } from '../../services/api';
import { useStudyPrograms } from '../../hooks/useStudyPrograms';
import {
  buildBirthPlaceAndDate,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  findStudyProgramByNim
} from './activeStudentUtils';

interface ActiveStudentFormValues {
  nim: string;
  email: string;
  name: string;
  birthPlace: string;
  birthDate: string;
  birthPlaceAndDate: string;
  studyProgramLevel: string;
  studyProgramName: string;
  faculty: string;
  university: string;
  carbonCopies?: { role: string; name?: string }[];
}

const getInitialActiveStudentCc = () => {
  try {
    const saved = localStorage.getItem('core_fti_last_active_student_cc');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load active student carbon copies:', e);
  }
  return [];
};

const defaultFormValues: ActiveStudentFormValues = {
  nim: '',
  email: '',
  name: '',
  birthPlace: '',
  birthDate: '',
  birthPlaceAndDate: '',
  studyProgramLevel: '',
  studyProgramName: '',
  faculty: DEFAULT_FACULTY,
  university: DEFAULT_UNIVERSITY,
  carbonCopies: []
};

const buildStudentEmail = (identifier?: string) => {
  const cleanIdentifier = String(identifier || '').trim();
  return cleanIdentifier ? `${cleanIdentifier}@student.uksw.edu` : '';
};

interface ActiveStudentFormProps {
  onReturnToMenu?: () => void;
}

export function ActiveStudentForm({ onReturnToMenu }: ActiveStudentFormProps) {
  const { register, handleSubmit, watch, reset, setValue, control } = useForm<ActiveStudentFormValues>({
    defaultValues: {
      ...defaultFormValues,
      carbonCopies: getInitialActiveStudentCc()
    }
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "carbonCopies"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const nimValue = watch('nim');
  const [useStudentEmail, setUseStudentEmail] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { studyPrograms, fetchStudyPrograms } = useStudyPrograms();

  const resetVerifiedFields = () => {
    setValue('name', '');
    setValue('birthPlace', '');
    setValue('birthDate', '');
    setValue('birthPlaceAndDate', '');
    setValue('studyProgramLevel', '');
    setValue('studyProgramName', '');
    setValue('faculty', DEFAULT_FACULTY);
    setValue('university', DEFAULT_UNIVERSITY);
  };

  const resetFormState = () => {
    reset({
      ...defaultFormValues,
      carbonCopies: getInitialActiveStudentCc()
    });
    setUseStudentEmail(false);
    resetVerifiedFields();
    setIsVerified(false);
    setVerifyError('');
    setFormFeedback(null);
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
    if (!isVerified) {
      setVerifyError('');
    }
  }, [nimValue, isVerified]);

  useEffect(() => {
    if (useStudentEmail) {
      setValue('email', buildStudentEmail(nimValue), { shouldDirty: true, shouldValidate: true });
    }
  }, [useStudentEmail, nimValue, setValue]);

  const handleVerifyKST = async () => {
    if (!nimValue) {
      setVerifyError('Silakan masukkan NIM terlebih dahulu.');
      return;
    }

    const programs = studyPrograms.length > 0 ? studyPrograms : await fetchStudyPrograms();
    const derivedStudyProgram = findStudyProgramByNim(nimValue, programs);
    if (!derivedStudyProgram) {
      setVerifyError('Kode program studi dari NIM belum dikenali. Hubungi admin TU untuk memperbarui pemetaan prodi.');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');
    setFormFeedback(null);

    try {
      const res = await api(`/api/siasat/kst/${nimValue}`);

      if (!res.ok) throw new Error('Gagal menghubungi server');

      const json = await res.json();
      if (!json.success || !json.data || json.data.length === 0) {
        setIsVerified(false);
        resetVerifiedFields();
        const semesterLabel = json.semester?.label || json.semester?.semesterCode || 'semester berjalan';
        setVerifyError(`KST tidak ditemukan untuk NIM ${nimValue} pada ${semesterLabel}. Pastikan Anda sudah registrasi KST.`);
        return;
      }

      const [nameRes, profileRes] = await Promise.all([
        api(`/api/siasat/mahasiswa/${nimValue}/nama`),
        api(`/api/siasat/mahasiswa/${nimValue}`)
      ]);

      if (!nameRes.ok || !profileRes.ok) {
        throw new Error('Gagal mengambil biodata mahasiswa dari SIASAT');
      }

      const [nameJson, profileJson] = await Promise.all([nameRes.json(), profileRes.json()]);
      const profileData = Array.isArray(profileJson.data) ? profileJson.data[0] : profileJson.data;
      const studentName = String(nameJson.data?.nama || '').trim();
      const birthPlace = String(profileData?.kotasal || '').trim();
      const birthDate = String(profileData?.tgllahir || '').trim();
      const birthPlaceAndDate = buildBirthPlaceAndDate(birthPlace, birthDate);

      if (!studentName || !birthPlaceAndDate) {
        setIsVerified(false);
        resetVerifiedFields();
        setVerifyError('Data profil mahasiswa di SIASAT belum lengkap. Pastikan nama serta tempat dan tanggal lahir tersedia.');
        return;
      }

      setValue('name', studentName);
      setValue('birthPlace', birthPlace);
      setValue('birthDate', birthDate);
      setValue('birthPlaceAndDate', birthPlaceAndDate);
      setValue('studyProgramLevel', derivedStudyProgram.studyProgramLevel);
      setValue('studyProgramName', derivedStudyProgram.studyProgramName);
      setValue('faculty', DEFAULT_FACULTY);
      setValue('university', DEFAULT_UNIVERSITY);
      setIsVerified(true);
    } catch (error) {
      console.error(error);
      setIsVerified(false);
      resetVerifiedFields();
      setVerifyError('Terjadi kesalahan saat memverifikasi KST dan biodata mahasiswa. Coba lagi nanti.');
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (data: ActiveStudentFormValues) => {
    setIsSubmitting(true);
    setFormFeedback(null);
    try {
      const payload = {
        name: data.name,
        nim: data.nim,
        email: data.email,
        birthPlace: data.birthPlace,
        birthDate: data.birthDate,
        studyProgramLevel: data.studyProgramLevel,
        studyProgramName: data.studyProgramName,
        faculty: data.faculty,
        university: data.university
      };

      const response = await api('/api/active-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          carbonCopies: data.carbonCopies || []
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        throw new Error(errorJson?.error || 'Terjadi kesalahan saat mengirim permohonan.');
      }

      localStorage.setItem('core_fti_last_active_student_cc', JSON.stringify(data.carbonCopies || []));
      setSubmitSuccess(true);
      resetFormState();
    } catch (error) {
      console.error('Error submitting form:', error);
      setFormFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.'
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
            Permohonan Surat Keterangan Aktif Kuliah Anda telah masuk ke sistem.
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
    <>
      <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden">
        <CardHeader className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-800 dark:text-white font-bold">Surat Keterangan Aktif Kuliah</CardTitle>
              <CardDescription className="text-slate-500 dark:text-gray-400">Verifikasi KST terlebih dahulu, lalu sistem akan mengisi biodata surat sesuai SIASAT.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">


            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className={`rounded-lg border px-4 py-3 ${isVerified ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Langkah 1</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">Verifikasi KST</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Masukkan NIM lalu cek status aktif pada semester berjalan.</p>
              </div>
              <div className={`rounded-lg border px-4 py-3 ${isVerified ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Langkah 2</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">Cek Biodata Surat</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nama, TTL, jenjang, dan prodi akan terisi otomatis sesuai NIM.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Langkah 3</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">Ajukan Permohonan</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lengkapi email lalu kirim permohonan ke TU.</p>
              </div>
            </div>

            <div className="space-y-4">


              <div className="space-y-1.5">
                <Label htmlFor="nim" className="text-slate-700 dark:text-slate-300 font-medium">NIM</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="nim"
                    placeholder="Contoh: 682022013"
                    {...register("nim", { required: true })}
                    readOnly={isVerified}
                    className={isVerified ? "bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 sm:flex-1" : "sm:flex-1"}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!isVerified && !isVerifying && nimValue) {
                          handleVerifyKST();
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
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {!isVerified && (
                      <Button type="button" onClick={handleVerifyKST} disabled={isVerifying || !nimValue} className="flex-1 bg-blue-600 hover:bg-blue-700 sm:flex-none">
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        {isVerifying ? 'Memeriksa...' : 'Cek KST'}
                      </Button>
                    )}
                  </div>
                </div>
                {!isVerified && !verifyError && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verifikasi ini memastikan mahasiswa memiliki KST pada semester berjalan sebelum surat diajukan.
                  </p>
                )}
                {verifyError && <p className="text-sm text-red-500 flex items-center mt-1"><XCircle className="w-4 h-4 mr-1" /> {verifyError}</p>}
                {isVerified && (
                  <p className="text-sm text-green-600 flex items-center mt-1 font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> KST terverifikasi. Biodata surat berhasil disiapkan.
                  </p>
                )}
              </div>

              {isVerified && (
                <div className="mt-6 space-y-6 border-t border-slate-100 pt-6 dark:border-slate-700/50">
                  <input type="hidden" {...register("birthPlace")} />
                  <input type="hidden" {...register("birthDate")} />
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
                    Data surat di bawah ini diambil dari SIASAT, jika menemukan ketidaksesuaian data mohon mengurus ke GAP Universitas terlebih dahulu.
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-slate-700 dark:text-slate-300 font-medium">Nama Mahasiswa</Label>
                      <Input id="name" {...register("name")} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="birthPlaceAndDate" className="text-slate-700 dark:text-slate-300 font-medium">Tempat &amp; Tanggal Lahir</Label>
                      <Input id="birthPlaceAndDate" {...register("birthPlaceAndDate")} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="studyProgramLevel" className="text-slate-700 dark:text-slate-300 font-medium">Jenjang Program</Label>
                      <Input id="studyProgramLevel" {...register("studyProgramLevel")} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="studyProgramName" className="text-slate-700 dark:text-slate-300 font-medium">Program Studi</Label>
                      <Input id="studyProgramName" {...register("studyProgramName")} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="faculty" className="text-slate-700 dark:text-slate-300 font-medium">Fakultas</Label>
                      <Input id="faculty" {...register("faculty")} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="university" className="text-slate-700 dark:text-slate-300 font-medium">Universitas</Label>
                      <Input id="university" {...register("university")} readOnly className="bg-slate-50 dark:bg-slate-900/50" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">Email (wajib)</Label>
                      <label htmlFor="active-student-email-student" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <input
                          id="active-student-email-student"
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
                      id="email"
                      type="email"
                      placeholder={useStudentEmail ? "682022013@student.uksw.edu" : "nama@domain.com"}
                      readOnly={useStudentEmail}
                      className={useStudentEmail ? "bg-slate-50 dark:bg-slate-900/50" : undefined}
                      {...register("email", { required: true })}
                      required
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                      {formFeedback && (
                        <div className={`rounded-lg border px-4 py-3 text-sm ${formFeedback.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                          }`}>
                          {formFeedback.message}
                        </div>
                      )}
                    </div>
                    <Button type="submit" className="h-11 w-full bg-blue-600 text-base text-white hover:bg-blue-700 sm:w-auto sm:min-w-52" disabled={isSubmitting}>
                      {isSubmitting ? 'Mengirim Permohonan...' : (
                        <>
                          <Send className="w-4 h-4 mr-2" /> Ajukan Permohonan
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

    </>
  );
}
