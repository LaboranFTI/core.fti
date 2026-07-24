import {
  ArrowLeft,
  CalendarDots as CalendarDays,
  CheckCircle,
  Clock as Clock3,
  DownloadSimple as Download,
  ArrowSquareOut as ExternalLink,
  FileText,
  GraduationCap,
  SpinnerGap as Loader2,
  EnvelopeSimple as Mail,
  PencilSimpleLine as Pencil,
  Printer,
  QrCode,
  Trash as Trash2,
  Users,
  XCircle,
  Building,
  User,
  BookOpen
} from '@phosphor-icons/react';
import React from 'react';
import { ActiveStudentRequest, ObservationRequest, CounselingRequest, SuRekRequest, ResearchRequest, TULetterBackgrounds, TULetterLayouts } from '../../types';
import { ActiveStudentLetter } from '../ActiveStudentLetter';
import { LetterPreview } from '../LetterPreview';
import { ValidationQrCode } from '../ValidationQrCode';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { ArchiveStatusBadge } from './ArchiveStatusBadge';

export type UnifiedArchiveType = 'active' | 'observation' | 'counseling' | 'su-rek' | 'research' | 'interview' | 'permission';

export interface UnifiedArchiveSelection {
  category: 'TU' | 'TA';
  type: UnifiedArchiveType;
  item: ActiveStudentRequest | ObservationRequest | CounselingRequest | SuRekRequest | ResearchRequest | any;
}

interface ArchiveDetailViewProps {
  selection: UnifiedArchiveSelection;
  onBack: () => void;
  onVerify?: (id: string, type: UnifiedArchiveType) => void;
  onReject?: (id: string, type: UnifiedArchiveType, name: string) => void;
  onSendEmail?: (type: UnifiedArchiveType, id: string) => void;
  onDownloadPdf: () => void;
  onPrint: () => void;
  onEdit?: (item: any) => void;
  onDelete: (id: string, type: UnifiedArchiveType, label: string) => void;
  onCreateValidationToken?: () => void;
  letterBackgrounds: TULetterBackgrounds;
  letterLayouts: TULetterLayouts;
  deanName?: string;
  currentSemesterCode?: string;
  isProcessing?: boolean;
  isSendingEmail?: boolean;
}

const getTypeLabel = (type: UnifiedArchiveType): string => {
  switch (type) {
    case 'active':
      return 'Surat Aktif Kuliah';
    case 'observation':
      return 'Surat Ijin Observasi';
    case 'counseling':
      return 'Surat Pengantar Konseling';
    case 'su-rek':
      return 'Surat Rekomendasi Afirmasi';
    case 'research':
      return 'Surat Tugas Akhir (Penelitian)';
    case 'interview':
      return 'Surat Tugas Akhir (Wawancara)';
    case 'permission':
      return 'Surat Tugas Akhir (Perizinan)';
    default:
      return 'Surat Tugas / TU';
  }
};

const formatArchiveDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const ArchiveDetailView: React.FC<ArchiveDetailViewProps> = ({
  selection,
  onBack,
  onVerify,
  onReject,
  onSendEmail,
  onDownloadPdf,
  onPrint,
  onEdit,
  onDelete,
  onCreateValidationToken,
  letterBackgrounds,
  letterLayouts,
  deanName = '',
  currentSemesterCode = '',
  isProcessing = false,
  isSendingEmail = false
}) => {
  const { category, type, item } = selection;
  const typeLabel = getTypeLabel(type);
  const isPending = item.status === 'pending';
  const canSendEmail = (item.status === 'verified' || item.status === 'sent') && Boolean(item.email);

  const validationUrl = item.validationToken || item.validation_token
    ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tu/validasi-surat/${item.validationToken || item.validation_token}`
    : '';

  // Resolving specific layout based on type
  const currentLayout =
    type === 'active'
      ? letterLayouts.activeStudent
      : type === 'observation'
      ? letterLayouts.observation
      : type === 'counseling'
      ? letterLayouts.counseling || letterLayouts.activeStudent
      : type === 'su-rek'
      ? letterLayouts.suRek || letterLayouts.activeStudent
      : letterLayouts[type as keyof TULetterLayouts] || letterLayouts.research || letterLayouts.activeStudent;

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white via-slate-50 to-sky-50 dark:from-gray-900 dark:via-gray-800 dark:to-sky-900/20 p-5 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="w-fit cursor-pointer dark:hover:bg-gray-800 dark:text-gray-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke daftar arsip
            </Button>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-semibold">
                  {category === 'TA' ? 'Surat Tugas Akhir' : 'Layanan Surat TU'}
                </Badge>
                <Badge variant="outline" className="border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300">
                  {typeLabel}
                </Badge>
                <ArchiveStatusBadge status={item.status} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Detail Arsip {typeLabel}
              </h2>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">
                {item.name || item.applicant_name} ({item.nim}) {item.email ? ` | ${item.email}` : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-2xl border border-white/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">
                <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                Dibuat Tanggal
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {formatArchiveDate(item.createdAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">
                <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                Nomor Surat
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {item.letterNumber || item.letter_number || 'Belum terbit'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Split View ────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Live Letter Preview */}
        <div className="print:block print:w-full print:m-0 print:p-0">
          <Card className="h-full border-slate-200 dark:border-gray-700 shadow-sm print:border-0 print:shadow-none">
            <CardHeader className="border-b dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 py-4 print:hidden">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-white">
                <Printer className="h-5 w-5 text-sky-600" /> Live Preview Surat
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                Preview tampilan fisik surat sesuai templat resmi FTI UKSW.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 bg-slate-100/50 dark:bg-gray-900/50 flex justify-center items-start overflow-x-auto min-h-[500px]">
              {type === 'active' ? (
                <ActiveStudentLetter
                  data={{
                    ...item,
                    semesterCode: currentSemesterCode,
                    semesterName: item.semesterName || 'Semester Berjalan',
                    academicYear: item.academicYear || '',
                    backgroundImageBase64: letterBackgrounds.document?.imageBase64,
                    layout: currentLayout,
                    deanName: deanName,
                    validationUrl
                  }}
                />
              ) : (
                <LetterPreview
                  type={type === 'su-rek' ? 'su-rek' : (type as any)}
                  data={{
                    ...item,
                    recipientName: item.recipientName || item.recipient_name || '',
                    berdasarkanNo: item.berdasarkanNo || '',
                    perihal: item.perihal || '',
                    lampiran: item.lampiran || '',
                    status: item.status,
                    deanName
                  }}
                  backgroundImageBase64={letterBackgrounds.document?.imageBase64}
                  layout={currentLayout}
                  showLayoutGuide={false}
                  letterNumber={item.letterNumber || item.letter_number}
                  validationToken={item.validationToken || item.validation_token}
                  validationUrl={validationUrl}
                  letterDate={item.letterGeneratedAt || item.createdAt}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions, QR Code & Details Sidebar */}
        <div className="space-y-4 print:hidden">
          {/* Card 1: Quick Actions */}
          <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-gray-700 py-4">
              <CardTitle className="text-base text-slate-800 dark:text-white">Aksi Cepat Admin</CardTitle>
              <CardDescription className="dark:text-gray-400">Kelola status dan operasional surat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {isPending && (
                <div className="flex flex-col gap-2">
                  {onVerify && (
                    <Button
                      onClick={() => onVerify(item.id, type)}
                      disabled={isProcessing}
                      className="w-full justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      <CheckCircle className="h-4 w-4" /> Setuju / Verifikasi
                    </Button>
                  )}
                  {onReject && (
                    <Button
                      onClick={() => onReject(item.id, type, item.name || item.applicant_name)}
                      disabled={isProcessing}
                      className="w-full justify-center gap-2 bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                    >
                      <XCircle className="h-4 w-4" /> Tolak Pengajuan
                    </Button>
                  )}
                </div>
              )}

              {canSendEmail && onSendEmail && (
                <Button
                  variant="outline"
                  onClick={() => onSendEmail(type, item.id)}
                  disabled={isProcessing || isSendingEmail}
                  className="w-full justify-center gap-2 cursor-pointer dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Kirim Email ke Mahasiswa
                </Button>
              )}

              <Button
                variant="outline"
                onClick={onPrint}
                disabled={isPending || isProcessing}
                className="w-full justify-center gap-2 cursor-pointer dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Printer className="h-4 w-4" /> Cetak Ulang
              </Button>

              <Button
                variant="outline"
                onClick={onDownloadPdf}
                disabled={isPending || isProcessing}
                className="w-full justify-center gap-2 cursor-pointer dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>

              {onEdit && ['observation', 'counseling', 'su-rek'].includes(type) && (
                <Button
                  variant="outline"
                  onClick={() => onEdit(item)}
                  disabled={isProcessing}
                  className="w-full justify-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 cursor-pointer"
                >
                  <Pencil className="h-4 w-4" /> Edit Data Surat
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => onDelete(item.id, type, item.name || item.applicant_name)}
                disabled={isProcessing}
                className="w-full justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Hapus Arsip Ini
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: QR Validasi Publik */}
          <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-gray-700 py-4">
              <CardTitle className="flex items-center gap-2 text-base text-slate-800 dark:text-white">
                <QrCode className="h-4 w-4 text-sky-600" /> Validasi QR Publik
              </CardTitle>
              <CardDescription className="dark:text-gray-400">Verifikasi keaslian via halaman publik.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {validationUrl ? (
                <>
                  <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                    <ValidationQrCode value={validationUrl} size={128} />
                  </div>
                  <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                    {validationUrl}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full justify-center cursor-pointer dark:border-gray-700 dark:hover:bg-gray-800"
                    onClick={() => window.open(validationUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Buka Halaman Validasi
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Link validasi publik belum tersedia untuk arsip ini.
                  </p>
                  {onCreateValidationToken && (
                    <Button
                      onClick={onCreateValidationToken}
                      disabled={isProcessing || isPending}
                      className="w-full justify-center cursor-pointer"
                    >
                      <QrCode className="mr-2 h-4 w-4" /> Buat Link Validasi
                    </Button>
                  )}
                  {isPending && (
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Surat harus diverifikasi terlebih dahulu sebelum memiliki QR validasi.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Dynamic Info Metadata */}
          <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-gray-700 py-4">
              <CardTitle className="text-base text-slate-800 dark:text-white">Detail Informasi Surat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-sm text-slate-600 dark:text-gray-300">
              {item.companyName || item.company ? (
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Instansi / Perusahaan:</span>
                  <p className="font-semibold text-slate-900 dark:text-white">{item.companyName || item.company}</p>
                </div>
              ) : null}

              {item.destinationPlace || item.destinationAddress ? (
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Tujuan Surat:</span>
                  <p className="font-medium text-slate-800 dark:text-gray-200">{item.recipientTitle || item.recipientName || 'Kepada Yth.'}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{item.destinationPlace || item.destinationAddress}</p>
                </div>
              ) : null}

              {item.researchTitle ? (
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Judul Tugas Akhir:</span>
                  <p className="font-medium italic text-slate-800 dark:text-gray-200">"{item.researchTitle}"</p>
                </div>
              ) : null}

              {item.courseName ? (
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Mata Kuliah:</span>
                  <p className="font-medium text-slate-800 dark:text-gray-200">{item.courseName}</p>
                </div>
              ) : null}

              {item.referralUnit ? (
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Unit Rujukan Konseling:</span>
                  <p className="font-medium text-slate-800 dark:text-gray-200">{item.referralUnit}</p>
                </div>
              ) : null}

              {Array.isArray(item.carbonCopies) && item.carbonCopies.length > 0 ? (
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Tembusan (Carbon Copies):</span>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-600 dark:text-gray-400 space-y-0.5">
                    {item.carbonCopies.map((cc: any, idx: number) => (
                      <li key={idx}>
                        {cc.role || cc.name} {cc.name && cc.role ? `(${cc.name})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
