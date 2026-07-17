import {
  Buildings as Building2,
  FileText,
  GraduationCap,
  Plus,
  Trash as Trash2,
  UserCircle as UserRound,
  Users
} from '@phosphor-icons/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { WilayahAddressInput } from './WilayahAddressInput';
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
import SearchableSelect, { SelectOption } from '../../components/SearchableSelect';
import { useLecturers } from '../../hooks/useLecturers';
import { useStudyPrograms } from '../../hooks/useStudyPrograms';
import { api } from '../../services/api';
import { ResearchLetterData } from '../types';

const MAX_RESEARCH_ADVISORS = 2;
const DEFAULT_RESEARCH_ASSIGNMENT_TYPE = 'Tugas Talenta Unggul';
const DEFAULT_RESEARCH_ADVISOR_TITLE = 'Dosen Pembimbing';
const DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST = 'Dosen Pembimbing I';
const DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND = 'Dosen Pembimbing II';
const DEFAULT_INTERVIEW_ASSIGNMENT_TYPE = 'Tugas Talenta Unggul';
const DEFAULT_INTERVIEW_ADVISOR_TITLE = 'Dosen Pembimbing';
const DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST = 'Dosen Pembimbing I';
const DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND = 'Dosen Pembimbing II';
const DEFAULT_PERMISSION_ASSIGNMENT_TYPE = 'Tugas Talenta Unggul';
const DEFAULT_PERMISSION_ADVISOR_TITLE = 'Dosen Pembimbing';
const DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST = 'Dosen Pembimbing I';
const DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND = 'Dosen Pembimbing II';

type ResearchFormDefaults = {
  assignmentType: string;
  advisorTitle: string;
  advisorTitleFirst: string;
  advisorTitleSecond: string;
};

const createDefaultResearchDefaults = (variant?: 'research' | 'interview' | 'permission'): ResearchFormDefaults => {
  if (variant === 'interview') {
    return {
      assignmentType: DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
      advisorTitle: DEFAULT_INTERVIEW_ADVISOR_TITLE,
      advisorTitleFirst: DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
      advisorTitleSecond: DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND
    };
  }
  if (variant === 'permission') {
    return {
      assignmentType: DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
      advisorTitle: DEFAULT_PERMISSION_ADVISOR_TITLE,
      advisorTitleFirst: DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
      advisorTitleSecond: DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND
    };
  }
  return {
    assignmentType: DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
    advisorTitle: DEFAULT_RESEARCH_ADVISOR_TITLE,
    advisorTitleFirst: DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
    advisorTitleSecond: DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND
  };
};

const normalizeResearchDefaults = (
  settings: Partial<ResearchFormDefaults> = {},
  variant: 'research' | 'interview' | 'permission' = 'research'
): ResearchFormDefaults => {
  const defaults = createDefaultResearchDefaults(variant);
  return {
    assignmentType: settings.assignmentType?.trim() || defaults.assignmentType,
    advisorTitle: settings.advisorTitle?.trim() || defaults.advisorTitle,
    advisorTitleFirst: settings.advisorTitleFirst?.trim() || defaults.advisorTitleFirst,
    advisorTitleSecond: settings.advisorTitleSecond?.trim() || defaults.advisorTitleSecond
  };
};

const getResearchAdvisorTitle = (index: number, total: number, defaults: ResearchFormDefaults) => {
  if (total <= 1) return defaults.advisorTitle;
  return index === 0 ? defaults.advisorTitleFirst : defaults.advisorTitleSecond;
};

const getInitialResearchCc = (storageKey = 'core_fti_last_research_cc') => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load research carbon copies:', e);
  }
  return [];
};

