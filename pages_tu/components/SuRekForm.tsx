import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { FileText, Send, CheckCircle2, Loader2, Search, XCircle, Download, Printer, Mail, Key, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { API_BASE_URL } from '../../config';
import { LetterFormHeader, LetterModeTabs } from './LetterFormControls';

interface SuRekFormValues {
  name: string;
  nim: string;
  email: string;
}

const buildStudentEmail = (identifier?: string) => {
  const cleanIdentifier = String(identifier || '').trim();
  return cleanIdentifier ? `${cleanIdentifier}@student.uksw.edu` : '';
};

export function SuRekForm() {
  const { register, handleSubmit, reset, watch, setValue } = useForm<SuRekFormValues>({
    defaultValues: {
      name: '',
      nim: '',
      email: ''
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'request' | 'track'>('request');
  const identifierValue = watch('nim');
  const [useStudentEmail, setUseStudentEmail] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<{
    id: string;
    accessCode: string;
    email?: string;
    accessEmail?: { sent?: boolean; error?: string | null; previewUrl?: string | null };
  } | null>(null);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Access Code Lookup state
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [isSearchingAccess, setIsSearchingAccess] = useState(false);
  const [accessSearchResult, setAccessSearchResult] = useState<any | null>(null);
  const [accessSearchError, setAccessSearchError] = useState('');

  // Print/Download/Email actions on lookup result
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const resetFormState = () => {
    reset({ name: '', nim: '', email: '' });
    setUseStudentEmail(false);
    setFormFeedback(null);
  };

  useEffect(() => {
    if (useStudentEmail) {
      setValue('email', buildStudentEmail(identifierValue), { shouldDirty: true, shouldValidate: true });
    }
  }, [useStudentEmail, identifierValue, setValue]);

  const onSubmit = async (data: SuRekFormValues) => {
    setIsSubmitting(true);
    setFormFeedback(null);
    try {
      const response = await api('/api/su-rek-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          nim: data.nim,
          email: data.email
        })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || 'Terjadi kesalahan saat mengirim permohonan.');
      }

      setCreatedRequest({
        id: json.id,
        accessCode: json.accessCode,
        email: json.email || data.email,
        accessEmail: json.accessEmail
      });
      setSubmitSuccess(true);
      resetFormState();
    } catch (error) {
      console.error('Error submitting su-rek request:', error);
      setFormFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim data. Silakan coba lagi.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookupAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCodeInput.trim()) {
      setAccessSearchError('Masukkan kode akses terlebih dahulu.');
      return;
    }

    setIsSearchingAccess(true);
    setAccessSearchError('');
    setAccessSearchResult(null);
    setEmailStatus(null);

    try {
      const response = await api('/api/tu/public/su-rek/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: accessCodeInput.trim() })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || 'Kode akses tidak ditemukan.');
      }

      setAccessSearchResult(json.letter);
    } catch (err) {
      setAccessSearchError(err instanceof Error ? err.message : 'Gagal memuat detail surat.');
    } finally {
      setIsSearchingAccess(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!accessSearchResult) return;
    setIsDownloadingPdf(true);
    try {
      const response = await api('/api/tu/public/su-rek/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: accessSearchResult.accessCode })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        throw new Error(errorJson?.error || 'Gagal mengunduh PDF.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeNum = (accessSearchResult.letterNumber || 'rekomendasi').replace(/\//g, '_');
      a.download = `${safeNum}_${accessSearchResult.data.nim}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengunduh PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!accessSearchResult) return;
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const response = await api('/api/tu/public/su-rek/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: accessSearchResult.accessCode })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        throw new Error(errorJson?.error || 'Gagal mengirim email.');
      }

      setEmailStatus('Email berhasil dikirim ke alamat terdaftar.');
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : 'Gagal mengirim email secara langsung. Silakan unduh PDF atau coba lagi nanti.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrintLetter = () => {
    if (!accessSearchResult || !accessSearchResult.validationToken) return;
    const previewUrl = `${API_BASE_URL}/api/tu/public/letter-validation/${accessSearchResult.validationToken}/preview-html`;
    const printWindow = window.open(previewUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  if (submitSuccess && createdRequest) {
    return (
      <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden text-center py-12">
        <CardContent className="space-y-4 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Permohonan Terkirim!</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Permohonan Surat Rekomendasi Afirmasi Cemerlang berhasil didaftarkan ke sistem Tata Usaha.
            Kode akses juga dikirim ke email yang Anda daftarkan.
          </p>

          {createdRequest.accessEmail?.sent ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
              Kode akses sudah dikirim ke {createdRequest.email}.
            </div>
          ) : createdRequest.accessEmail?.error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              {createdRequest.accessEmail.error}
            </div>
          ) : null}

          <div className="mx-auto max-w-sm space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-left dark:border-slate-700 dark:bg-slate-800/80">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold text-sm">
              <Key className="w-4 h-4 text-blue-500" />
              Kode Akses Pencarian:
            </div>
            <div className="select-all rounded-lg border border-slate-200 bg-white py-2 text-center font-mono text-xl font-bold text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400">
              {createdRequest.accessCode}
            </div>
            <p className="text-xs text-slate-400 text-center">
              Simpan kode ini untuk mengecek status persetujuan, mengunduh PDF, atau mencetak surat.
            </p>
          </div>

          <div className="flex gap-4 justify-center mt-6">
            <Button
              onClick={() => {
                setSubmitSuccess(false);
                setCreatedRequest(null);
                resetFormState();
              }}
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Buat Pengajuan Baru
            </Button>
            <Button
              onClick={() => {
                setAccessCodeInput(createdRequest.accessCode);
                setSubmitSuccess(false);
                setCreatedRequest(null);
                setActiveFormTab('track');
                // Trigger lookup immediately
                setTimeout(() => {
                  const lookupBtn = document.getElementById('btn-lookup-access');
                  if (lookupBtn) lookupBtn.click();
                }, 100);
              }}
              variant="outline"
              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
            >
              Lihat Detail Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full print:hidden">
      <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden">
        <CardHeader className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
          <LetterFormHeader
            title={activeFormTab === 'request' ? 'Buat Surat Rekomendasi Baru' : 'Buka Surat Rekomendasi Lama'}
            description={
              activeFormTab === 'request'
                ? 'Lengkapi data permohonan baru. Kode akses akan dikirim ke email aktif.'
                : 'Masukkan kode akses untuk mengecek status, mengunduh PDF, atau mencetak surat.'
            }
            action={
              <LetterModeTabs<'request' | 'track'>
                value={activeFormTab}
                onChange={setActiveFormTab}
                items={[
                  { value: 'request', label: 'Buat Surat Baru', icon: Plus },
                  { value: 'track', label: 'Buka Surat Lama', icon: FileText }
                ]}
              />
            }
          />
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            <div className="px-6 py-4 bg-blue-50/80 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
              {activeFormTab === 'request'
                ? 'Surat rekomendasi afirmasi ini diajukan dengan data mahasiswa dan email aktif. Data akan masuk ke arsip, lalu TU memverifikasi sebelum surat bisa diunduh.'
                : 'Gunakan kode akses yang dikirim ke email atau tampil setelah pengajuan. Surat lama bisa dicek dan diunduh setelah diverifikasi TU.'}
            </div>

            {activeFormTab === 'request' ? (
              <div className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {formFeedback && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${formFeedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    {formFeedback.message}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-slate-700 dark:text-slate-300 font-medium">Nama Lengkap Mahasiswa</Label>
                  <Input
                    id="name"
                    placeholder="Contoh: Kenanya Nadine Dwied Permata"
                    {...register("name", { required: true })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nim" className="text-slate-700 dark:text-slate-300 font-medium">NIM atau No Formulir</Label>
                  <Input
                    id="nim"
                    placeholder="Contoh: 682021001 atau AE0419-68"
                    {...register("nim", { required: true })}
                  />
                  <p className="text-xs text-slate-400">
                    Untuk calon mahasiswa baru, gunakan nomor formulir pendaftaran lengkap dengan akhiran kode program studi (misal: -68 untuk SI).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">Email Aktif</Label>
                    <label htmlFor="su-rek-email-student" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <input
                        id="su-rek-email-student"
                        type="checkbox"
                        checked={useStudentEmail}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setUseStudentEmail(checked);
                          setValue('email', checked ? buildStudentEmail(identifierValue) : '', {
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
                    placeholder={useStudentEmail ? "682022013@student.uksw.edu" : "contoh: nama@student.uksw.edu"}
                    readOnly={useStudentEmail}
                    className={useStudentEmail ? "bg-slate-50 dark:bg-slate-900/50" : undefined}
                    {...register("email", { required: true })}
                    required
                  />
                  <p className="text-xs text-slate-400">
                    Kode akses permohonan akan dikirim ke email ini.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="h-11 w-full bg-blue-600 text-base text-white hover:bg-blue-700 sm:w-auto sm:min-w-56" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mengajukan permohonan...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Ajukan Surat Rekomendasi
                      </>
                    )}
                  </Button>
                </div>
              </form>
              </div>
            ) : (
              <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-lg">Buka Surat Lama dengan Kode</h3>
              </div>
              <form onSubmit={handleLookupAccessCode} className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Masukkan Kode Akses (REK-XXXX-XXXX)"
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value)}
                    className="font-mono uppercase"
                  />
                </div>
                <Button
                  id="btn-lookup-access"
                  type="submit"
                  disabled={isSearchingAccess}
                  className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                  aria-label="Cari surat berdasarkan kode akses"
                >
                  {isSearchingAccess ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>

              {accessSearchError && (
                <p className="text-sm text-red-500 flex items-center mt-1">
                  <XCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                  {accessSearchError}
                </p>
              )}

              {accessSearchResult && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">{accessSearchResult.data.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{accessSearchResult.data.nim}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      accessSearchResult.status === 'verified' || accessSearchResult.status === 'sent'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300'
                    }`}>
                      {accessSearchResult.status === 'verified' || accessSearchResult.status === 'sent' ? 'Resmi / Terverifikasi' : 'Menunggu Verifikasi'}
                    </span>
                  </div>

                  {(accessSearchResult.status === 'verified' || accessSearchResult.status === 'sent') ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">Surat Anda sudah ditandatangani secara digital. Silakan pilih aksi:</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} size="sm" variant="outline" className="w-full justify-center gap-1.5 border-slate-200 text-xs dark:border-slate-700 sm:w-auto">
                          {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Unduh PDF
                        </Button>
                        <Button onClick={handlePrintLetter} size="sm" variant="outline" className="w-full justify-center gap-1.5 border-slate-200 text-xs dark:border-slate-700 sm:w-auto">
                          <Printer className="w-3.5 h-3.5" />
                          Cetak Surat
                        </Button>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail} size="sm" variant="outline" className="w-full justify-center gap-1.5 border-slate-200 text-xs dark:border-slate-700 sm:w-auto">
                          {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          Kirim Salinan Ke Email
                        </Button>
                      </div>
                      {emailStatus && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center bg-blue-50 dark:bg-blue-950/20 py-1.5 px-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
                          {emailStatus}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/40 rounded-lg text-xs text-yellow-700 dark:text-yellow-300">
                      Surat rekomendasi Anda sedang menunggu validasi dari Tata Usaha. Pengaturan nomor surat resmi dan tanda tangan digital dekanat sedang diproses. Silakan cek berkala.
                    </div>
                  )}
                </div>
              )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
