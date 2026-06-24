import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  FileText, 
  GraduationCap, 
  Loader2, 
  ShieldCheck, 
  Users, 
  Copy, 
  Check, 
  ExternalLink,
  Award,
  Landmark,
  User,
  Mail,
  Calendar,
  Hash,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import { API_BASE_URL } from '../config';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

import ukswLogo from '../src/assets/UKSW.svg';
import ftiLogo from '../src/assets/FTI.svg';

import { ActiveStudentLetter } from './components/ActiveStudentLetter';
import { LetterPreview } from './components/LetterPreview';
import { LetterLayout } from './types';

type ValidationLetter = {
  type: 'active-student' | 'observation';
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
  backgroundImageBase64?: string;
  layout?: LetterLayout;
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
    minute: '2-digit'
  }).format(date);
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

function DetailRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800/80">
      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-slate-900 dark:text-white">{value || '-'}</span>
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

  const handleCopyToken = () => {
    if (!letter) return;
    navigator.clipboard.writeText(letter.validationToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
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

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 text-slate-900 dark:bg-slate-950 dark:text-white font-sans antialiased">
      {/* Official Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={ukswLogo} alt="UKSW Logo" className="h-9 w-auto object-contain" />
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
              <img src={ftiLogo} alt="FTI Logo" className="h-9 w-auto object-contain" />
            </div>
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-400">FAKULTAS TEKNOLOGI INFORMASI</span>
              <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Universitas Kristen Satya Wacana Salatiga</span>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            CORE.FTI
          </Badge>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          
          {/* Left Column: Verification & Letter Tabs */}
          <div className="space-y-6">
            
            {/* Status Card (Seal) */}
            <div className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-300 ${
              letter.isValid 
                ? 'border-emerald-200 bg-emerald-50/50 shadow-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/10' 
                : 'border-amber-200 bg-amber-50/50 shadow-amber-50 dark:border-amber-900/40 dark:bg-amber-950/10'
            }`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    letter.isValid 
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                      : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  }`}>
                    {letter.isValid ? <ShieldCheck className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
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
                    <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {letter.isValid ? 'Keaslian Dokumen Terjamin' : 'Dokumen Belum Diresmikan'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-normal">
                      {letter.isValid 
                        ? 'QR Code ini merujuk ke data surat resmi yang diterbitkan oleh Tata Usaha FTI UKSW.' 
                        : 'Surat terdaftar di sistem tetapi belum ditandatangani atau disahkan secara resmi oleh dekan.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Interactive Tab System */}
            <div className="border-b border-slate-200 dark:border-slate-800">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'summary'
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Ringkasan Informasi
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'preview'
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Award className="h-4 w-4" />
                  Pratinjau Surat Resmi
                </button>
              </div>
            </div>

            {/* Tab 1: Ringkasan Informasi */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* Identitas Surat */}
                <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Identitas Surat
                    </CardTitle>
                    <CardDescription>Detail penerima dan nomor resmi surat.</CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    <DetailRow icon={Hash} label="Nomor Surat" value={letter.letterNumber || 'Belum Diterbitkan'} />
                    <DetailRow icon={Calendar} label="Tanggal Terbit" value={formatDate(letter.issuedAt)} />
                    <DetailRow icon={User} label="Nama Penerima" value={letter.recipient.name} />
                    <DetailRow icon={GraduationCap} label="NIM" value={letter.recipient.nim} />
                    <DetailRow icon={Mail} label="Email Terdaftar" value={letter.recipient.email} />
                    <DetailRow icon={Award} label="Status Surat" value={letter.status === 'sent' ? 'Terkirim' : letter.status === 'verified' ? 'Terverifikasi' : 'Menunggu'} />
                  </CardContent>
                </Card>

                {/* Detail Akademik / Observasi */}
                {isObservation && letter.observation ? (
                  <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Rincian Pengantar Observasi
                      </CardTitle>
                      <CardDescription>Tujuan instansi, mata kuliah, dan daftar mahasiswa.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        <DetailRow label="Nama Penerima" value={letter.observation.recipientName} />
                        <DetailRow label="Instansi Tujuan" value={letter.observation.company} />
                        <DetailRow label="Alamat Instansi" value={letter.observation.companyAddress} />
                        <DetailRow label="Mata Kuliah" value={letter.observation.courseName} />
                        <DetailRow label="Dosen Pengampu" value={letter.observation.lecturerName} />
                        <DetailRow label="Ketua Program Studi" value={letter.observation.headOfProgramName} />
                      </div>
                      
                      {/* Daftar Anggota */}
                      <div className="rounded-xl border border-slate-150 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Anggota Kelompok Mahasiswa</h4>
                        <div className="space-y-2">
                          {letter.observation.students.map((st, i) => (
                            <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-dashed border-slate-100 last:border-0 dark:border-slate-800">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{st.name}</span>
                              <span className="font-mono text-slate-500">{st.nim}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-bold">
                        <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Detail Akademik Mahasiswa
                      </CardTitle>
                      <CardDescription>Informasi status kemahasiswaan aktif.</CardDescription>
                    </CardHeader>
                    <CardContent className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      <DetailRow label="Fakultas" value={letter.activeStudent?.faculty} />
                      <DetailRow label="Program Studi" value={letter.activeStudent?.studyProgramName} />
                      <DetailRow label="Jenjang Program" value={letter.activeStudent?.studyProgramLevel} />
                      <DetailRow label="Universitas" value={letter.activeStudent?.university} />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tab 2: Pratinjau Dokumen (Official Component Preview) */}
            {activeTab === 'preview' && (
              <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-200/50 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900/50 flex justify-center">
                <div className="mx-auto overflow-auto max-w-full">
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
                        students: letter.observation?.students || []
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
                        backgroundImageBase64: letter.backgroundImageBase64,
                        layout: letter.layout
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Actions & Token Info */}
          <aside className="space-y-6">
            
            {/* Download PDF Card */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-bold">Dokumen Resmi</CardTitle>
                <CardDescription>Unduh salinan asli berformat PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 shadow-sm"
                  onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                  disabled={!letter.isValid}
                >
                  <Download className="mr-2 h-4 w-4" /> Unduh Dokumen PDF
                </Button>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Dokumen PDF hanya dapat diunduh untuk surat yang sudah berstatus resmi/terverifikasi.
                </p>
              </CardContent>
            </Card>

            {/* Token QR & Link Card */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-bold">Metadata Keamanan</CardTitle>
                <CardDescription>Gunakan data di bawah ini untuk verifikasi silang.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Validation Link */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tautan Verifikasi</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={window.location.href}
                      className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    />
                    <Button 
                      size="icon" 
                      variant="outline" 
                      onClick={handleCopyLink}
                      className="h-8 w-8 shrink-0 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Validation Token */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Token Digital</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={letter.validationToken}
                      className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    />
                    <Button 
                      size="icon" 
                      variant="outline" 
                      onClick={handleCopyToken}
                      className="h-8 w-8 shrink-0 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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

