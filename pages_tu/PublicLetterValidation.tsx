import {
  Warning as AlertTriangle,
  Medal as Award,
  CalendarBlank as Calendar,
  Check,
  Copy,
  DownloadSimple as Download,
  FileText,
  Hash,
  SpinnerGap as Loader2,
  ShieldCheck,
  Users
} from '@phosphor-icons/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0  sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-500 ">
        {Icon && <Icon className="size-4 shrink-0 text-slate-400 " />}
        {label}
      </span>
      <span className="min-w-0 break-words text-sm font-semibold text-slate-900  sm:text-right">{value || '-'}</span>
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

    // Force light mode for this specific page
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      cancelled = true;
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 ">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 " />
            <span className="font-semibold text-slate-800 ">Menghubungkan ke arsip TU...</span>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-100 "></div>
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100 "></div>
            <div className="h-3 w-4/6 animate-pulse rounded bg-slate-100 "></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !letter) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 ">
        <Card className="w-full max-w-lg border-red-200 shadow-md ">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600  ">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl text-red-700 ">
              Validasi Gagal / Tidak Ditemukan
            </CardTitle>
            <CardDescription className="mt-2 text-slate-600 ">
              {error || 'Token QR validasi tidak terdaftar atau telah kedaluwarsa.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-center border-t border-slate-100 pt-4 ">
            <p className="text-xs text-slate-500">
              Pastikan Anda memindai kode QR asli yang diterbitkan langsung oleh Tata Usaha FTI UKSW.
            </p>
            <Button 
              className="mt-2 bg-slate-900 hover:bg-slate-800  "
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
    'flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white  sm:px-4',
    activeTab === tab
      ? 'bg-blue-600 text-white shadow-sm '
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950   '
  );


  return (
    <div className="min-h-dvh bg-slate-50/50 pb-12 font-sans text-slate-900 antialiased  ">
      {/* Official Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)]  ">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={ukswLogo} alt="UKSW Logo" className="h-9 w-auto object-contain" />
              <div className="h-6 w-[1px] bg-slate-200 "></div>
              <img src={ftiLogo} alt="FTI Logo" className="h-9 w-auto object-contain" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold uppercase text-blue-900 ">FAKULTAS TEKNOLOGI INFORMASI</span>
              <span className="block truncate text-[10px] font-semibold text-slate-500 ">Universitas Kristen Satya Wacana Salatiga</span>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex border-slate-200 bg-slate-50 text-slate-600   ">
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
                ? 'border-emerald-200 bg-emerald-50/50 shadow-emerald-50  '
                : 'border-amber-200 bg-amber-50/50 shadow-amber-50  '
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
                          ? 'bg-emerald-600 text-white hover:bg-emerald-600 ' 
                          : 'bg-amber-600 text-white hover:bg-amber-600 '
                      }>
                        {letter.isValid ? 'Terverifikasi' : 'Draf / Proses'}
                      </Badge>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-800  ">
                        {letter.typeLabel}
                      </Badge>
                    </div>
                    <h1 className="mt-2 text-balance text-xl font-bold text-slate-900 ">
                      {letter.isValid ? 'Keaslian Dokumen Terjamin' : 'Dokumen Belum Diresmikan'}
                    </h1>
                    <p className="mt-1 text-pretty text-sm leading-normal text-slate-600 ">
                      {letter.isValid 
                        ? 'QR Code ini merujuk ke data surat resmi yang diterbitkan oleh Tata Usaha FTI UKSW.' 
                        : 'Surat terdaftar di sistem tetapi belum ditandatangani atau disahkan secara resmi oleh dekan.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Interactive Tab System */}
            <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm  " role="tablist" aria-label="Tampilan validasi surat">
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
                <Card className="border-slate-200 shadow-sm ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 " /> Tanda Tangan Digital
                    </CardTitle>
                    <CardDescription>Informasi penandatangan dokumen resmi.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm font-medium text-slate-700 ">
                      Dokumen ini telah ditandatangani oleh:
                    </p>
                    <div className="space-y-3 rounded-lg bg-slate-50 p-4 border border-slate-100  ">
                      {digitalSigners.length > 0 ? digitalSigners.map((signer, index) => (
                        <div key={`${signer.name}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-sm">
                          <span className="text-slate-500 ">Nama</span>
                          <span className="min-w-0 break-words font-bold text-slate-900 ">: {signer.name || '-'}</span>
                          <span className="text-slate-500 ">Jabatan</span>
                          <span className="min-w-0 break-words font-medium text-slate-900 ">: {signer.title || '-'}</span>
                        </div>
                      )) : (
                        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-sm">
                          <span className="text-slate-500 ">Nama</span>
                          <span className="font-bold text-slate-900 ">: -</span>
                          <span className="text-slate-500 ">Jabatan</span>
                          <span className="font-medium text-slate-900 ">: -</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500  italic">
                      Jadi QR ini menggantikan tanda tangan digital pihak yang tercantum.
                    </p>
                  </CardContent>
                </Card>

                {/* Identitas Surat */}
                <Card className="border-slate-200 shadow-sm ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <FileText className="h-5 w-5 text-blue-600 " /> Identitas Surat
                    </CardTitle>
                    <CardDescription>Detail nomor resmi dan tanggal terbit surat.</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-slate-100 ">
                    <DetailRow icon={Hash} label="Nomor Surat" value={letter.letterNumber || 'Belum Diterbitkan'} />
                    <DetailRow icon={Calendar} label="Tanggal Terbit" value={formatDate(letter.issuedAt)} />
                  </CardContent>
                </Card>

                {/* Tembusan Surat */}
                {letter.carbonCopies && letter.carbonCopies.length > 0 && (
                  <Card className="border-slate-200 shadow-sm ">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <Users className="h-5 w-5 text-indigo-600 " /> Tembusan Surat
                      </CardTitle>
                      <CardDescription>Pihak yang menerima tembusan dokumen resmi ini.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700 ">
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

                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm   sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700 ">Pratinjau Dokumen</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 gap-1.5 border-slate-200 text-blue-600 hover:bg-blue-50 px-2.5 shadow-sm"
                        onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                        disabled={!letter.isValid}
                        title={!letter.isValid ? 'Hanya surat resmi/terverifikasi yang dapat diunduh.' : 'Unduh dokumen PDF'}
                      >
                        <Download className="size-3.5" />
                        <span className="text-[11px] font-semibold">Unduh PDF</span>
                      </Button>
                      <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-50 text-[11px] text-slate-600 font-medium">
                        Lembar A4
                      </Badge>
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Pratinjau dokumen surat resmi"
                    tabIndex={0}
                    className="max-h-[75dvh] max-w-full overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-200/70 p-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white    sm:p-4"
                  >
                    <div className="mx-auto w-max max-w-none">
                  {isObservation ? (
                    <LetterPreview
                      pdfUrl={`/api/tu/public/letter-validation/${letter.validationToken}/preview-pdf`}
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
                      pdfUrl={`/api/tu/public/letter-validation/${letter.validationToken}/preview-pdf`}
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
                      pdfUrl={`/api/tu/public/letter-validation/${letter.validationToken}/preview-pdf`}
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
                      pdfUrl={`/api/tu/public/letter-validation/${letter.validationToken}/preview-pdf`}
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
            

            {/* Token QR & Link Card */}
            <Card className="border-slate-200 shadow-sm ">
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
                      className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600 outline-none   "
                    />
                    <Button 
                      size="icon-xs" 
                      variant="outline" 
                      onClick={handleCopyLink}
                      aria-label={copiedLink ? 'Tautan verifikasi tersalin' : 'Salin tautan verifikasi'}
                      className="shrink-0  "
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
                      className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600 outline-none   "
                    />
                    <Button 
                      size="icon-xs" 
                      variant="outline" 
                      onClick={handleCopyToken}
                      aria-label={copiedToken ? 'Token digital tersalin' : 'Salin token digital'}
                      className="shrink-0  "
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