const createDefaultResearchData = (
  defaults: ResearchFormDefaults,
  letterKind: ResearchLetterVariant = 'research',
  storageKey = 'core_fti_last_research_cc'
): ResearchLetterData => ({
  name: '',
  nim: '',
  email: '',
  recipientName: '',
  recipientTitle: '',
  destinationPlace: '',
  destinationAddress: '',
  addressStreet: '',
  addressKecamatan: '',
  addressKelurahan: '',
  addressCity: '',
  addressProvince: '',
  addressPostalCode: '',
  researchPlace: '',
  assignmentType: defaults.assignmentType,
  researchTitle: '',
  permissionPurpose: '',
  contactPerson: '',
  studyProgramId: '',
  studyProgramName: '',
  studyProgramLevel: '',
  advisors: [],
  includeResearchPlace: true,
  letterKind,
  carbonCopies: getInitialResearchCc(storageKey)
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
  | 'addressStreet'
  | 'addressKelurahan'
  | 'addressKecamatan'
  | 'addressCity'
  | 'addressProvince'
  | 'researchPlace'
  | 'researchTitle'
  | 'permissionPurpose';

type ResearchLetterFieldErrors = Partial<Record<ResearchLetterErrorField, string>>;

const researchFieldFocusIds: Partial<Record<ResearchLetterErrorField, string>> = {
  name: 'name',
  nim: 'nim',
  recipientName: 'recipientName',
  recipientTitle: 'recipientTitle',
  destinationPlace: 'destinationPlace',
  destinationAddress: 'addressStreet',
  addressStreet: 'addressStreet',
  addressKelurahan: 'addressKelurahan',
  addressKecamatan: 'addressKecamatan',
  addressCity: 'addressCity',
  addressProvince: 'addressProvince',
  researchPlace: 'researchPlace',
  researchTitle: 'researchTitle',
  permissionPurpose: 'permissionPurpose'
};

type ResearchLetterVariant = 'research' | 'interview' | 'permission';

const letterVariantConfig: Record<ResearchLetterVariant, {
  title: string;
  placeLabel: string;
  placePlaceholder: string;
  titleLabel: string;
  titlePlaceholder: string;
  purposeLabel?: string;
  purposePlaceholder?: string;
  endpointBase: string;
  filenamePrefix: string;
  storageKey: string;
  successLabel: string;
  qrAriaLabel: string;
  sendOverlayTitle: string;
  sendSuccessTitle: string;
  validatePlaceMessage: string;
  validateTitleMessage: string;
}> = {
  research: {
    title: 'Surat Rekomendasi Penelitian',
    placeLabel: 'Tempat Penelitian',
    placePlaceholder: 'Contoh: SMA Kristen 1 Salatiga',
    titleLabel: 'Judul Penelitian',
    titlePlaceholder: 'Judul penelitian mahasiswa',
    endpointBase: '/api/tu/research-letter',
    filenamePrefix: 'SuratPenelitian',
    storageKey: 'core_fti_last_research_cc',
    successLabel: 'surat penelitian',
    qrAriaLabel: 'QR Code Validasi Surat Penelitian',
    sendOverlayTitle: 'Mengirim surat penelitian...',
    sendSuccessTitle: 'Surat penelitian berhasil dikirim',
    validatePlaceMessage: 'Tempat penelitian wajib diisi.',
    validateTitleMessage: 'Judul penelitian wajib diisi.'
  },
  interview: {
    title: 'Surat Izin Wawancara',
    placeLabel: 'Tempat Wawancara',
    placePlaceholder: 'Contoh: Dinas Komunikasi dan Informatika Kota Salatiga',
    titleLabel: 'Topik / Judul Wawancara',
    titlePlaceholder: 'Topik atau judul kegiatan wawancara mahasiswa',
    endpointBase: '/api/tu/interview-letter',
    filenamePrefix: 'SuratWawancara',
    storageKey: 'core_fti_last_interview_cc',
    successLabel: 'surat wawancara',
    qrAriaLabel: 'QR Code Validasi Surat Wawancara',
    sendOverlayTitle: 'Mengirim surat wawancara...',
    sendSuccessTitle: 'Surat wawancara berhasil dikirim',
    validatePlaceMessage: 'Tempat wawancara wajib diisi.',
    validateTitleMessage: 'Topik atau judul wawancara wajib diisi.'
  },
  permission: {
    title: 'Surat Perizinan',
    placeLabel: 'Lokasi / Instansi Perizinan',
    placePlaceholder: 'Contoh: PT Satya Data Indonesia',
    titleLabel: 'Judul Tugas Akhir',
    titlePlaceholder: 'Judul tugas akhir mahasiswa',
    purposeLabel: 'Keperluan Izin',
    purposePlaceholder: 'Contoh: pengambilan data, penerbangan drone, dll',
    endpointBase: '/api/tu/permission-letter',
    filenamePrefix: 'SuratPerizinan',
    storageKey: 'core_fti_last_permission_cc',
    successLabel: 'surat perizinan',
    qrAriaLabel: 'QR Code Validasi Surat Perizinan',
    sendOverlayTitle: 'Mengirim surat perizinan...',
    sendSuccessTitle: 'Surat perizinan berhasil dikirim',
    validatePlaceMessage: 'Lokasi atau instansi perizinan wajib diisi.',
    validateTitleMessage: 'Judul tugas akhir wajib diisi.'
  }
};

interface ResearchLetterFormProps {
  onCompleted?: () => void;
  onReturnToMenu?: () => void;
  readOnly?: boolean;
  variant?: ResearchLetterVariant;
}

export function ResearchLetterForm({ onCompleted, onReturnToMenu, readOnly = false, variant = 'research' }: ResearchLetterFormProps) {
  const variantConfig = letterVariantConfig[variant];
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ResearchLetterFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [useStudentEmail, setUseStudentEmail] = useState(false);
  const [selectedProdiId, setSelectedProdiId] = useState('');
  const [researchPlaceSameAsDestination, setResearchPlaceSameAsDestination] = useState(false);
  const [researchDefaults, setResearchDefaults] = useState<ResearchFormDefaults>(() => createDefaultResearchDefaults(variant));

  const { lecturers } = useLecturers();
  const { studyPrograms } = useStudyPrograms();

  const { register, control, getValues, setValue, reset, watch } = useForm<ResearchLetterData>({
    defaultValues: createDefaultResearchData(createDefaultResearchDefaults(variant), variant, variantConfig.storageKey)
  });

  const { fields: advisorFields, append: appendAdvisor, remove: removeAdvisor } = useFieldArray({
    control,
    name: 'advisors'
  });

  const { fields: ccFields, append: appendCc, remove: removeCc } = useFieldArray({
    control,
    name: 'carbonCopies'
  });

  const advisorRoleLabel = researchDefaults.advisorTitle;
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
    let cancelled = false;

    const fetchResearchDefaults = async () => {
      try {
        const res = await api('/api/tu/letter-backgrounds');
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || cancelled) return;

        let assignmentType = json.researchAssignmentType;
        let advisorTitle = json.researchAdvisorTitle;
        let advisorTitleFirst = json.researchAdvisorTitleFirst;
        let advisorTitleSecond = json.researchAdvisorTitleSecond;

        if (variant === 'interview') {
          assignmentType = json.interviewAssignmentType;
          advisorTitle = json.interviewAdvisorTitle;
          advisorTitleFirst = json.interviewAdvisorTitleFirst;
          advisorTitleSecond = json.interviewAdvisorTitleSecond;
        } else if (variant === 'permission') {
          assignmentType = json.permissionAssignmentType;
          advisorTitle = json.permissionAdvisorTitle;
          advisorTitleFirst = json.permissionAdvisorTitleFirst;
          advisorTitleSecond = json.permissionAdvisorTitleSecond;
        }

        const nextDefaults = normalizeResearchDefaults({
          assignmentType,
          advisorTitle,
          advisorTitleFirst,
          advisorTitleSecond
        }, variant);
        setResearchDefaults(nextDefaults);
        setValue('assignmentType', nextDefaults.assignmentType, { shouldDirty: false, shouldValidate: false });

        const currentAdvisors = getValues('advisors') || [];
        currentAdvisors.forEach((_, index) => {
          setValue(`advisors.${index}.title`, getResearchAdvisorTitle(index, currentAdvisors.length, nextDefaults), {
            shouldDirty: false,
            shouldValidate: false
          });
        });
      } catch (error) {
        console.error('Failed to fetch research letter defaults:', error);
      }
    };

    fetchResearchDefaults();

    return () => {
      cancelled = true;
    };
  }, [getValues, setValue, variant]);

  React.useEffect(() => {
    const currentAdvisors = getValues('advisors') || [];
    currentAdvisors.forEach((_, index) => {
      setValue(`advisors.${index}.title`, getResearchAdvisorTitle(index, currentAdvisors.length, researchDefaults), {
        shouldDirty: false,
        shouldValidate: false
      });
    });
  }, [advisorFields.length, getValues, researchDefaults, setValue]);

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
    const defaultData = createDefaultResearchData(researchDefaults, variant, variantConfig.storageKey);
    reset(defaultData);
    setSelectedProdiId('');
    setUseStudentEmail(false);
    setResearchPlaceSameAsDestination(false);
    setFormFeedback(null);
    setFieldErrors({});
  }, [reset, researchDefaults, variant, variantConfig.storageKey]);

  const buildPayload = () => {
    const values = getValues();
    const advisors = (values.advisors || [])
      .map((advisor) => ({
        name: advisor.name.trim()
      }))
      .filter((advisor) => advisor.name);

    const combinedAddress = values.destinationAddress?.trim() || '';

    return {
      ...values,
      destinationAddress: combinedAddress || values.destinationAddress,
      letterKind: variant,
      recipientTitle: values.recipientTitle?.trim() || '',
      assignmentType: researchDefaults.assignmentType,
      permissionPurpose: values.permissionPurpose?.trim() || '',
      includeResearchPlace: true,
      advisors: advisors.map((advisor, index) => ({
        name: advisor.name,
        title: getResearchAdvisorTitle(index, advisors.length, researchDefaults)
      })),
      carbonCopies: (values.carbonCopies || [])
        .map((cc) => ({ role: cc.role.trim(), name: cc.name?.trim() || '' }))
        .filter((cc) => cc.role || cc.name)
    };
  };

  const validatePayload = (data: ReturnType<typeof buildPayload>) => {
    if (!data.name.trim()) return { field: 'name' as const, message: 'Nama mahasiswa wajib diisi.' };
    if (!data.nim.trim()) return { field: 'nim' as const, message: 'NIM mahasiswa wajib diisi.' };
    if (!data.studyProgramName) return { field: 'studyProgram' as const, message: 'Program studi wajib dipilih.' };
    if (!data.recipientTitle?.trim()) return { field: 'recipientTitle' as const, message: 'Jabatan penerima surat wajib diisi.' };
    if (!data.destinationPlace.trim()) return { field: 'destinationPlace' as const, message: 'Instansi atau tempat tujuan surat wajib diisi.' };
    if (!data.destinationAddress?.trim()) return { field: 'destinationAddress' as const, message: 'Alamat lengkap wajib diisi.' };
    if (variant === 'permission' && !data.permissionPurpose?.trim()) return { field: 'permissionPurpose' as const, message: 'Keperluan izin wajib diisi.' };
    if (!data.researchPlace.trim()) return { field: 'researchPlace' as const, message: variantConfig.validatePlaceMessage };
    if (!data.researchTitle.trim()) return { field: 'researchTitle' as const, message: variantConfig.validateTitleMessage };
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

  const handleSubmitRequest = async () => {
    const payload = ensureValidPayload();
    if (!payload) return;

    setIsSubmitting(true);
    setFormFeedback(null);
    try {
      const res = await api(`${variantConfig.endpointBase}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 90000
      });
      const json = await res.json().catch(() => ({ error: 'Gagal mengajukan surat.' }));
      if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengajukan surat.');

      localStorage.setItem(variantConfig.storageKey, JSON.stringify(payload.carbonCopies || []));
      setFormFeedback({
        type: 'success',
        message: json.message || 'Surat berhasil diajukan dan sedang menunggu persetujuan Admin TU.'
      });
      onCompleted?.();
      if (onReturnToMenu) {
        setTimeout(() => {
          onReturnToMenu();
        }, 2500);
      }
    } catch (error) {
      setFormFeedback({ type: 'error', message: error instanceof Error ? error.message : `Gagal mengajukan ${variantConfig.successLabel}.` });
    } finally {
      setIsSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  return (
    <>
      <Card className="w-full overflow-visible border-0 shadow-xl ring-1 ring-slate-900/5 dark:ring-gray-700">
        <CardHeader className="border-b border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800/70">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {variantConfig.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            <section className="border-b border-slate-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-5 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Building2 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Tujuan Surat</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="recipientName">Nama Penerima</Label>
                  <Input id="recipientName" placeholder="Contoh: John Doe" disabled={readOnly} aria-invalid={Boolean(fieldErrors.recipientName)} {...register('recipientName')} />
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
                <div className="space-y-4 md:col-span-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="destinationAddress">Alamat Tujuan Surat <span className="text-red-500">*</span></Label>
                    <Controller
                      name="destinationAddress"
                      control={control}
                      render={({ field }) => (
                        <WilayahAddressInput
                          id="destinationAddress"
                          value={field.value || ''}
                          onChange={field.onChange}
                          disabled={readOnly}
                        />
                      )}
                    />
                    {fieldErrors.destinationAddress && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.destinationAddress}</p>}
                  </div>
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
                <input type="hidden" {...register('assignmentType')} />
                {variant === 'permission' && (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="permissionPurpose">{variantConfig.purposeLabel} <span className="text-red-500">*</span></Label>
                    <Input
                      id="permissionPurpose"
                      placeholder={variantConfig.purposePlaceholder}
                      disabled={readOnly}
                      aria-invalid={Boolean(fieldErrors.permissionPurpose)}
                      {...register('permissionPurpose')}
                    />
                    {fieldErrors.permissionPurpose && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.permissionPurpose}</p>}
                  </div>
                )}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Label htmlFor="researchPlace">{variantConfig.placeLabel} <span className="text-red-500">*</span></Label>
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
                    placeholder={variantConfig.placePlaceholder}
                    disabled={readOnly || researchPlaceSameAsDestination}
                    className={researchPlaceSameAsDestination ? "bg-slate-50 dark:bg-slate-900/50" : undefined}
                    aria-invalid={Boolean(fieldErrors.researchPlace)}
                    {...register('researchPlace')}
                  />
                  {fieldErrors.researchPlace && <p className="text-xs text-red-600 dark:text-red-300">{fieldErrors.researchPlace}</p>}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="researchTitle">{variantConfig.titleLabel} <span className="text-red-500">*</span></Label>
                  <Textarea id="researchTitle" placeholder={variantConfig.titlePlaceholder} className="min-h-24 resize-y" disabled={readOnly} aria-invalid={Boolean(fieldErrors.researchTitle)} {...register('researchTitle')} />
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
                  <h3 className="text-lg font-semibold">{advisorRoleLabel}</h3>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-gray-700 dark:text-slate-300">
                  {advisorFields.length} / {MAX_RESEARCH_ADVISORS}
                </span>
              </div>

              <div className="space-y-3">
                {advisorFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                      <Label>Nama {advisorRoleLabel} {index + 1}</Label>
                      <SearchableSelect
                        options={lecturerOptions}
                        value={watch(`advisors.${index}.name`) || ''}
                        onChange={(value) => {
                          setValue(`advisors.${index}.name`, value);
                          setValue(`advisors.${index}.title`, getResearchAdvisorTitle(index, advisorFields.length, researchDefaults));
                        }}
                        placeholder="Pilih Dosen"
                        searchPlaceholder="Cari nama dosen..."
                        disabled={readOnly}
                      />
                      <input type="hidden" {...register(`advisors.${index}.title` as const)} />
                      <span className="inline-flex w-fit rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                        {getResearchAdvisorTitle(index, advisorFields.length, researchDefaults)}
                      </span>
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        onClick={() => removeAdvisor(index)}
                        aria-label={`Hapus ${advisorRoleLabel.toLowerCase()} ${index + 1}`}
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
                  const nextTotal = advisorFields.length + 1;
                  if (advisorFields.length === 1) {
                    setValue('advisors.0.title', getResearchAdvisorTitle(0, nextTotal, researchDefaults));
                  }
                  appendAdvisor({ name: '', title: getResearchAdvisorTitle(advisorFields.length, nextTotal, researchDefaults) });
                }}
                disabled={readOnly || advisorFields.length >= MAX_RESEARCH_ADVISORS}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah {advisorRoleLabel}
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

            <section className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 dark:bg-gray-900">
              <div className="flex-1 w-full">
                {formFeedback && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
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
              </div>
              <Button
                type="button"
                className="sm:min-w-52 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={readOnly || isSubmitting}
                onClick={() => setConfirmSubmit(true)}
              >
                {isSubmitting ? (
                  <><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Mengajukan...</>
                ) : (
                  <><FileText className="mr-2 h-4 w-4" /> Ajukan Surat</>
                )}
              </Button>
            </section>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmSubmit} onOpenChange={(open) => !open && setConfirmSubmit(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pengajuan Surat</AlertDialogTitle>
            <AlertDialogDescription>
              Data surat akan dikirimkan ke Admin TU untuk diverifikasi. Setelah disetujui, surat akan mendapatkan nomor resmi dan dapat diunduh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Periksa Kembali</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={handleSubmitRequest} className="bg-blue-600 hover:bg-blue-700">
              Yakin &amp; Ajukan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
