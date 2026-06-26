import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FileText, Send, CheckCircle2, Loader2, Search, XCircle, Download, Printer, Mail, Key } from 'lucide-react';
import { api } from '../../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

interface SuRekFormValues {
  name: string;
  nim: string;
  email: string;
}

export function SuRekForm() {
  const { register, handleSubmit, reset } = useForm<SuRekFormValues>({
    defaultValues: {
      name: '',
      nim: '',
      email: ''
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<string>('request');
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
    setFormFeedback(null);
  };

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
    const printWindow = window.open(`/api/tu/public/letter-validation/${accessSearchResult.validationToken}/preview-html`, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  if (submitSuccess && createdRequest) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden text-center py-12">
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

          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 max-w-sm mx-auto text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold text-sm">
              <Key className="w-4 h-4 text-blue-500" />
              Kode Akses Pencarian:
            </div>
            <div className="text-xl font-mono font-bold tracking-wider text-center text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 py-2 rounded-xl border border-slate-200 dark:border-slate-700 select-all">
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
    <div className="mx-auto w-full max-w-2xl print:hidden">
      <Tabs value={activeFormTab} onValueChange={setActiveFormTab} className="w-full flex flex-col gap-6">
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger value="request" className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              Pengajuan Baru
            </TabsTrigger>
            <TabsTrigger value="track" className="flex items-center justify-center gap-2">
              <Key className="w-4 h-4" />
              Lacak & Unduh
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="request">
          {/* Form Pendaftaran Surat */}
          <Card className="shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden">
            <CardHeader className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-800 dark:text-white font-bold">Surat Rekomendasi Afirmasi</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-gray-400">Ajukan surat rekomendasi afirmasi cemerlang dengan mengisi nama, nomor formulir/NIM, dan email aktif.</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
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
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">Email Aktif</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contoh: nama@student.uksw.edu"
                    {...register("email", { required: true })}
                  />
                  <p className="text-xs text-slate-400">
                    Kode akses permohonan akan dikirim ke email ini.
                  </p>
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base animate-none" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mengajukan permohonan...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Ajukan Surat Rekomendasi
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="track">
          {/* Card Lacak/Akses Surat */}
          <Card className="shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <CardTitle className="text-base text-slate-800 dark:text-white font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-500" />
                Lacak & Unduh Surat Rekomendasi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <form onSubmit={handleLookupAccessCode} className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Masukkan Kode Akses (REK-XXXX-XXXX)"
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value)}
                    className="uppercase font-mono tracking-wider"
                  />
                </div>
                <Button id="btn-lookup-access" type="submit" disabled={isSearchingAccess} className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600">
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
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-800 animate-in fade-in duration-300">
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
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} size="sm" variant="outline" className="flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 text-xs">
                          {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Unduh PDF
                        </Button>
                        <Button onClick={handlePrintLetter} size="sm" variant="outline" className="flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 text-xs">
                          <Printer className="w-3.5 h-3.5" />
                          Cetak Surat
                        </Button>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail} size="sm" variant="outline" className="col-span-2 flex items-center justify-center gap-1.5 border-slate-200 dark:border-slate-700 text-xs">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
