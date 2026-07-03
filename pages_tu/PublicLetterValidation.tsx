import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  Download, 
  FileText, 
  Loader2, 
  ShieldCheck, 
  Users, 
  Copy, 
  Check, 
  Award,
  Calendar,
  Hash
} from 'lucide-react';
import { api } from '../services/api';
import { API_BASE_URL } from '../config';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';

import ukswLogo from '../src/assets/UKSW.svg';
import ftiLogo from '../src/assets/FTI.svg';

import { ActiveStudentLetter } from './components/ActiveStudentLetter';
import { LetterPreview } from './components/LetterPreview';
import { LetterLayout } from './types';

type ValidationLetter = {
  type: 'active-student' | 'observation' | 'counseling' | 'research' | 'su-rek';
  typeLabel: string;
  status: 'pending' | 'verified' | 'sent';
  isValid: boolean;
  letterNumber?: string | null;
  validationToken: string;
  validationUrl: string;
  issuedAt?: string | null;
  createdAt?: string | null;
  recipient: {
    name: string;
    nim: string;
    email?: string;
  };
  activeStudent?: {
    birthPlace?: string;
    birthDate?: string;
    studyProgramLevel?: string;
    studyProgramName?: string;
    faculty?: string;
    university?: string;
  } | null;
  observation?: {
    recipientName?: string;
    company?: string;
    companyAddress?: string;
    courseName?: string;
    lecturerName?: string;
    headOfProgramName?: string;
    studyProgramLevel?: string;
    studyProgramName?: string;
    students: Array<{ name: string; nim: string }>;
  } | null;
  counseling?: {
    subject?: string;
    recipientName?: string;
    referralUnit?: string;
    studyProgramLevel?: string;
    studyProgramName?: string;
    faculty?: string;
  } | null;
  research?: {
    recipientName?: string;
    recipientTitle?: string;
    destinationPlace?: string;
    destinationAddress?: string;
    researchPlace?: string;
    assignmentType?: string;
    researchTitle?: string;
    contactPerson?: string;
    studyProgramLevel?: string;
    studyProgramName?: string;
    advisors?: Array<{ name: string; title?: string }>;
    includeResearchPlace?: boolean;
  } | null;
  suRek?: {
    recipientName?: string;
    berdasarkanNo?: string;
    perihal?: string;
    lampiran?: string;
  } | null;
  backgroundImageBase64?: string;
  layout?: LetterLayout;
  signer?: {
    name: string;
    title: string;
  };
  signers?: Array<{
    name: string;
    title: string;
  }>;
  html?: string;
  carbonCopies?: Array<{ role: string; name?: string }>;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  }).format(date);
};

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

function DetailRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800/80 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {Icon && <Icon className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />}
        {label}
      </span>
      <span className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-white sm:text-right">{value || '-'}</span>
    </div>
  );
}

