import React, { useCallback, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  Building2,
  FileText,
  GraduationCap,
  Plus,
  Trash2,
  UserRound,
  Users
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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
import SearchableSelect, { SelectOption } from '../../components/SearchableSelect';
import { useLecturers } from '../../hooks/useLecturers';
import { useStudyPrograms } from '../../hooks/useStudyPrograms';
import { api } from '../../services/api';
import { ResearchLetterData } from '../types';
import { EmailActionOverlay } from './EmailActionOverlay';
import { EmailSuccessDialog } from './EmailSuccessDialog';
import { LetterActionMenu } from './LetterFormControls';
import { ValidationQrCode } from './ValidationQrCode';

const MAX_RESEARCH_ADVISORS = 2;

const getInitialResearchCc = () => {
  try {
    const saved = localStorage.getItem('core_fti_last_research_cc');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load research carbon copies:', e);
  }
  return [];
};

const createDefaultResearchData = (): ResearchLetterData => ({
  name: '',
  nim: '',
  email: '',
  recipientName: '',
  recipientTitle: '',
  destinationPlace: '',
  destinationAddress: '',
  researchPlace: '',
  assignmentType: 'Tugas Talenta Unggul',
  researchTitle: '',
  contactPerson: '',
  studyProgramId: '',
  studyProgramName: '',
  studyProgramLevel: '',
  advisors: [],
  includeResearchPlace: true,
  carbonCopies: getInitialResearchCc()
});

const safeFilenamePart = (value: string) => (value || 'TanpaNama').replace(/[\/\\?%*:|"<>]/g, '_');

type ResearchLetterErrorField =
  | 'name'
  | 'nim'
  | 'studyProgram'
  | 'recipientName'
  | 'recipientTitle'
  | 'destinationPlace'
  | 'destinationAddress'
  | 'researchPlace'
  | 'researchTitle';

type ResearchLetterFieldErrors = Partial<Record<ResearchLetterErrorField, string>>;

const researchFieldFocusIds: Partial<Record<ResearchLetterErrorField, string>> = {
  name: 'name',
  nim: 'nim',
  recipientName: 'recipientName',
  recipientTitle: 'recipientTitle',
  destinationPlace: 'destinationPlace',
  destinationAddress: 'destinationAddress',
  researchPlace: 'researchPlace',
  researchTitle: 'researchTitle'
};

interface ResearchLetterFormProps {
  onCompleted?: () => void;
  readOnly?: boolean;
}

export function ResearchLetterForm({ onCompleted, readOnly = false }: ResearchLetterFormProps) {
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ResearchLetterFieldErrors>({});
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pdf' | 'qr' | null>(null);
  const [useStudentEmail, setUseStudentEmail] = useState(false);
  const [emailSuccessState, setEmailSuccessState] = useState<{ email: string; letterNumber?: string | null; accessCode?: string | null } | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrAccessCode, setQrAccessCode] = useState<string | null>(null);
  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [researchPlaceSameAsDestination, setResearchPlaceSameAsDestination] = useState(false);

  const { lecturers } = useLecturers();
  const { studyPrograms } = useStudyPrograms();

  const { register, control, getValues, setValue, reset, watch } = useForm<ResearchLetterData>({
    defaultValues: createDefaultResearchData()
  });

  const { fields: advisorFields, append: appendAdvisor, remove: removeAdvisor } = useFieldArray({
    control,
    name: 'advisors'
  });

  const { fields: ccFields, append: appendCc, remove: removeCc } = useFieldArray({
    control,
    name: 'carbonCopies'
  });

  const destinationPlaceValue = watch('destinationPlace');
  const nimValue = watch('nim');

  const buildStudentEmail = (identifier?: string) => {
    const cleanIdentifier = String(identifier || '').trim();
    return cleanIdentifier ? `${cleanIdentifier}@student.uksw.edu` : '';
  };

  React.useEffect(() => {
    if (researchPlaceSameAsDestination) {
      setValue('researchPlace', destinationPlaceValue || '');
    }
  }, [destinationPlaceValue, researchPlaceSameAsDestination, setValue]);

  React.useEffect(() => {
    if (useStudentEmail) {
      setValue('email', buildStudentEmail(nimValue), { shouldDirty: true, shouldValidate: true });
    }
  }, [useStudentEmail, nimValue, setValue]);

  const lecturerOptions: SelectOption[] = useMemo(() => {
    return lecturers.map((lecturer) => ({
      value: lecturer.nama,
      label: lecturer.nama,
      subLabel: lecturer.jabatan || lecturer.id
    }));
  }, [lecturers]);

  const prodiOptions: SelectOption[] = useMemo(() => {
    return studyPrograms.map((program) => ({
      value: program.id,
      label: `${program.level} ${program.name}`,
      subLabel: `Kode: ${program.id}`
    }));
  }, [studyPrograms]);

  const handleProdiSelect = useCallback((prodiId: string) => {
    setSelectedProdiId(prodiId);

    const selectedProdi = studyPrograms.find((program) => program.id === prodiId);
    if (!selectedProdi) {
      setValue('studyProgramId', '');
      setValue('studyProgramName', '');
      setValue('studyProgramLevel', '');
      return;
    }

    setValue('studyProgramId', selectedProdi.id);
    setValue('studyProgramName', selectedProdi.name);
    setValue('studyProgramLevel', selectedProdi.level);
  }, [setValue, studyPrograms]);

  const resetFlow = useCallback(() => {
    const defaultData = createDefaultResearchData();
    reset(defaultData);
    setSelectedProdiId('');
    setQrUrl(null);
    setQrAccessCode(null);
    setUseStudentEmail(false);
    setEmailSuccessState(null);
    setResearchPlaceSameAsDestination(false);
    setFormFeedback(null);
    setFieldErrors({});
  }, [reset]);

  const buildPayload = () => {
    const values = getValues();
    const advisors = (values.advisors || [])
      .map((advisor) => ({
        name: advisor.name.trim(),
        title: (advisor.title || '').trim()
      }))
      .filter((advisor) => advisor.name);

    return {
      ...values,
      includeResearchPlace: true,
      advisors: advisors.map((advisor, index) => {
        const defaultTitle = advisors.length === 1 ? 'Dosen Pembimbing' : `Dosen Pembimbing ${index === 0 ? 'I' : 'II'}`;
        if (advisors.length === 1 && /^Dosen Pembimbing (I|II)$/.test(advisor.title)) {
          return { name: advisor.name, title: defaultTitle };
        }
        return {
          name: advisor.name,
          title: advisor.title === 'Dosen Pembimbing' && advisors.length > 1 ? defaultTitle : advisor.title || defaultTitle
        };
      }),
      carbonCopies: (values.carbonCopies || [])
        .map((cc) => ({ role: cc.role.trim(), name: cc.name?.trim() || '' }))
        .filter((cc) => cc.role || cc.name)
    };
  };

  const validatePayload = (data: ReturnType<typeof buildPayload>) => {
    if (!data.name.trim()) return { field: 'name' as const, message: 'Nama mahasiswa wajib diisi.' };
    if (!data.nim.trim()) return { field: 'nim' as const, message: 'NIM mahasiswa wajib diisi.' };
    if (!data.studyProgramName) return { field: 'studyProgram' as const, message: 'Program studi wajib dipilih.' };
    if (!data.recipientTitle.trim()) return { field: 'recipientTitle' as const, message: 'Jabatan penerima surat wajib diisi.' };
    if (!data.destinationPlace.trim()) return { field: 'destinationPlace' as const, message: 'Instansi atau tempat tujuan surat wajib diisi.' };
    if (!data.destinationAddress.trim()) return { field: 'destinationAddress' as const, message: 'Alamat tujuan surat wajib diisi.' };
    if (!data.researchPlace.trim()) return { field: 'researchPlace' as const, message: 'Tempat penelitian wajib diisi.' };
    if (!data.researchTitle.trim()) return { field: 'researchTitle' as const, message: 'Judul penelitian wajib diisi.' };
    return null;
  };

  const ensureValidPayload = () => {
    const payload = buildPayload();
    const validationError = validatePayload(payload);
    if (validationError) {
      setFieldErrors({ [validationError.field]: validationError.message });
      setFormFeedback({ type: 'error', message: validationError.message });
      const focusId = researchFieldFocusIds[validationError.field];
      if (focusId) {
        window.setTimeout(() => document.getElementById(focusId)?.focus(), 0);
      }
      return null;
    }
    setFieldErrors({});
    return payload;
  };

  const handleDownloadPdf = async () => {
    const payload = ensureValidPayload();
    if (!payload) return;

    setIsDownloadingPdf(true);
    setFormFeedback(null);
    try {
      const res = await api('/api/tu/research-letter/generate-and-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({ error: 'Gagal mengunduh PDF.' }));
        throw new Error(errorJson.error);
      }

      const blob = await res.blob();
      const accessCode = res.headers.get('X-Research-Access-Code');
      const filename = `SuratPenelitian_${safeFilenamePart(payload.researchPlace || payload.name)}.pdf`;
      const forceBrowserDownloadBlob = new Blob([blob], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(forceBrowserDownloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      localStorage.setItem('core_fti_last_research_cc', JSON.stringify(payload.carbonCopies || []));
      setFormFeedback({
        type: 'success',
        message: accessCode
          ? `Surat penelitian berhasil diunduh dan diarsipkan. Kode akses: ${accessCode}.`
          : 'Surat penelitian berhasil diunduh dan diarsipkan.'
      });
      onCompleted?.();
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal mengunduh PDF surat penelitian.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleGenerateQr = async () => {
    const payload = ensureValidPayload();
    if (!payload) return;

    setIsGeneratingQr(true);
    setFormFeedback(null);
    try {
      const res = await api('/api/tu/research-letter/generate-qr-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({ error: 'Gagal membuat QR.' }));
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal membuat QR.');

      localStorage.setItem('core_fti_last_research_cc', JSON.stringify(payload.carbonCopies || []));
      setQrUrl(json.validationUrl || json.qrUrl || null);
      setQrAccessCode(json.accessCode || null);
      setFormFeedback({
        type: 'success',
        message: json.accessCode
          ? `QR validasi surat penelitian berhasil dibuat. Kode akses: ${json.accessCode}.`
          : 'QR validasi surat penelitian berhasil dibuat.'
      });
      onCompleted?.();
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal membuat QR validasi surat penelitian.' });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleSendEmail = async () => {
    const payload = ensureValidPayload();
    if (!payload) return;

    const emailToUse = String(payload.email || '').trim();
    if (!emailToUse || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      setFormFeedback({ type: 'error', message: 'Alamat email mahasiswa tidak valid.' });
      return;
    }

    setIsSendingEmail(true);
    setFormFeedback(null);
    try {
      const res = await api('/api/tu/research-letter/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, targetEmail: emailToUse })
      });
      const json = await res.json().catch(() => ({ error: 'Gagal mengirim email.' }));
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengirim email.');

      localStorage.setItem('core_fti_last_research_cc', JSON.stringify(payload.carbonCopies || []));
      setFormFeedback({ type: 'success', message: `Surat penelitian berhasil dikirim ke ${emailToUse}.` });
      setEmailSuccessState({ email: emailToUse, letterNumber: json.letterNumber || null, accessCode: json.accessCode || null });
      onCompleted?.();
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal mengirim email surat penelitian.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirm = () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'pdf') handleDownloadPdf();
    if (action === 'qr') handleGenerateQr();
  };

  return (
    <>
      <Card className="w-full overflow-visible border-0 shadow-xl ring-1 ring-slate-900/5 dark:ring-gray-700">
        <CardHeader className="border-b border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800/70">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Surat Rekomendasi Penelitian
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {formFeedback && (
            <div
              className={`m-6 rounded-lg border px-4 py-3 text-sm ${
                formFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300'
                  : formFeedback.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300'
                    : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300'
              }`}
            >
              {formFeedback.message}
            </div>
          )}

          <div className="space-y-0">
            <section className="border-b border-slate-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-5 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Building2 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Tujuan Surat</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="recipientName">Nama Penerima</Label>
                  <Input id="recipientName" placeholder="Contoh: Kepala Dinas Pendidikan" disabled={readOnly} aria-invalid={Boolean(fieldErrors.recipientName)} {...register('recipientName')} />
                  {fieldErrors.recipientName && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.recipientName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recipientTitle">Jabatan Penerima <span className="text-red-500">*</span></Label>
                  <Input id="recipientTitle" placeholder="Contoh: Kepala Sekolah / HRD Manager" disabled={readOnly} aria-invalid={Boolean(fieldErrors.recipientTitle)} {...register('recipientTitle')} />
                  {fieldErrors.recipientTitle && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.recipientTitle}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="destinationPlace">Instansi / Tempat Tujuan <span className="text-red-500">*</span></Label>
                  <Input id="destinationPlace" placeholder="Contoh: Dinas Pendidikan Kota Salatiga" disabled={readOnly} aria-invalid={Boolean(fieldErrors.destinationPlace)} {...register('destinationPlace')} />
                  {fieldErrors.destinationPlace && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.destinationPlace}</p>}
                </div>
                <div className="space-y-1.5 md:row-span-2">
                  <Label htmlFor="destinationAddress">Alamat Tujuan Surat <span className="text-red-500">*</span></Label>
                  <Textarea id="destinationAddress" placeholder="Alamat lengkap instansi atau dinas tujuan" className="min-h-28 resize-y" disabled={readOnly} aria-invalid={Boolean(fieldErrors.destinationAddress)} {...register('destinationAddress')} />
                  {fieldErrors.destinationAddress && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.destinationAddress}</p>}
                </div>
              </div>
            </section>

            <section className="border-b border-slate-200 bg-slate-50/60 p-6 dark:border-gray-700 dark:bg-gray-800/30">
              <div className="mb-5 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <GraduationCap className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Data Akademik</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Program Studi <span className="text-red-500">*</span></Label>
                  <SearchableSelect
                    options={prodiOptions}
                    value={selectedProdiId}
                    onChange={handleProdiSelect}
                    placeholder="Pilih Program Studi"
                    searchPlaceholder="Cari program studi..."
                    disabled={readOnly}
                  />
                  {fieldErrors.studyProgram && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.studyProgram}</p>}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="assignmentType">Jenis Tugas</Label>
                  <Input id="assignmentType" placeholder="Tugas Talenta Unggul" disabled={readOnly} {...register('assignmentType')} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="researchPlace">Tempat Penelitian <span className="text-red-500">*</span></Label>
                    <label htmlFor="research-place-same" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        id="research-place-same"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500"
                        checked={researchPlaceSameAsDestination}
                        disabled={readOnly}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setResearchPlaceSameAsDestination(checked);
                          if (checked) {
                            setValue('researchPlace', getValues('destinationPlace') || '');
                          }
                        }}
                      />
                      Sama dengan tujuan surat?
                    </label>
                  </div>
                  <Input
                    id="researchPlace"
                    placeholder="Contoh: SMA Kristen 1 Salatiga"
                    disabled={readOnly || researchPlaceSameAsDestination}
                    className={researchPlaceSameAsDestination ? "bg-slate-50 dark:bg-slate-900/50" : undefined}
                    aria-invalid={Boolean(fieldErrors.researchPlace)}
                    {...register('researchPlace')}
                  />
                  {fieldErrors.researchPlace && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.researchPlace}</p>}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="researchTitle">Judul Penelitian <span className="text-red-500">*</span></Label>
                  <Textarea id="researchTitle" placeholder="Judul penelitian mahasiswa" className="min-h-24 resize-y" disabled={readOnly} aria-invalid={Boolean(fieldErrors.researchTitle)} {...register('researchTitle')} />
                  {fieldErrors.researchTitle && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.researchTitle}</p>}
                </div>
              </div>
            </section>

            <section className="border-b border-slate-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-5 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <UserRound className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Data Mahasiswa</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="name">Nama Mahasiswa <span className="text-red-500">*</span></Label>
                  <Input id="name" placeholder="Nama lengkap mahasiswa" disabled={readOnly} aria-invalid={Boolean(fieldErrors.name)} {...register('name')} />
                  {fieldErrors.name && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nim">NIM <span className="text-red-500">*</span></Label>
                  <Input id="nim" placeholder="6720xxxxx" disabled={readOnly} aria-invalid={Boolean(fieldErrors.nim)} {...register('nim')} />
                  {fieldErrors.nim && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.nim}</p>}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="email">Email Mahasiswa</Label>
                    <label htmlFor="research-email-student" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        id="research-email-student"
                        type="checkbox"
                        checked={useStudentEmail}
                        disabled={readOnly}
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
                    placeholder={useStudentEmail ? "6720xxxxx@student.uksw.edu" : "nama@student.uksw.edu"}
                    disabled={readOnly || useStudentEmail}
                    className={useStudentEmail ? "bg-slate-50 dark:bg-slate-900/50" : undefined}
                    {...register('email')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPerson">Nomor Kontak</Label>
                  <Input id="contactPerson" placeholder="Nomor HP / email" disabled={readOnly} {...register('contactPerson')} />
                </div>
              </div>
            </section>

            <section className="border-b border-slate-200 bg-slate-50/60 p-6 dark:border-gray-700 dark:bg-gray-800/30">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Users className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Dosen Pembimbing</h3>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-gray-700 dark:text-slate-300">
                  {advisorFields.length} / {MAX_RESEARCH_ADVISORS}
                </span>
              </div>

              <div className="space-y-3">
                {advisorFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:grid-cols-[1fr_220px_auto]">
                    <div className="space-y-1.5">
                      <Label>Nama Pembimbing {index + 1}</Label>
                      <SearchableSelect
                        options={lecturerOptions}
                        value={watch(`advisors.${index}.name`) || ''}
                        onChange={(value) => {
                          setValue(`advisors.${index}.name`, value);
                          setValue(`advisors.${index}.title`, advisorFields.length === 1 ? 'Dosen Pembimbing' : `Dosen Pembimbing ${index === 0 ? 'I' : 'II'}`);
                        }}
                        placeholder="Pilih Dosen"
                        searchPlaceholder="Cari nama dosen..."
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Label Jabatan</Label>
                      <Input disabled={readOnly} {...register(`advisors.${index}.title` as const)} />
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        onClick={() => removeAdvisor(index)}
                        aria-label={`Hapus dosen pembimbing ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full border-2 border-dashed text-slate-600 hover:bg-slate-100 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800 sm:w-auto"
                onClick={() => {
                  if (advisorFields.length === 1) {
                    setValue('advisors.0.title', 'Dosen Pembimbing I');
                  }
                  appendAdvisor({ name: '', title: advisorFields.length === 0 ? 'Dosen Pembimbing' : 'Dosen Pembimbing II' });
                }}
                disabled={readOnly || advisorFields.length >= MAX_RESEARCH_ADVISORS}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Dosen Pembimbing
              </Button>
            </section>

            <section className="border-b border-slate-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Users className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Tembusan</h3>
                </div>
              </div>
              <div className="space-y-3">
                {ccFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1.5">
                      <Label>Jabatan / Unit</Label>
                      <Input placeholder="Contoh: Kaprogdi" disabled={readOnly} {...register(`carbonCopies.${index}.role` as const)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nama</Label>
                      <Input placeholder="Opsional" disabled={readOnly} {...register(`carbonCopies.${index}.name` as const)} />
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        onClick={() => removeCc(index)}
                        aria-label={`Hapus tembusan ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full border-2 border-dashed text-slate-600 hover:bg-slate-100 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800 sm:w-auto"
                onClick={() => appendCc({ role: '', name: '' })}
                disabled={readOnly}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Tembusan
              </Button>
            </section>

            <section className="flex justify-end bg-white p-6 dark:bg-gray-900">
              <LetterActionMenu
                className="sm:min-w-52"
                disabled={readOnly}
                isDownloadingPdf={isDownloadingPdf}
                isGeneratingQr={isGeneratingQr}
                isSendingEmail={isSendingEmail}
                onDownloadPdf={() => setConfirmAction('pdf')}
                onGenerateQr={() => setConfirmAction('qr')}
                onSendEmail={handleSendEmail}
              />
            </section>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembuatan Surat</AlertDialogTitle>
            <AlertDialogDescription>
              Data akan diberi nomor surat resmi, disimpan ke arsip, dan dibuatkan QR validasi.
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

      <Dialog open={Boolean(qrUrl)} onOpenChange={(open) => !open && setQrUrl(null)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">QR Validasi Surat</DialogTitle>
            <DialogDescription>Scan QR untuk membuka halaman validasi publik surat ini.</DialogDescription>
          </DialogHeader>
          {qrUrl && (
            <>
              <div className="inline-block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <ValidationQrCode value={qrUrl} size={192} className="h-48 w-48" ariaLabel="QR Code Validasi Surat Penelitian" />
              </div>
              {qrAccessCode && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-900/50 dark:bg-blue-950/20">
                  <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-300">Kode akses surat</p>
                  <p className="mt-2 text-center text-xl font-bold text-slate-900 dark:text-white">{qrAccessCode}</p>
                </div>
              )}
              <div className="break-all rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-500 dark:bg-gray-700/50 dark:text-gray-400">
                {qrUrl}
              </div>
            </>
          )}
          <Button type="button" className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={resetFlow}>
            Selesai & Buat Surat Baru
          </Button>
        </DialogContent>
      </Dialog>

      <EmailActionOverlay
        open={isSendingEmail}
        title="Mengirim surat penelitian..."
        description="Sistem sedang membuat PDF final lalu mengirimkannya ke email tujuan."
      />
      <EmailSuccessDialog
        open={Boolean(emailSuccessState)}
        onClose={resetFlow}
        recipientEmail={emailSuccessState?.email}
        letterNumber={emailSuccessState?.letterNumber}
        accessCode={emailSuccessState?.accessCode}
        title="Surat penelitian berhasil dikirim"
      />
    </>
  );
}
