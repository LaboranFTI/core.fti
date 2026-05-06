import React, { useEffect, useState } from 'react';
import { ActiveStudentRequest, LetterAsset, TULetterBackgrounds, TULetterLayouts } from '../types';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
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
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { CheckCircle, Printer, Mail, Eye, FileText, Clock, Upload, ArrowLeft, Settings, Save, Loader2 } from 'lucide-react';
import { ActiveStudentLetter } from './ActiveStudentLetter';
import { api } from '../../services/api';

const createEmptyLetterAsset = (): LetterAsset => ({
  imageBase64: '',
  fileName: '',
  mimeType: 'image/png'
});

const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  activeStudent: createEmptyLetterAsset(),
  observation: createEmptyLetterAsset()
});

const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

const letterAssetSections: Array<{
  key: keyof TULetterBackgrounds;
  title: string;
  description: string;
}> = [
  {
    key: 'activeStudent',
    title: 'Surat Aktif Kuliah',
    description: 'Satu PNG ukuran A4 yang dipakai sebagai background penuh surat aktif kuliah.'
  },
  {
    key: 'observation',
    title: 'Surat Observasi',
    description: 'Satu PNG ukuran A4 yang dipakai sebagai background penuh surat observasi.'
  }
];

interface AdminPanelProps {
  onSettingsSaved?: () => Promise<void> | void;
}