export default function PublicLetterValidation() {
  const { token = '' } = useParams();
  const [letter, setLetter] = useState<ValidationLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'summary' | 'preview'>('summary');
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchLetter = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api(`/api/tu/public/letter-validation/${token}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Surat tidak ditemukan.');
        }
        if (!cancelled) setLetter(json.letter);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memvalidasi surat.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLetter();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const downloadUrl = useMemo(
    () => `${API_BASE_URL}/api/tu/public/letter-validation/${token}/download`,
    [token]
  );

  const handleCopyToken = async () => {
    if (!letter) return;
    try {
      await copyText(letter.validationToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      console.error('Failed to copy validation token:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy validation link:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Menghubungkan ke arsip TU...</span>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800"></div>
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800"></div>
            <div className="h-3 w-4/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !letter) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <Card className="w-full max-w-lg border-red-200 shadow-md dark:border-red-900/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl text-red-700 dark:text-red-300">
              Validasi Gagal / Tidak Ditemukan
            </CardTitle>
            <CardDescription className="mt-2 text-slate-600 dark:text-slate-400">
              {error || 'Token QR validasi tidak terdaftar atau telah kedaluwarsa.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-center border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              Pastikan Anda memindai kode QR asli yang diterbitkan langsung oleh Tata Usaha FTI UKSW.
            </p>
            <Button 
              className="mt-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={() => window.location.reload()}
            >
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isObservation = letter.type === 'observation';
  const isCounseling = letter.type === 'counseling';
  const isResearch = letter.type === 'research';
  const isSuRek = letter.type === 'su-rek';
  const digitalSigners = letter.signers?.length ? letter.signers : letter.signer ? [letter.signer] : [];
  const tabButtonClass = (tab: 'summary' | 'preview') => cn(
    'flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 sm:px-4',
    activeTab === tab
      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  );
  const renderDownloadCard = (className = '') => (
    <Card className={cn('border-slate-200 shadow-sm dark:border-slate-800', className)}>
      <CardHeader>
        <CardTitle className="text-base font-bold">Dokumen Resmi</CardTitle>
        <CardDescription>Unduh salinan asli berformat PDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full justify-center bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
          disabled={!letter.isValid}
        >
          <Download className="mr-2 size-4" /> Unduh Dokumen PDF
        </Button>
        <p className="text-pretty text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Dokumen PDF hanya dapat diunduh untuk surat yang sudah berstatus resmi/terverifikasi.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-dvh bg-slate-50/50 pb-12 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-white">
      {/* Official Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={ukswLogo} alt="UKSW Logo" className="h-9 w-auto object-contain" />
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
              <img src={ftiLogo} alt="FTI Logo" className="h-9 w-auto object-contain" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold uppercase text-blue-900 dark:text-blue-400">FAKULTAS TEKNOLOGI INFORMASI</span>
              <span className="block truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">Universitas Kristen Satya Wacana Salatiga</span>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            CORE.FTI
          </Badge>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          
          {/* Left Column: Verification & Letter Tabs */}
          <div className="min-w-0 space-y-6">
            
            {/* Status Card (Seal) */}
            <div className={cn(
              'relative overflow-hidden rounded-2xl border p-6 shadow-sm',
              letter.isValid
                ? 'border-emerald-200 bg-emerald-50/50 shadow-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                : 'border-amber-200 bg-amber-50/50 shadow-amber-50 dark:border-amber-900/40 dark:bg-amber-950/10'
            )}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                    letter.isValid
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  )}>
                    {letter.isValid ? <ShieldCheck className="size-7" /> : <AlertTriangle className="size-7" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={
                        letter.isValid 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500' 
                          : 'bg-amber-600 text-white hover:bg-amber-600 dark:bg-amber-500'
                      }>
                        {letter.isValid ? 'Terverifikasi' : 'Draf / Proses'}
                      </Badge>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                        {letter.typeLabel}
                      </Badge>
                    </div>
                    <h1 className="mt-2 text-balance text-xl font-bold text-slate-900 dark:text-white">
                      {letter.isValid ? 'Keaslian Dokumen Terjamin' : 'Dokumen Belum Diresmikan'}
                    </h1>
                    <p className="mt-1 text-pretty text-sm leading-normal text-slate-600 dark:text-slate-400">
                      {letter.isValid 
                        ? 'QR Code ini merujuk ke data surat resmi yang diterbitkan oleh Tata Usaha FTI UKSW.' 
                        : 'Surat terdaftar di sistem tetapi belum ditandatangani atau disahkan secara resmi oleh dekan.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Interactive Tab System */}
            <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Tampilan validasi surat">
              <div className="grid grid-cols-2 gap-1">
                <button
                  id="validation-summary-tab"
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'summary'}
                  aria-controls="validation-summary-panel"
                  onClick={() => setActiveTab('summary')}
                  className={tabButtonClass('summary')}
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">
                    <span className="sm:hidden">Ringkasan</span>
                    <span className="hidden sm:inline">Ringkasan Informasi</span>
                  </span>
                </button>
                <button
                  id="validation-preview-tab"
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'preview'}
                  aria-controls="validation-preview-panel"
                  onClick={() => setActiveTab('preview')}
                  className={tabButtonClass('preview')}
                >
                  <Award className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">
                    <span className="sm:hidden">Pratinjau</span>
                    <span className="hidden sm:inline">Pratinjau Surat Resmi</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Tab 1: Ringkasan Informasi */}
            {activeTab === 'summary' && (
              <div id="validation-summary-panel" role="tabpanel" aria-labelledby="validation-summary-tab" className="space-y-6">
                <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Tanda Tangan Digital
                    </CardTitle>
                    <CardDescription>Informasi penandatangan dokumen resmi.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Dokumen ini telah ditandatangani oleh:
                    </p>
                    <div className="space-y-3 rounded-lg bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                      {digitalSigners.length > 0 ? digitalSigners.map((signer, index) => (
                        <div key={`${signer.name}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Nama</span>
                          <span className="min-w-0 break-words font-bold text-slate-900 dark:text-white">: {signer.name || '-'}</span>
                          <span className="text-slate-500 dark:text-slate-400">Jabatan</span>
                          <span className="min-w-0 break-words font-medium text-slate-900 dark:text-white">: {signer.title || '-'}</span>
                        </div>
                      )) : (
                        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Nama</span>
                          <span className="font-bold text-slate-900 dark:text-white">: -</span>
                          <span className="text-slate-500 dark:text-slate-400">Jabatan</span>
                          <span className="font-medium text-slate-900 dark:text-white">: -</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Jadi QR ini menggantikan tanda tangan digital pihak yang tercantum.
                    </p>
                  </CardContent>
                </Card>

                {/* Identitas Surat */}
                <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Identitas Surat
                    </CardTitle>
                    <CardDescription>Detail nomor resmi dan tanggal terbit surat.</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    <DetailRow icon={Hash} label="Nomor Surat" value={letter.letterNumber || 'Belum Diterbitkan'} />
                    <DetailRow icon={Calendar} label="Tanggal Terbit" value={formatDate(letter.issuedAt)} />
                  </CardContent>
                </Card>

                {/* Tembusan Surat */}
                {letter.carbonCopies && letter.carbonCopies.length > 0 && (
                  <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Tembusan Surat
                      </CardTitle>
                      <CardDescription>Pihak yang menerima tembusan dokumen resmi ini.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                        {letter.carbonCopies.map((cc, i) => (
                          <li key={i} className="pl-1">
                            <span className="font-semibold">{cc.role}</span>
                            {cc.name ? ` - ${cc.name}` : ''}
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tab 2: Pratinjau Dokumen (Official Component Preview) */}
            {activeTab === 'preview' && (
              <div id="validation-preview-panel" role="tabpanel" aria-labelledby="validation-preview-tab" className="space-y-4">
                {renderDownloadCard('lg:hidden')}
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pratinjau Dokumen</span>
                    <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Lembar A4
                    </Badge>
                  </div>
                  <div
                    role="region"
                    aria-label="Pratinjau dokumen surat resmi"
                    tabIndex={0}
                    className="max-h-[75dvh] max-w-full overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-200/70 p-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950/60 dark:focus-visible:ring-offset-slate-900 sm:p-4"
                  >
                    <div className="mx-auto w-max max-w-none">
                  {isObservation ? (
                    <LetterPreview
                      data={{
                        recipientName: letter.observation?.recipientName || '',
                        companyName: letter.observation?.company || '',
                        companyAddress: letter.observation?.companyAddress || '',
                        courseName: letter.observation?.courseName || '',
                        lecturerName: letter.observation?.lecturerName || '',
                        headOfProgramName: letter.observation?.headOfProgramName || '',
                        studyProgramName: letter.observation?.studyProgramName,
                        studyProgramLevel: letter.observation?.studyProgramLevel,
                        students: letter.observation?.students || [],
                        html: letter.html
                      }}
                      backgroundImageBase64={letter.backgroundImageBase64}
                      layout={letter.layout}
                      showLayoutGuide={false}
                      letterNumber={letter.letterNumber || undefined}
                      validationToken={letter.validationToken}
                      validationUrl={letter.validationUrl}
                      letterDate={letter.issuedAt || letter.createdAt || undefined}
                    />
                  ) : isCounseling ? (
                    <LetterPreview
                      type="counseling"
                      data={{
                        name: letter.recipient.name,
                        nim: letter.recipient.nim,
                        subject: letter.counseling?.subject || 'Pengantar Konseling',
                        recipientName: letter.counseling?.recipientName || '',
                        referralUnit: letter.counseling?.referralUnit || '',
                        studyProgramName: letter.counseling?.studyProgramName,
                        studyProgramLevel: letter.counseling?.studyProgramLevel,
                        faculty: letter.counseling?.faculty || 'FTI',
                        html: letter.html
                      }}
                      backgroundImageBase64={letter.backgroundImageBase64}
                      layout={letter.layout}
                      showLayoutGuide={false}
                      letterNumber={letter.letterNumber || undefined}
                      validationToken={letter.validationToken}
                      validationUrl={letter.validationUrl}
                      letterDate={letter.issuedAt || letter.createdAt || undefined}
                    />
                  ) : isResearch ? (
                    <LetterPreview
                      type="research"
                      data={{
                        name: letter.recipient.name,
                        nim: letter.recipient.nim,
                        recipientName: letter.research?.recipientName || '',
                        recipientTitle: letter.research?.recipientTitle || '',
                        destinationPlace: letter.research?.destinationPlace || '',
                        destinationAddress: letter.research?.destinationAddress || '',
                        researchPlace: letter.research?.researchPlace || '',
                        assignmentType: letter.research?.assignmentType || 'Tugas Talenta Unggul',
                        researchTitle: letter.research?.researchTitle || '',
                        contactPerson: letter.research?.contactPerson || '',
                        studyProgramName: letter.research?.studyProgramName,
                        studyProgramLevel: letter.research?.studyProgramLevel,
                        advisors: letter.research?.advisors || [],
                        includeResearchPlace: letter.research?.includeResearchPlace,
                        html: letter.html
                      }}
                      backgroundImageBase64={letter.backgroundImageBase64}
                      layout={letter.layout}
                      showLayoutGuide={false}
                      letterNumber={letter.letterNumber || undefined}
                      validationToken={letter.validationToken}
                      validationUrl={letter.validationUrl}
                      letterDate={letter.issuedAt || letter.createdAt || undefined}
                    />
                  ) : isSuRek ? (
                    <LetterPreview
                      type="su-rek"
                      data={{
                        name: letter.recipient.name,
                        nim: letter.recipient.nim,
                        recipientName: letter.suRek?.recipientName || '',
                        berdasarkanNo: letter.suRek?.berdasarkanNo || '',
                        perihal: letter.suRek?.perihal || '',
                        lampiran: letter.suRek?.lampiran || '',
                        html: letter.html
                      }}
                      backgroundImageBase64={letter.backgroundImageBase64}
                      layout={letter.layout}
                      showLayoutGuide={false}
                      letterNumber={letter.letterNumber || undefined}
                      validationToken={letter.validationToken}
                      validationUrl={letter.validationUrl}
                      letterDate={letter.issuedAt || letter.createdAt || undefined}
                    />
                  ) : (
                    <ActiveStudentLetter
                      data={{
                        id: letter.validationToken,
                        name: letter.recipient.name,
                        nim: letter.recipient.nim,
                        email: letter.recipient.email || '',
                        birthPlace: letter.activeStudent?.birthPlace,
                        birthDate: letter.activeStudent?.birthDate,
                        studyProgramLevel: letter.activeStudent?.studyProgramLevel,
                        studyProgramName: letter.activeStudent?.studyProgramName,
                        faculty: letter.activeStudent?.faculty,
                        university: letter.activeStudent?.university,
                        transcriptBase64: '',
                        transcriptName: '',
                        status: letter.status,
                        createdAt: letter.createdAt || '',
                        letterGeneratedAt: letter.issuedAt || undefined,
                        letterNumber: letter.letterNumber || undefined,
                        validationToken: letter.validationToken,
                        validationUrl: letter.validationUrl,
                        deanName: letter.signer?.name,
                        deanTitle: letter.signer?.title,
                        backgroundImageBase64: letter.backgroundImageBase64,
                        layout: letter.layout,
                        html: letter.html
                      }}
                    />
                  )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Actions & Token Info */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-24 lg:self-start">
            
            {/* Download PDF Card */}
            {activeTab === 'preview' && (
              renderDownloadCard('hidden lg:block')
            )}

            {/* Token QR & Link Card */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-bold">Metadata Keamanan</CardTitle>
                <CardDescription>Gunakan data di bawah ini untuk verifikasi silang.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Validation Link */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Tautan Verifikasi</label>
                  <div className="flex min-w-0 gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={window.location.href}
                      aria-label="Tautan verifikasi surat"
                      className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    />
                    <Button 
                      size="icon-xs" 
                      variant="outline" 
                      onClick={handleCopyLink}
                      aria-label={copiedLink ? 'Tautan verifikasi tersalin' : 'Salin tautan verifikasi'}
                      className="shrink-0 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      {copiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Validation Token */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Token Digital</label>
                  <div className="flex min-w-0 gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={letter.validationToken}
                      aria-label="Token digital surat"
                      className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    />
                    <Button 
                      size="icon-xs" 
                      variant="outline" 
                      onClick={handleCopyToken}
                      aria-label={copiedToken ? 'Token digital tersalin' : 'Salin token digital'}
                      className="shrink-0 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      {copiedToken ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
