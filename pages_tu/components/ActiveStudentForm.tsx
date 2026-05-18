import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { GraduationCap, Send, CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import {
  buildBirthPlaceAndDate,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY,
  deriveStudyProgramFromNim
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
}

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
  university: DEFAULT_UNIVERSITY
};

export function ActiveStudentForm() {
  const { register, handleSubmit, watch, reset, setValue } = useForm<ActiveStudentFormValues>({
    defaultValues: defaultFormValues
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const nimValue = watch('nim');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    reset(defaultFormValues);
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

  const handleVerifyKST = async () => {
    if (!nimValue) {
      setVerifyError('Silakan masukkan NIM terlebih dahulu.');
      return;
    }

    const derivedStudyProgram = deriveStudyProgramFromNim(nimValue);
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
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        throw new Error(errorJson?.error || 'Terjadi kesalahan saat mengirim permohonan.');
      }

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
      <Card className="w-full max-w-2xl mx-auto shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden text-center py-12">
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
            }}
            className="mt-6 border-slate-300 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            variant="outline"
          >
            Buat Permohonan Baru
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden">
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
            {formFeedback && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${formFeedback.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                }`}>
                {formFeedback.message}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className={`rounded-2xl border px-4 py-3 ${isVerified ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Langkah 1</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">Verifikasi KST</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Masukkan NIM lalu cek status aktif pada semester berjalan.</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${isVerified ? 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Langkah 2</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">Cek Biodata Surat</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nama, TTL, jenjang, dan prodi akan terisi otomatis sesuai NIM.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Langkah 3</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">Ajukan Permohonan</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lengkapi email lalu kirim permohonan ke TU.</p>
              </div>
            </div>

            <div className="space-y-4">


              <div className="space-y-1.5">
                <Label htmlFor="nim" className="text-slate-700 dark:text-slate-300 font-medium">NIM</Label>
                <div className="flex gap-3">
                  <Input
                    id="nim"
                    placeholder="Contoh: 672019000"
                    {...register("nim", { required: true })}
                    readOnly={isVerified}
                    className={isVerified ? "bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400" : ""}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!isVerified && !isVerifying && nimValue) {
                          handleVerifyKST();
                        }
                      }
                    }}
                  />
                  {!isVerified && (
                    <Button type="button" onClick={handleVerifyKST} disabled={isVerifying || !nimValue} className="shrink-0 bg-blue-600 hover:bg-blue-700">
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                      {isVerifying ? 'Memeriksa...' : 'Cek KST'}
                    </Button>
                  )}
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
                <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6 pt-6 mt-6 border-t border-slate-100 dark:border-slate-700/50">
                  <input type="hidden" {...register("birthPlace")} />
                  <input type="hidden" {...register("birthDate")} />
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
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
                    <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">Email (Untuk pengiriman surat)</Label>
                    <Input id="email" type="email" placeholder="nama@domain.com" {...register("email", { required: true })} />
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base" disabled={isSubmitting}>
                    {isSubmitting ? 'Mengirim Permohonan...' : (
                      <>
                        <Send className="w-4 h-4 mr-2" /> Ajukan Permohonan
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

    </>
  );
}