export function AdminPanel({ onSettingsSaved }: AdminPanelProps) {
  const [requests, setRequests] = useState<ActiveStudentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ActiveStudentRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // State untuk pengaturan default
  const [defaultSignature, setDefaultSignature] = useState<string>('');
  const [defaultStamp, setDefaultStamp] = useState<string>('');
  const [currentSemesterCode, setCurrentSemesterCode] = useState<string>('');
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // State untuk perubahan sementara di UI pengaturan
  const [tempSignature, setTempSignature] = useState<string>('');
  const [tempStamp, setTempStamp] = useState<string>('');
  const [tempCurrentSemesterCode, setTempCurrentSemesterCode] = useState<string>('');
  const [tempLetterBackgrounds, setTempLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [tempLetterLayouts, setTempLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [panelFeedback, setPanelFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [requestToVerify, setRequestToVerify] = useState<ActiveStudentRequest | null>(null);

  const formatSemesterLabel = (semesterCode: string) => {
    if (!/^\d{4}[123]$/.test(semesterCode)) return 'Belum diatur';

    const year = parseInt(semesterCode.slice(0, 4), 10);
    const type = semesterCode.slice(4);

    if (type === '1') return `Ganjil ${year}/${year + 1}`;
    if (type === '2') return `Genap ${year - 1}/${year}`;
    return `Antara ${year - 1}/${year}`;
  };

  const getSemesterMeta = (semesterCode: string) => {
    if (!/^\d{4}[123]$/.test(semesterCode)) {
      return { semesterName: undefined, academicYear: undefined };
    }

    const label = formatSemesterLabel(semesterCode);
    const [semesterName, academicYear] = label.split(' ');
    return { semesterName, academicYear };
  };

  const fetchRequests = async () => {
    try {
      const res = await api('/api/active-student');
      const json = await res.json();
      if (json.success) {
        setRequests(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTuSettings = async () => {
    try {
      const res = await api('/api/tu/settings');
      const json = await res.json();
      if (res.ok) {
        setDefaultSignature(json.signatureBase64);
        setDefaultStamp(json.stampBase64);
        setCurrentSemesterCode(json.currentSemesterCode || '');
        setLetterBackgrounds(json.letterBackgrounds || createEmptyLetterBackgrounds());
        setLetterLayouts(json.letterLayouts || createEmptyLetterLayouts());
        setTempSignature(json.signatureBase64);
        setTempStamp(json.stampBase64);
        setTempCurrentSemesterCode(json.currentSemesterCode || '');
        setTempLetterBackgrounds(json.letterBackgrounds || createEmptyLetterBackgrounds());
        setTempLetterLayouts(json.letterLayouts || createEmptyLetterLayouts());
        return json;
      }
    } catch (error) {
      console.error('Failed to fetch TU settings:', error);
    }

    return null;
  };

  useEffect(() => {
    fetchRequests();
    fetchTuSettings();
    const interval = setInterval(fetchRequests, 15000); // Poll for new requests
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLetterBackgroundChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    letterKey: keyof TULetterBackgrounds
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempLetterBackgrounds((prev) => ({
        ...prev,
        [letterKey]: {
          imageBase64: reader.result as string,
          fileName: file.name,
          mimeType: file.type || 'image/png'
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleLetterLayoutChange = (
    letterKey: keyof TULetterLayouts,
    field: keyof TULetterLayouts['activeStudent'],
    value: string
  ) => {
    const sanitized = value === '' ? '' : value.replace(',', '.');
    setTempLetterLayouts((prev) => ({
      ...prev,
      [letterKey]: {
        ...prev[letterKey],
        [field]: sanitized === '' ? 0 : Number(sanitized)
      }
    }));
  };

  const handleVerify = async (reqId: string) => {
    setIsProcessing(true);
    setPanelFeedback(null);
    try {
      const res = await api(`/api/active-student/${reqId}/verify`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureBase64: defaultSignature, stampBase64: defaultStamp })
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        await fetchRequests();
        if (selectedRequest?.id === reqId) {
          setSelectedRequest(prev => prev ? {
            ...prev,
            status: 'verified',
            signatureBase64: defaultSignature,
            stampBase64: defaultStamp,
            letterNumber: json?.letterNumber || prev.letterNumber
          } : null);
        }
        setPanelFeedback({ type: 'success', message: 'Berkas berhasil diverifikasi dan siap dicetak atau dikirim.' });
      } else {
        setPanelFeedback({ type: 'error', message: json?.error || 'Verifikasi berkas gagal dilakukan.' });
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      setPanelFeedback({ type: 'error', message: 'Verifikasi berkas gagal dilakukan.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const res = await api('/api/tu/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureBase64: tempSignature,
          stampBase64: tempStamp,
          currentSemesterCode: tempCurrentSemesterCode,
          letterBackgrounds: tempLetterBackgrounds,
          letterLayouts: tempLetterLayouts
        })
      });
      if (res.ok) {
        await fetchTuSettings(); // Re-fetch to confirm
        await onSettingsSaved?.();
        setSettingsFeedback({ type: 'success', message: 'Pengaturan TU berhasil disimpan.' });
      } else {
        const json = await res.json().catch(() => null);
        setSettingsFeedback({ type: 'error', message: json?.error || 'Gagal menyimpan pengaturan TU.' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsFeedback({ type: 'error', message: 'Gagal menyimpan pengaturan TU.' });
    } finally {
      setIsSavingSettings(false);
    }
  }

  const handleSendEmail = async (reqId: string) => {
    setIsProcessing(true);
    setPanelFeedback(null);
    try {
      const res = await api(`/api/tu/requests/active-student/${reqId}/send-email`, { method: 'POST' });
      if (res.ok) {
        await fetchRequests();
        if (selectedRequest?.id === reqId) {
          setSelectedRequest(prev => prev ? { ...prev, status: 'sent' } : null);
        }
        setPanelFeedback({ type: 'success', message: 'Surat berhasil dikirim ke email mahasiswa.' });
      } else {
        const json = await res.json().catch(() => null);
        setPanelFeedback({ type: 'error', message: json?.error || 'Gagal mengirim surat ke email mahasiswa.' });
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      setPanelFeedback({ type: 'error', message: 'Gagal mengirim surat ke email mahasiswa.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Menunggu</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" /> Terverifikasi</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Mail className="w-3 h-3 mr-1" /> Terkirim</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (selectedRequest) {
    const semesterMeta = getSemesterMeta(currentSemesterCode);

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {panelFeedback && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            panelFeedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
          }`}>
            {panelFeedback.message}
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 mb-6 print:hidden gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Proses Permohonan</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">{selectedRequest.name} ({selectedRequest.nim})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(selectedRequest.status)}
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            {selectedRequest.status === 'pending' && (
              <Button 
                onClick={() => setRequestToVerify(selectedRequest)}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Verifikasi Berkas
              </Button>
            )}
            {(selectedRequest.status === 'verified' || selectedRequest.status === 'sent') && (
              <>
                <Button variant="outline" onClick={handlePrint} className="border-slate-300 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700">
                  <Printer className="w-4 h-4 mr-2" /> Cetak Surat
                </Button>
                <Button 
                  onClick={() => handleSendEmail(selectedRequest.id)}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Mail className="w-4 h-4 mr-2" /> Kirim ke Email User
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column: Transcript & Uploads (Hidden on Print) */}
          <div className="xl:col-span-5 space-y-6 print:hidden">
            <Card className="shadow-sm border-slate-200 dark:border-gray-700">
              <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700 py-4">
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                  <FileText className="w-5 h-5 text-blue-600" /> Transkrip Nilai
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-150 w-full bg-slate-100 dark:bg-gray-900 relative">
                  {selectedRequest.transcriptBase64 ? (
                    <iframe src={selectedRequest.transcriptBase64} className="w-full h-full border-0" title="Transkrip Nilai" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">Tidak ada lampiran</div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column: Letter Preview */}
          <div className="xl:col-span-7 print:block print:w-full print:absolute print:top-0 print:left-0 print:m-0 print:p-0">
            <Card className="shadow-sm border-slate-200 dark:border-gray-700 print:border-0 print:shadow-none h-full">
              <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700 py-4 print:hidden">
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                  <Printer className="w-5 h-5 text-slate-600" /> Preview Surat
                </CardTitle>
                {selectedRequest.status === 'pending' && (
                  <CardDescription className="text-xs dark:text-gray-400">Ini adalah preview surat yang akan digenerate dengan TTD dan Cap default.</CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-6 bg-slate-200/50 print:bg-white print:p-0 flex justify-center overflow-auto min-h-200">
                <ActiveStudentLetter data={{
                  ...selectedRequest, 
                  semesterCode: currentSemesterCode,
                  semesterName: semesterMeta.semesterName,
                  academicYear: semesterMeta.academicYear,
                  signatureBase64: selectedRequest.status === 'pending' ? defaultSignature : selectedRequest.signatureBase64, 
                  stampBase64: selectedRequest.status === 'pending' ? defaultStamp : selectedRequest.stampBase64,
                  backgroundImageBase64: letterBackgrounds.activeStudent.imageBase64,
                  layout: letterLayouts.activeStudent
                }} />
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={Boolean(requestToVerify)} onOpenChange={(open) => {
          if (!open) setRequestToVerify(null);
        }}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Verifikasi berkas sekarang?</AlertDialogTitle>
              <AlertDialogDescription>
                Surat akan memakai tanda tangan dekan dan cap fakultas yang saat ini tersimpan di pengaturan TU.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (requestToVerify) {
                    handleVerify(requestToVerify.id);
                  }
                  setRequestToVerify(null);
                }}
              >
                Verifikasi Berkas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:hidden">
      {settingsFeedback && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          settingsFeedback.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
        }`}>
          {settingsFeedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="shadow-sm border-slate-200 dark:border-gray-700 xl:col-span-1">
        <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <CardTitle className="text-xl text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Semester Berjalan
          </CardTitle>
          <CardDescription className="dark:text-gray-400">Tentukan semester aktif yang dipakai saat verifikasi KST mahasiswa.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
            Pengaturan ini akan menjadi default untuk pengecekan KST dan penentuan status mahasiswa aktif.
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentSemesterCode" className="text-sm font-medium text-slate-600 dark:text-slate-300">Semester Berjalan</Label>
            <Input
              id="currentSemesterCode"
              value={tempCurrentSemesterCode}
              onChange={(e) => setTempCurrentSemesterCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Contoh: 20252"
              className="bg-white dark:bg-gray-800"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Format `YYYYS` (S=1=Ganjil, 2=Genap, 3=Antara).<br/>Contoh:<br/>`20251` = Ganjil 2025/2026<br/>`20252` = Genap 2025/2026<br/>`20253` = Antara 2025/2026
            </p>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Aktif: {formatSemesterLabel(tempCurrentSemesterCode)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 dark:border-gray-700 xl:col-span-2">
        <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <CardTitle className="text-xl text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Pengesahan Surat
          </CardTitle>
          <CardDescription className="dark:text-gray-400">Atur Tanda Tangan Dekan dan Cap Fakultas yang akan digunakan otomatis pada surat.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Tanda Tangan Dekan</p>
            <div className="h-24 w-full bg-slate-100 dark:bg-gray-900/50 rounded-lg border border-dashed flex items-center justify-center">
              {tempSignature ? <img src={tempSignature} alt="Preview TTD" className="h-20 object-contain" /> : <span className="text-xs text-slate-400">Belum diatur</span>}
            </div>
            <label className="cursor-pointer w-full text-center bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 border border-slate-300 dark:border-gray-600 px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Ganti TTD
              <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileChange(e, setTempSignature)} />
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Cap Fakultas</p>
            <div className="h-24 w-full bg-slate-100 dark:bg-gray-900/50 rounded-lg border border-dashed flex items-center justify-center">
              {tempStamp ? <img src={tempStamp} alt="Preview Cap" className="h-20 object-contain" /> : <span className="text-xs text-slate-400">Belum diatur</span>}
            </div>
            <label className="cursor-pointer w-full text-center bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 border border-slate-300 dark:border-gray-600 px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Ganti Cap
              <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleFileChange(e, setTempStamp)} />
            </label>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              Gunakan file PNG transparan agar hasil tanda tangan, cap, serta kop surat terlihat rapi pada preview, PDF, dan email.
            </div>
            <Button 
              onClick={handleSaveSettings} 
              disabled={isSavingSettings}
              className="h-11 w-full bg-blue-600 hover:bg-blue-700"
            >
              {isSavingSettings ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 dark:border-gray-700 xl:col-span-3">
        <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <CardTitle className="text-xl text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Background Surat
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Upload satu PNG ukuran A4 untuk masing-masing jenis surat. PNG ini akan dipakai sebagai latar belakang penuh, lalu isi surat ditulis di atasnya mengikuti template.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          {letterAssetSections.map((section) => (
            <div key={section.key} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-white">{section.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Background PNG</p>
                <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-slate-100 p-2 dark:bg-gray-900/50">
                  {tempLetterBackgrounds[section.key].imageBase64 ? (
                    <img
                      src={tempLetterBackgrounds[section.key].imageBase64}
                      alt={`${section.title} background`}
                      className="max-h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Belum diupload</span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {tempLetterBackgrounds[section.key].fileName || 'Pilih file PNG ukuran A4'}
                </p>
                <label className="cursor-pointer w-full text-center bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 border border-slate-300 dark:border-gray-600 px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> Upload Background
                  <input
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(e) => handleLetterBackgroundChange(e, section.key)}
                  />
                </label>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Margin Area Tulisan</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Nilai dalam milimeter seperti pengaturan margin kertas A4 di Microsoft Word.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Top</Label>
                    <Input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      value={tempLetterLayouts[section.key].marginTopMm}
                      onChange={(e) => handleLetterLayoutChange(section.key, 'marginTopMm', e.target.value)}
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Right</Label>
                    <Input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      value={tempLetterLayouts[section.key].marginRightMm}
                      onChange={(e) => handleLetterLayoutChange(section.key, 'marginRightMm', e.target.value)}
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Bottom</Label>
                    <Input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      value={tempLetterLayouts[section.key].marginBottomMm}
                      onChange={(e) => handleLetterLayoutChange(section.key, 'marginBottomMm', e.target.value)}
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Left</Label>
                    <Input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      value={tempLetterLayouts[section.key].marginLeftMm}
                      onChange={(e) => handleLetterLayoutChange(section.key, 'marginLeftMm', e.target.value)}
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>

      <Card className="shadow-sm border-slate-200 dark:border-gray-700">
        <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <CardTitle className="text-xl text-slate-800 dark:text-white">Daftar Permohonan Surat Aktif Kuliah</CardTitle>
          <CardDescription className="dark:text-gray-400">Verifikasi dan proses permohonan dari mahasiswa.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Memuat data...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <p>Belum ada permohonan yang masuk.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-gray-800/50">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama Mahasiswa</TableHead>
                  <TableHead>NIM</TableHead>
                  <TableHead>Nomor Surat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-slate-500">
                      {format(new Date(req.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}
                    </TableCell>
                    <TableCell className="font-medium dark:text-white">{req.name}</TableCell>
                    <TableCell>{req.nim}</TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {req.letterNumber || 'Akan dibuat saat verifikasi'}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" className="border-slate-300 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
                        size="sm"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <Eye className="w-4 h-4 mr-2" /> Detail & Proses
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
