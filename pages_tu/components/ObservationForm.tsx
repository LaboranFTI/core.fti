import React, { useState, useEffect, useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ObservationData } from '../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Plus, Trash2, Printer, Download, Building2, GraduationCap, Users, Loader2, QrCode, X, ChevronDown, FileText } from 'lucide-react';
import SearchableSelect, { SelectOption } from '../../components/SearchableSelect';
import { useStudyPrograms } from '../../hooks/useStudyPrograms';
import { useLecturers } from '../../hooks/useLecturers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../../components/ui/alert-dialog';

interface ObservationFormProps {
  onDataChange: (data: ObservationData) => void;
  onPrint: () => void;
  readOnly?: boolean;
  feedback?: {
    type: 'success' | 'error' | 'info';
    message: string;
  } | null;
}

export function ObservationForm({ onDataChange, onPrint, readOnly = false, feedback = null }: ObservationFormProps) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [formFeedback, setFormFeedback] = useState(feedback);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isFinalizingPrint, setIsFinalizingPrint] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pdf' | 'qr' | 'print' | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Program Studi & Dosen data
  const { studyPrograms, fetchKaprodi } = useStudyPrograms();
  const { lecturers } = useLecturers();
  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [isProdiSelected, setIsProdiSelected] = useState(false);
  const [isFetchingKaprodi, setIsFetchingKaprodi] = useState(false);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { register, control, watch, getValues, setValue } = useForm<ObservationData>({
    defaultValues: {
      recipientName: '',
      companyName: '',
      companyAddress: '',
      courseName: '',
      lecturerName: '',
      headOfProgramName: '',
      studyProgramId: '',
      studyProgramName: '',
      studyProgramLevel: '',
      students: [{ name: '', nim: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "students"
  });

  // Build lecturer options for SearchableSelect
  const lecturerOptions: SelectOption[] = React.useMemo(() => {
    return lecturers.map(l => ({
      value: l.nama,
      label: l.nama,
      subLabel: l.id
    }));
  }, [lecturers]);

  const selectedLecturerName = watch('lecturerName') || '';

  // Handle prodi selection
  const handleProdiSelect = useCallback(async (prodiId: string) => {
    setSelectedProdiId(prodiId);

    if (!prodiId) {
      setIsProdiSelected(false);
      setValue('studyProgramId', '');
      setValue('studyProgramName', '');
      setValue('studyProgramLevel', '');
      setValue('headOfProgramName', '');
      return;
    }

    const selectedProdi = studyPrograms.find(sp => sp.id === prodiId);
    if (!selectedProdi) return;

    setValue('studyProgramId', selectedProdi.id);
    setValue('studyProgramName', selectedProdi.name);
    setValue('studyProgramLevel', selectedProdi.level);
    setIsProdiSelected(true);

    // Auto-fetch Kaprodi
    setIsFetchingKaprodi(true);
    try {
      const kaprodi = await fetchKaprodi(prodiId);
      if (kaprodi) {
        setValue('headOfProgramName', kaprodi.nama);
      } else {
        setValue('headOfProgramName', '');
      }
    } finally {
      setIsFetchingKaprodi(false);
    }
  }, [studyPrograms, fetchKaprodi, setValue]);

  // Watch for changes and pass them up
  React.useEffect(() => {
    onDataChange(getValues());
    const subscription = watch((value: any) => {
      onDataChange(value as ObservationData);
    });
    return () => subscription.unsubscribe();
  }, [getValues, watch, onDataChange]);

  const handleConfirm = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'pdf') {
      handleDownloadPdf();
    } else if (action === 'qr') {
      handleGenerateQr();
    } else if (action === 'print') {
      handleFinalizeAndPrint();
    }
  };

  const handleFinalizeAndPrint = async () => {
    setIsFinalizingPrint(true);
    setFormFeedback(null);
    try {
      const formData = getValues();
      const res = await api('/api/tu/observation-letter/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menghasilkan nomor surat.');

      const tds = document.querySelectorAll('td');
      tds.forEach(td => {
        if (td.textContent?.includes('AUTO/FTI-OBS/')) {
          td.textContent = json.letterNumber;
        }
      });

      setFormFeedback({ type: 'success', message: 'Surat berhasil diarsipkan dengan nomor resmi.' });
      setTimeout(() => onPrint(), 300);
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal memproses cetak surat.' });
    } finally {
      setIsFinalizingPrint(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setFormFeedback(null);
    try {
      const formData = getValues();
      const res = await api('/api/tu/observation-letter/generate-and-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({ error: 'Gagal mengunduh PDF.' }));
        throw new Error(errorJson.error);
      }

      const blob = await res.blob();
      const companyName = getValues('companyName');
      const safeCompanyName = (companyName || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');
      const filename = `SuratObservasi_${safeCompanyName}.pdf`;

      const forceBrowserDownloadBlob = new Blob([blob], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(forceBrowserDownloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setFormFeedback({ type: 'success', message: 'Surat berhasil diunduh dan diarsipkan secara otomatis.' });
    } catch (error) {
      console.error('Failed to download PDF:', error);
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal mengunduh PDF.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleGenerateQr = async () => {
    setIsGeneratingQr(true);
    setFormFeedback(null);
    try {
      const formData = getValues();
      const res = await api('/api/tu/observation-letter/generate-qr-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menghasilkan QR Code.');
      }

      setQrUrl(json.qrUrl);
      setFormFeedback({ type: 'success', message: 'QR Code berhasil dibuat. Scan untuk mengunduh.' });
    } catch (error) {
      console.error('Failed to generate QR:', error);
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal menghasilkan QR Code.' });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Build prodi options for SearchableSelect
  const prodiOptions: SelectOption[] = React.useMemo(() => {
    return studyPrograms.map(sp => ({
      value: sp.id,
      label: `${sp.level} ${sp.name}`,
      subLabel: `Kode: ${sp.id}`
    }));
  }, [studyPrograms]);

  return (
    <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-visible">
      <CardHeader className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
        <CardTitle className="text-xl text-slate-800 dark:text-white font-bold">Formulir Pengisian</CardTitle>
        <CardDescription className="text-slate-500 dark:text-gray-400">Lengkapi data di bawah ini. Preview surat di sebelah kanan akan diperbarui otomatis.</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          <div className="px-6 py-4 bg-blue-50/80 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
            {readOnly
              ? 'Role Mahasiswa hanya memiliki akses baca pada tab surat ijin observasi. Form, download PDF, dan cetak dinonaktifkan.'
              : 'Surat observasi ini dibuat langsung oleh mahasiswa tanpa menunggu proses admin. Isi data secara bertahap lalu unduh PDF atau cetak saat preview sudah sesuai. Data surat akan otomatis masuk arsip.'}
          </div>

          {formFeedback && (
            <div className={`mx-6 my-5 rounded-2xl border px-4 py-3 text-sm ${formFeedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                : formFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                  : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300'
              }`}>
              {formFeedback.message}
            </div>
          )}

          {/* Step 1: Program Studi Selection (WAJIB) */}
          <div className="p-6 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/20 dark:to-indigo-950/20 space-y-5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
              <GraduationCap className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Langkah 1: Pilih Program Studi</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
              Pilih program studi terlebih dahulu. Nama Kaprodi akan terisi otomatis jika data tersedia.
            </p>
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">
                Program Studi <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={prodiOptions}
                value={selectedProdiId}
                onChange={handleProdiSelect}
                placeholder="— Pilih Program Studi —"
                searchPlaceholder="Cari program studi..."
                disabled={readOnly}
              />
            </div>

            {isFetchingKaprodi && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengambil data Kaprodi...
              </div>
            )}

            {isProdiSelected && !isFetchingKaprodi && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Nama Kaprodi</Label>
                <Input
                  value={watch('headOfProgramName') || ''}
                  placeholder="Data Kaprodi belum tersedia di database"
                  disabled
                  className="bg-slate-50 dark:bg-gray-800 cursor-not-allowed"
                />
                {watch('headOfProgramName') ? (
                  <p className="text-xs text-green-600 dark:text-green-400">Kaprodi terisi otomatis dari database.</p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">⚠ Kaprodi belum diatur untuk prodi ini. Silakan tambahkan di Manajemen Dosen.</p>
                )}
              </div>
            )}
          </div>

          {/* Form pengisian surat — hanya muncul setelah prodi dipilih */}
          {isProdiSelected && (
            <>
              {/* Company Details */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <Building2 className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Data Perusahaan Tujuan</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Penerima / Jabatan</Label>
                    <Input id="recipientName" placeholder="Contoh: HRD Manager" className="bg-white dark:bg-gray-800" disabled={readOnly} {...register("recipientName")} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Perusahaan / Instansi</Label>
                    <Input id="companyName" placeholder="Contoh: PT. Teknologi Nusantara" className="bg-white dark:bg-gray-800" disabled={readOnly} {...register("companyName")} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="companyAddress" className="text-slate-700 dark:text-slate-300 font-medium">Alamat Perusahaan</Label>
                    <Textarea
                      id="companyAddress"
                      placeholder="Contoh: Jl. Sudirman No. 123, Jakarta"
                      className="resize-y bg-white dark:bg-gray-800"
                      size="sm"
                      disabled={readOnly}
                      {...register("companyAddress")}
                    />
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Data Akademik</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="courseName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Mata Kuliah</Label>
                    <Input id="courseName" placeholder="Contoh: Rekayasa Perangkat Lunak" disabled={readOnly} {...register("courseName")} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-700 dark:text-slate-300 font-medium">Dosen Pengampu</Label>
                    <SearchableSelect
                      options={lecturerOptions}
                      value={selectedLecturerName}
                      onChange={(val) => setValue('lecturerName', val)}
                      placeholder="— Pilih Dosen Pengampu —"
                      searchPlaceholder="Cari nama dosen..."
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Student Details */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Users className="w-5 h-5" />
                    <h3 className="font-semibold text-lg">Anggota Kelompok</h3>
                  </div>
                  <span className="text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                    {fields.length} / 5
                  </span>
                </div>

                <div className="space-y-3">
                  {fields.map((field: { id: string }, index: number) => (
                    <div key={field.id} className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold mt-2.5">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Lengkap</Label>
                          <Input placeholder="Nama Mahasiswa" disabled={readOnly} {...register(`students.${index}.name` as const)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">NIM</Label>
                          <Input placeholder="672019000" disabled={readOnly} {...register(`students.${index}.nim` as const)} />
                        </div>
                      </div>
                      {fields.length > 1 && !readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 mt-6"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed border-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-500 dark:text-slate-400 dark:border-slate-700"
                  onClick={() => {
                    if (fields.length < 5) append({ name: '', nim: '' });
                  }}
                  disabled={readOnly || fields.length >= 5}
                >
                  <Plus className="w-4 h-4 mr-2" /> Tambah Anggota Kelompok
                </Button>
              </div>

              {/* Actions */}
              <div className="p-6 bg-white dark:bg-gray-800 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1" ref={dropdownRef}>
                  <Button
                    type="button"
                    onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                    disabled={readOnly || isDownloadingPdf || isGeneratingQr}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-11 text-base"
                  >
                    {(isDownloadingPdf || isGeneratingQr) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    {(isDownloadingPdf || isGeneratingQr) ? 'Menyiapkan...' : 'Download'}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>

                  {isDownloadMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700 overflow-hidden z-50">
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center text-slate-700 dark:text-slate-200 transition-colors"
                        onClick={() => {
                          setConfirmAction('pdf');
                          setIsDownloadMenuOpen(false);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-3 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium">Simpan sebagai PDF</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center text-slate-700 dark:text-slate-200 transition-colors border-t border-slate-100 dark:border-gray-700"
                        onClick={() => {
                          setConfirmAction('qr');
                          setIsDownloadMenuOpen(false);
                        }}
                      >
                        <QrCode className="w-4 h-4 mr-3 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium">Download via QR Code</span>
                      </button>
                    </div>
                  )}
                </div>
                <Button type="button" onClick={() => setConfirmAction('print')} disabled={readOnly || isFinalizingPrint} variant="outline" className="flex-1 h-11 text-base border-slate-300 dark:border-slate-600">
                  {isFinalizingPrint ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                  {isFinalizingPrint ? 'Menyiapkan...' : 'Cetak Langsung'}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembuatan Surat</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin data yang diisi sudah benar? Tindakan ini akan <strong>menghasilkan nomor surat resmi</strong> dan menyimpan dokumen ke dalam arsip TU.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Periksa Kembali</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
              Yakin & Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {qrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl max-w-sm w-full text-center relative">
            <button
              onClick={() => setQrUrl(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Scan untuk Download</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">Gunakan kamera HP atau aplikasi scanner untuk mengunduh PDF secara otomatis.</p>
            <div className="bg-white p-4 rounded-xl inline-block border border-slate-200 shadow-sm mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="QR Code Download"
                className="w-48 h-48"
              />
            </div>
            <div className="bg-slate-100 dark:bg-gray-700/50 p-3 rounded-lg break-all text-xs text-slate-500 dark:text-gray-400 text-left">
              {qrUrl}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
