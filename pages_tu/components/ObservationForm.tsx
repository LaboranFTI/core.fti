import {
  Buildings as Building2,
  FileText,
  GraduationCap,
  SpinnerGap as Loader2,
  EnvelopeSimple as Mail,
  Plus,
  Printer,
  Trash as Trash2,
  Users
} from '@phosphor-icons/react';
import React, { useState, useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ObservationData } from '../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { EmailActionOverlay } from './EmailActionOverlay';
import { EmailSuccessDialog } from './EmailSuccessDialog';
import { LetterActionMenu, LetterFormHeader, LetterModeTabs } from './LetterFormControls';
import { ValidationQrCode } from './ValidationQrCode';

const MAX_OBSERVATION_STUDENTS = 7;

const getInitialObservationCc = () => {
  try {
    const saved = localStorage.getItem('core_fti_last_observation_cc');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load observation carbon copies:', e);
  }
  return [];
};

const createDefaultObservationData = (): ObservationData => ({
  recipientName: '',
  companyName: '',
  companyAddress: '',
  courseName: '',
  lecturerName: '',
  headOfProgramName: '',
  studyProgramId: '',
  studyProgramName: '',
  studyProgramLevel: '',
  students: [{ name: '', nim: '' }],
  carbonCopies: getInitialObservationCc()
});

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
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [formFeedback, setFormFeedback] = useState(feedback);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrAccessCode, setQrAccessCode] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [isFinalizingPrint, setIsFinalizingPrint] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pdf' | 'qr' | 'print' | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [emailSuccessState, setEmailSuccessState] = useState<{ email: string; letterNumber?: string | null; accessCode?: string | null } | null>(null);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessLetterState, setAccessLetterState] = useState<{ accessCode: string; letterNumber?: string | null; status?: string | null } | null>(null);
  const [isOpeningAccessCode, setIsOpeningAccessCode] = useState(false);
  const [isSavingAccessCode, setIsSavingAccessCode] = useState(false);

  // Program Studi & Dosen data
  const { studyPrograms } = useStudyPrograms();
  const { lecturers } = useLecturers();
  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [isProdiSelected, setIsProdiSelected] = useState(false);

  const { register, control, watch, getValues, setValue, reset } = useForm<ObservationData>({
    defaultValues: createDefaultObservationData()
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "students"
  });

  const { fields: ccFields, append: ccAppend, remove: ccRemove } = useFieldArray({
    control,
    name: "carbonCopies"
  });

  const normalizeAccessCodeInput = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

  const normalizeLoadedObservationData = (data: Partial<ObservationData> = {}): ObservationData => ({
    recipientName: data.recipientName || '',
    companyName: data.companyName || '',
    companyAddress: data.companyAddress || '',
    courseName: data.courseName || '',
    lecturerName: data.lecturerName || '',
    headOfProgramName: data.headOfProgramName || '',
    studyProgramId: data.studyProgramId || '',
    studyProgramName: data.studyProgramName || '',
    studyProgramLevel: data.studyProgramLevel || '',
    students: data.students && data.students.length > 0 ? data.students : [{ name: '', nim: '' }],
    carbonCopies: data.carbonCopies || []
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
    setValue('headOfProgramName', '');
    setIsProdiSelected(true);
  }, [studyPrograms, setValue]);

  // Watch for changes and pass them up
  React.useEffect(() => {
    onDataChange(getValues());
    const subscription = watch((value: any) => {
      onDataChange(value as ObservationData);
    });
    return () => subscription.unsubscribe();
  }, [getValues, watch, onDataChange]);

  const resetSelfServiceFlow = useCallback(() => {
    const defaultData = createDefaultObservationData();
    reset(defaultData);
    setFormMode('new');
    setSelectedProdiId('');
    setIsProdiSelected(false);
    setQrUrl(null);
    setQrAccessCode(null);
    setQrExpiresAt(null);
    setEmailModalOpen(false);
    setTargetEmail('');
    setEmailSuccessState(null);
    setAccessCodeInput('');
    setAccessLetterState(null);
    setIsOpeningAccessCode(false);
    setIsSavingAccessCode(false);
    setFormFeedback(null);
    onDataChange(defaultData);
  }, [onDataChange, reset]);

  const handleFormModeChange = (mode: 'new' | 'existing') => {
    if (mode === formMode) return;
    resetSelfServiceFlow();
    setFormMode(mode);
  };

  const handleOpenAccessCodeLetter = async () => {
    const accessCode = accessCodeInput.trim();
    if (!accessCode) {
      setFormFeedback({ type: 'error', message: 'Masukkan kode akses surat terlebih dahulu.' });
      return;
    }

    setIsOpeningAccessCode(true);
    setFormFeedback(null);
    try {
      const res = await api('/api/tu/public/observation-letter/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode })
      });
      const json = await res.json().catch(() => ({ error: 'Gagal membuka surat.' }));
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal membuka surat.');

      const loadedData = normalizeLoadedObservationData(json.letter?.data);
      reset(loadedData);
      onDataChange(loadedData);
      setSelectedProdiId(loadedData.studyProgramId || '');
      setIsProdiSelected(true);
      setAccessCodeInput(json.letter.accessCode || accessCode);
      setAccessLetterState({
        accessCode: json.letter.accessCode || accessCode,
        letterNumber: json.letter.letterNumber || null,
        status: json.letter.status || null
      });
      setFormFeedback({
        type: 'success',
        message: 'Surat ditemukan. Data bisa diedit lalu disimpan atau diunduh ulang.'
      });
    } catch (error) {
      setAccessLetterState(null);
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal membuka surat.' });
    } finally {
      setIsOpeningAccessCode(false);
    }
  };

  const handleSaveAccessCodeLetter = async () => {
    if (!accessLetterState?.accessCode) {
      setFormFeedback({ type: 'error', message: 'Buka surat dengan kode akses terlebih dahulu.' });
      return;
    }

    setIsSavingAccessCode(true);
    setFormFeedback(null);
    try {
      const formData = getValues();
      const res = await api('/api/tu/public/observation-letter/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, accessCode: accessLetterState.accessCode })
      });
      const json = await res.json().catch(() => ({ error: 'Gagal menyimpan perubahan surat.' }));
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal menyimpan perubahan surat.');

      const loadedData = normalizeLoadedObservationData(json.letter?.data);
      reset(loadedData);
      onDataChange(loadedData);
      setAccessLetterState({
        accessCode: json.letter.accessCode || accessLetterState.accessCode,
        letterNumber: json.letter.letterNumber || accessLetterState.letterNumber || null,
        status: json.letter.status || accessLetterState.status || null
      });
      localStorage.setItem('core_fti_last_observation_cc', JSON.stringify(formData.carbonCopies || []));
      setFormFeedback({
        type: 'success',
        message: 'Perubahan surat disimpan. Nomor surat tetap sama.'
      });
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal menyimpan perubahan surat.' });
    } finally {
      setIsSavingAccessCode(false);
    }
  };

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

  const handleSendEmail = async () => {
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setFormFeedback({ type: 'error', message: 'Masukkan alamat email yang valid.' });
      return;
    }
    setIsSendingEmail(true);
    setEmailModalOpen(false);
    setFormFeedback(null);
    try {
      const formData = getValues();
      const res = await api('/api/tu/observation-letter/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, targetEmail })
      });
      const json = await res.json().catch(() => ({ error: 'Gagal mengirim email.' }));
      if (!res.ok) throw new Error(json.error);
      localStorage.setItem('core_fti_last_observation_cc', JSON.stringify(formData.carbonCopies || []));
      setFormFeedback({
        type: 'success',
        message: `Surat berhasil dikirim ke ${targetEmail}. Kode akses surat juga dikirim melalui email.`
      });
      setEmailSuccessState({ email: targetEmail, letterNumber: json.letterNumber || null, accessCode: json.accessCode || null });
      setTargetEmail('');
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal mengirim email.' });
    } finally {
      setIsSendingEmail(false);
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

      localStorage.setItem('core_fti_last_observation_cc', JSON.stringify(formData.carbonCopies || []));
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
      if (accessLetterState?.accessCode) {
        const saveRes = await api('/api/tu/public/observation-letter/access', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, accessCode: accessLetterState.accessCode })
        });
        const saveJson = await saveRes.json().catch(() => ({ error: 'Gagal menyimpan perubahan surat.' }));
        if (!saveRes.ok || !saveJson.success) {
          throw new Error(saveJson.error || 'Gagal menyimpan perubahan surat.');
        }

        const loadedData = normalizeLoadedObservationData(saveJson.letter?.data);
        reset(loadedData);
        onDataChange(loadedData);
        setAccessLetterState({
          accessCode: saveJson.letter.accessCode || accessLetterState.accessCode,
          letterNumber: saveJson.letter.letterNumber || accessLetterState.letterNumber || null,
          status: saveJson.letter.status || accessLetterState.status || null
        });

        const downloadRes = await api('/api/tu/public/observation-letter/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessCode: accessLetterState.accessCode })
        });

        if (!downloadRes.ok) {
          const errorJson = await downloadRes.json().catch(() => ({ error: 'Gagal mengunduh PDF.' }));
          throw new Error(errorJson.error);
        }

        const blob = await downloadRes.blob();
        const companyName = loadedData.companyName;
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

        setFormFeedback({ type: 'success', message: 'Perubahan disimpan dan surat berhasil diunduh dari kode akses.' });
        return;
      }

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
      const accessCode = res.headers.get('X-Observation-Access-Code');
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

      localStorage.setItem('core_fti_last_observation_cc', JSON.stringify(formData.carbonCopies || []));
      setFormFeedback({
        type: 'success',
        message: accessCode
          ? `Surat berhasil diunduh dan diarsipkan. Kode akses surat: ${accessCode}. Simpan kode ini untuk membuka ulang surat.`
          : 'Surat berhasil diunduh dan diarsipkan secara otomatis.'
      });
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
        console.error('Server Error Details:', json.details, json.stack);
        throw new Error(json.details ? `${json.error} Details: ${json.details}` : (json.error || 'Gagal menghasilkan QR Code.'));
      }

      localStorage.setItem('core_fti_last_observation_cc', JSON.stringify(formData.carbonCopies || []));
      setQrUrl(json.validationUrl || json.qrUrl || null);
      setQrAccessCode(json.accessCode || null);
      setQrExpiresAt(json.expiresAt || null);
      setFormFeedback({
        type: 'success',
        message: json.accessCode
          ? `QR validasi surat berhasil dibuat. Kode akses surat: ${json.accessCode}.`
          : 'QR validasi surat berhasil dibuat.'
      });
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
    <>
      <Card className="w-full shadow-xl border-0 ring-1 ring-slate-900/5 dark:ring-gray-700 overflow-visible">
      <CardHeader className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
        <LetterFormHeader
          title={formMode === 'new' ? 'Buat Surat Observasi Baru' : 'Buka Surat Observasi Lama'}
          description={
            formMode === 'new'
              ? 'Lengkapi data surat baru. Preview dapat ditampilkan bila diperlukan.'
              : 'Masukkan kode akses untuk membuka, mengubah, atau mengirim kembali surat yang sudah dibuat.'
          }
          action={
            !readOnly && (
              <LetterModeTabs<'new' | 'existing'>
                value={formMode}
                onChange={handleFormModeChange}
                items={[
                  { value: 'new', label: 'Buat Surat Baru', icon: Plus },
                  { value: 'existing', label: 'Buka Surat Lama', icon: FileText }
                ]}
              />
            )
          }
        />
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          <div className="px-6 py-4 bg-blue-50/80 text-sm text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
            {readOnly
              ? 'Role Mahasiswa hanya memiliki akses baca pada tab surat ijin observasi. Form, download PDF, dan cetak dinonaktifkan.'
              : formMode === 'new'
                ? 'Surat observasi ini dibuat langsung oleh mahasiswa tanpa menunggu proses admin. Isi data secara bertahap, lalu unduh PDF atau cetak. Aktifkan preview bila ingin memeriksa tata letak surat. Data surat akan otomatis masuk arsip.'
                : 'Gunakan kode akses yang diperoleh dari email atau tampilan QR. Form surat baru tidak perlu diisi untuk membuka surat lama.'}
          </div>

          {formFeedback && (
            <div className={`mx-6 my-5 rounded-lg border px-4 py-3 text-sm ${formFeedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                : formFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
                  : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300'
              }`}>
              {formFeedback.message}
            </div>
          )}

          {!readOnly && formMode === 'existing' && (
            <div className="p-6 bg-white dark:bg-gray-800 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-lg">Buka Surat Lama dengan Kode</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="observation-access-code" className="text-slate-700 dark:text-slate-300 font-medium">
                    Kode Akses Surat
                  </Label>
                  <Input
                    id="observation-access-code"
                    value={accessCodeInput}
                    onChange={(event) => setAccessCodeInput(normalizeAccessCodeInput(event.target.value))}
                    onKeyDown={(event) => event.key === 'Enter' && handleOpenAccessCodeLetter()}
                    placeholder="OBS-ABCD-1234"
                    className="bg-white font-mono dark:bg-gray-800"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleOpenAccessCodeLetter}
                  disabled={!accessCodeInput.trim() || isOpeningAccessCode}
                  className="sm:self-end bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                >
                  {isOpeningAccessCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Buka Surat
                </Button>
              </div>

              {accessLetterState && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-300">Nomor surat</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{accessLetterState.letterNumber || 'Belum tersedia'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-300">Kode akses</p>
                      <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">{accessLetterState.accessCode}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveAccessCodeLetter}
                      disabled={isSavingAccessCode || isDownloadingPdf}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSavingAccessCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                      Simpan Perubahan
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleFormModeChange('new')}
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Surat Baru
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Program Studi Selection (WAJIB untuk surat baru) */}
          {(readOnly || formMode === 'new') && (
          <div className="space-y-5 border-b border-slate-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
              <GraduationCap className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Langkah 1: Pilih Program Studi</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
              Pilih program studi terlebih dahulu untuk mulai mengisi form.
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
          </div>
          )}

          {/* Form pengisian surat — hanya muncul setelah prodi dipilih */}
          {isProdiSelected && (
            <>
              {/* Company Details */}
              <div className="space-y-5 border-b border-slate-200 bg-slate-50/60 p-6 dark:border-gray-700 dark:bg-gray-800/30">
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
              <div className="space-y-5 border-b border-slate-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Data Akademik</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="courseName" className="text-slate-700 dark:text-slate-300 font-medium">Nama Mata Kuliah</Label>
                    <Input id="courseName" placeholder="Contoh: Rekayasa Perangkat Lunak C" disabled={readOnly} {...register("courseName")} />
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
              <div className="space-y-5 border-b border-slate-200 bg-slate-50/60 p-6 dark:border-gray-700 dark:bg-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Users className="w-5 h-5" />
                    <h3 className="font-semibold text-lg">Anggota Kelompok</h3>
                  </div>
                  <span className="text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                    {fields.length} / {MAX_OBSERVATION_STUDENTS}
                  </span>
                </div>

                <div className="space-y-3">
                  {fields.map((field: { id: string }, index: number) => (
                    <div key={field.id} className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold mt-2.5">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-500 dark:text-slate-400 uppercase">Nama Lengkap</Label>
                          <Input placeholder="Nama Mahasiswa" disabled={readOnly} {...register(`students.${index}.name` as const)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-500 dark:text-slate-400 uppercase">NIM</Label>
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
                          aria-label={`Hapus anggota kelompok ${index + 1}`}
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
                  className="w-full border-2 border-dashed text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:w-auto"
                  onClick={() => {
                    if (fields.length < MAX_OBSERVATION_STUDENTS) append({ name: '', nim: '' });
                  }}
                  disabled={readOnly || fields.length >= MAX_OBSERVATION_STUDENTS}
                >
                  <Plus className="w-4 h-4 mr-2" /> Tambah Anggota Kelompok
                </Button>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 bg-white p-6 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-end">
                <LetterActionMenu
                  className="sm:min-w-52"
                  disabled={readOnly}
                  isDownloadingPdf={isDownloadingPdf}
                  isGeneratingQr={isGeneratingQr}
                  isSendingEmail={isSendingEmail}
                  onDownloadPdf={() => setConfirmAction('pdf')}
                  onGenerateQr={() => setConfirmAction('qr')}
                  onSendEmail={() => setEmailModalOpen(true)}
                  emailDescription="PDF surat langsung ke kotak masuk"
                />
                <Button type="button" onClick={() => setConfirmAction('print')} disabled={readOnly || isFinalizingPrint} variant="outline" className="h-11 w-full border-slate-300 text-base dark:border-slate-600 sm:w-auto sm:min-w-44">
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

      <Dialog
        open={emailModalOpen}
        onOpenChange={(open) => {
          setEmailModalOpen(open);
          if (!open) setTargetEmail('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle>Kirim Surat via Email</DialogTitle>
                <DialogDescription>PDF surat observasi akan dilampirkan secara otomatis.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="obs-target-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Alamat Email Tujuan <span className="text-red-500">*</span>
            </Label>
            <Input
              id="obs-target-email"
              type="email"
              placeholder="contoh@gmail.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
              className="bg-white dark:bg-gray-700"
              autoFocus
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Isi dengan email penerima surat. Surat akan diarsipkan otomatis.
            </p>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmailModalOpen(false);
                setTargetEmail('');
              }}
            >
              Batal
            </Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleSendEmail} disabled={!targetEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Kirim Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(qrUrl)} onOpenChange={(open) => !open && setQrUrl(null)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">QR Validasi Surat</DialogTitle>
            <DialogDescription>Scan QR untuk membuka halaman validasi publik surat ini.</DialogDescription>
          </DialogHeader>
          {qrUrl && (
            <>
              <div className="inline-block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <ValidationQrCode
                  value={qrUrl}
                  size={192}
                  className="h-48 w-48"
                  ariaLabel="QR Code Validasi Surat"
                />
              </div>
              {qrAccessCode && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-900/50 dark:bg-blue-950/20">
                  <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-300">Kode akses surat</p>
                  <p className="mt-2 text-center text-xl font-bold text-slate-900 dark:text-white">{qrAccessCode}</p>
                  <p className="mt-2 text-xs leading-5 text-blue-700 dark:text-blue-200">
                    Simpan kode ini jika perlu membuka atau mengunduh ulang surat setelah QR ditutup.
                  </p>
                </div>
              )}
              <div className="break-all rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-500 dark:bg-gray-700/50 dark:text-gray-400">
                {qrUrl}
              </div>
              {qrExpiresAt && (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Link QR validasi berlaku permanen selama arsip surat tersedia.
                </p>
              )}
            </>
          )}
          <Button
            type="button"
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            onClick={resetSelfServiceFlow}
          >
            Selesai & Buat Surat Baru
          </Button>
        </DialogContent>
      </Dialog>
      </Card>

      <EmailActionOverlay
        open={isSendingEmail}
        title="Mengirim surat observasi..."
        description="Sistem sedang membuat PDF final lalu mengirimkannya ke email tujuan."
      />
      <EmailSuccessDialog
        open={Boolean(emailSuccessState)}
        onClose={resetSelfServiceFlow}
        recipientEmail={emailSuccessState?.email}
        letterNumber={emailSuccessState?.letterNumber}
        accessCode={emailSuccessState?.accessCode}
        title="Surat observasi berhasil dikirim"
      />
    </>
  );
}
