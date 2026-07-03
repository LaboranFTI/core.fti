import React, { useEffect, useState } from 'react';
import { ResearchRequest, TULetterBackgrounds, TULetterLayouts } from '../types';
import { LetterPreview } from './LetterPreview';
import { ValidationQrCode } from './ValidationQrCode';
import { api } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { PageTabs } from '../../components/ui/page-tabs';
import { Tabs, TabsContent } from '../../components/ui/tabs';
import { EmailActionOverlay } from './EmailActionOverlay';
import { EmailSuccessDialog } from './EmailSuccessDialog';
import { TUMetricCard, TUNotice, TUSectionCard } from './TUPageComponents';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Clock3,
  Eye,
  FileSearch,
  FileText,
  Mail,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Download,
  QrCode,
  MessageSquare
} from 'lucide-react';

type FinalTaskLetterType = 'research' | 'interview' | 'permission';

type ArchiveSelection =
  | { type: 'research'; item: ResearchRequest }
  | { type: 'interview'; item: ResearchRequest }
  | { type: 'permission'; item: ResearchRequest }
  | null;

type ArchiveStatus = ResearchRequest['status'];
type StatusFilter = 'all' | ArchiveStatus;

interface FinalTaskArchivePanelProps {
  refreshKey?: number;
}

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'verified', label: 'Terverifikasi' },
  { value: 'sent', label: 'Terkirim' }
];

const finalTaskTypeLabels: Record<FinalTaskLetterType, { short: string; title: string; filename: string; searchPlaceholder: string; empty: string; column: string }> = {
  research: {
    short: 'Penelitian',
    title: 'Surat Penelitian',
    filename: 'Penelitian',
    searchPlaceholder: 'Cari nama, NIM, atau judul penelitian...',
    empty: 'Belum ada data surat penelitian yang tersimpan.',
    column: 'Judul Penelitian'
  },
  interview: {
    short: 'Wawancara',
    title: 'Surat Wawancara',
    filename: 'Wawancara',
    searchPlaceholder: 'Cari nama, NIM, atau topik wawancara...',
    empty: 'Belum ada data surat wawancara yang tersimpan.',
    column: 'Topik Wawancara'
  },
  permission: {
    short: 'Perizinan',
    title: 'Surat Perizinan',
    filename: 'Perizinan',
    searchPlaceholder: 'Cari nama, NIM, keperluan, atau judul tugas akhir...',
    empty: 'Belum ada data surat perizinan yang tersimpan.',
    column: 'Keperluan / Judul'
  }
};

function formatArchiveDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  }).format(date);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-gray-700 py-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500 dark:text-gray-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800 dark:text-white">{value}</span>
    </div>
  );
}

const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  document: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  counseling: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  suRek: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  counseling: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  suRek: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

export function FinalTaskArchivePanel({ refreshKey = 0 }: FinalTaskArchivePanelProps) {
  const [researchRequests, setResearchRequests] = useState<ResearchRequest[]>([]);
  const [interviewRequests, setInterviewRequests] = useState<ResearchRequest[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<ResearchRequest[]>([]);
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [deanName, setDeanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailSuccessState, setEmailSuccessState] = useState<{ email: string; letterNumber?: string | null; title: string } | null>(null);
  const [activeListTab, setActiveListTab] = useState<FinalTaskLetterType>('research');
  const [selectedLetter, setSelectedLetter] = useState<ArchiveSelection>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: FinalTaskLetterType; label: string } | null>(null);
  const [batchDeleteTargets, setBatchDeleteTargets] = useState<Array<{ id: string; type: FinalTaskLetterType; label: string }>>([]);
  const [confirmPhase, setConfirmPhase] = useState<1 | 2 | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedResearchIds, setSelectedResearchIds] = useState<Set<string>>(new Set());
  const [selectedInterviewIds, setSelectedInterviewIds] = useState<Set<string>>(new Set());
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());

  const getStatusBadge = (status: ArchiveStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"><Clock3 className="mr-1 h-3 w-3" /> Menunggu</Badge>;
      case 'verified':
        return <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300"><CheckCircle className="mr-1 h-3 w-3" /> Terverifikasi</Badge>;
      case 'sent':
        return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"><Mail className="mr-1 h-3 w-3" /> Terkirim</Badge>;
      default:
        return <Badge variant="outline" className="dark:border-gray-700 dark:text-gray-300">{status}</Badge>;
    }
  };

  const fetchArchiveData = async ({
    showLoader = false,
    showError = true
  }: {
    showLoader?: boolean;
    showError?: boolean;
  } = {}) => {
    if (showLoader && researchRequests.length === 0 && interviewRequests.length === 0 && permissionRequests.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [researchResult, settingsResult] = await Promise.allSettled([
        api('/api/research-requests', { timeoutMs: 12000 }),
        api('/api/tu/settings', { timeoutMs: 12000 })
      ]);

      if (researchResult.status === 'rejected') {
        throw researchResult.reason;
      }

      const researchRes = researchResult.value;
      const researchJson = await researchRes.json().catch(() => ({}));
      const settingsRes = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
      const settingsJson = settingsRes ? await settingsRes.json().catch(() => ({})) : {};

      const rawAll: ResearchRequest[] =
        researchRes.ok && researchJson.success && Array.isArray(researchJson.data) ? researchJson.data : [];

      setResearchRequests(rawAll.filter(r => r.letterKind === 'research' || !r.letterKind));
      setInterviewRequests(rawAll.filter(r => r.letterKind === 'interview'));
      setPermissionRequests(rawAll.filter(r => r.letterKind === 'permission'));

      if (settingsRes?.ok && settingsJson) {
        if (settingsJson.letterBackgrounds) {
          setLetterBackgrounds(prev => ({ ...createEmptyLetterBackgrounds(), ...settingsJson.letterBackgrounds }));
        }
        if (settingsJson.letterLayouts) {
          setLetterLayouts(prev => ({ ...createEmptyLetterLayouts(), ...settingsJson.letterLayouts }));
        }
        if (settingsJson.deanName) setDeanName(settingsJson.deanName);
      }

      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch final-task archive data:', error);
      if (showError) {
        setFeedback({ type: 'error', message: 'Gagal memuat arsip tugas akhir.' });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArchiveData({ showLoader: true });
  }, [refreshKey]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const openDeleteSingle = (id: string, type: FinalTaskLetterType, label: string) => {
    setDeleteTarget({ id, type, label });
    setBatchDeleteTargets([]);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const openBatchDelete = (type: FinalTaskLetterType) => {
    const ids = type === 'research'
      ? Array.from(selectedResearchIds)
      : type === 'interview'
        ? Array.from(selectedInterviewIds)
        : Array.from(selectedPermissionIds);
    const requests = type === 'research' ? researchRequests : type === 'interview' ? interviewRequests : permissionRequests;
    const targets = ids.map(id => {
      const item = requests.find(r => r.id === id);
      return { id, type, label: item ? item.name : id };
    });
    if (targets.length === 0) return;
    setDeleteTarget(null);
    setBatchDeleteTargets(targets);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (confirmPhase === 1) {
      setConfirmPhase(2);
      return;
    }
    if (confirmText !== 'HAPUS') return;

    setIsProcessing(true);
    setFeedback(null);
    try {
      if (deleteTarget) {
        const res = await api(`/api/tu/requests/${deleteTarget.type}/${deleteTarget.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal menghapus.');
        if (selectedLetter?.item.id === deleteTarget.id) setSelectedLetter(null);
        setFeedback({ type: 'success', message: `${deleteTarget.label} berhasil dihapus.` });
        if (deleteTarget.type === 'research') {
          setSelectedResearchIds(prev => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
        } else if (deleteTarget.type === 'interview') {
          setSelectedInterviewIds(prev => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
        } else {
          setSelectedPermissionIds(prev => { const s = new Set(prev); s.delete(deleteTarget.id); return s; });
        }
      } else {
        const type = batchDeleteTargets[0]?.type;
        const ids = batchDeleteTargets.map(t => t.id);
        const res = await api(`/api/tu/requests/${type}/batch-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal batch delete.');
        if (type === 'research') setSelectedResearchIds(new Set());
        else if (type === 'interview') setSelectedInterviewIds(new Set());
        else setSelectedPermissionIds(new Set());
        if (selectedLetter && ids.includes(selectedLetter.item.id)) setSelectedLetter(null);
        setFeedback({ type: 'success', message: `${ids.length} arsip berhasil dihapus.` });
      }
      await fetchArchiveData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menghapus.' });
    } finally {
      setIsProcessing(false);
      setDeleteTarget(null);
      setBatchDeleteTargets([]);
      setConfirmPhase(null);
      setConfirmText('');
    }
  };

  const handleDownload = async (type: FinalTaskLetterType, item: ResearchRequest) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await api(`/api/tu/requests/${type}/${item.id}/download`, { method: 'GET' });
      if (!res.ok) throw new Error('Gagal mendownload PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Surat_${finalTaskTypeLabels[type].filename}_${item.name?.replace(/\s+/g, '_') || 'surat'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal download PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendEmail = async (type: FinalTaskLetterType, item: ResearchRequest) => {
    setIsProcessing(true);
    setIsSendingEmail(true);
    setFeedback(null);
    try {
      const res = await api(`/api/tu/requests/${type}/${item.id}/send-email`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal mengirim email.');
      }
      setEmailSuccessState({
        email: item.email || '',
        letterNumber: item.letterNumber,
        title: `${finalTaskTypeLabels[type].title} - ${item.name}`
      });
      await fetchArchiveData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal mengirim email.' });
    } finally {
      setIsProcessing(false);
      setIsSendingEmail(false);
    }
  };

  const getValidationUrl = (token?: string) =>
    token ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tu/validasi-surat/${token}` : '';

  // Filter logic
  const filterItems = (items: ResearchRequest[]) => {
    return items.filter(item => {
      const matchSearch = !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nim?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.researchTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.permissionPurpose?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  };

  const filteredResearchRequests = filterItems(researchRequests);
  const filteredInterviewRequests = filterItems(interviewRequests);
  const filteredPermissionRequests = filterItems(permissionRequests);

  const toggleResearchId = (id: string) => {
    setSelectedResearchIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleInterviewId = (id: string) => {
    setSelectedInterviewIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const togglePermissionId = (id: string) => {
    setSelectedPermissionIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleAllResearch = () => {
    if (selectedResearchIds.size === filteredResearchRequests.length && filteredResearchRequests.length > 0) {
      setSelectedResearchIds(new Set());
    } else {
      setSelectedResearchIds(new Set(filteredResearchRequests.map(r => r.id)));
    }
  };

  const toggleAllInterview = () => {
    if (selectedInterviewIds.size === filteredInterviewRequests.length && filteredInterviewRequests.length > 0) {
      setSelectedInterviewIds(new Set());
    } else {
      setSelectedInterviewIds(new Set(filteredInterviewRequests.map(r => r.id)));
    }
  };

  const toggleAllPermission = () => {
    if (selectedPermissionIds.size === filteredPermissionRequests.length && filteredPermissionRequests.length > 0) {
      setSelectedPermissionIds(new Set());
    } else {
      setSelectedPermissionIds(new Set(filteredPermissionRequests.map(r => r.id)));
    }
  };

  const currentItem = selectedLetter?.item;
  const currentType = selectedLetter?.type;

  const tabConfig = [
    { value: 'research', label: `Penelitian (${researchRequests.length})`, icon: FileText },
    { value: 'interview', label: `Wawancara (${interviewRequests.length})`, icon: MessageSquare },
    { value: 'permission', label: `Perizinan (${permissionRequests.length})`, icon: ShieldCheck }
  ];

  const renderLoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      <span className="ml-3 text-sm text-slate-500 dark:text-gray-400">Memuat arsip tugas akhir...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Arsip Surat Tugas Akhir</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            Kelola surat penelitian, wawancara, dan perizinan mahasiswa
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchArchiveData()}
          disabled={isRefreshing}
          className="gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TUMetricCard
          title="Total Penelitian"
          value={String(researchRequests.length)}
          description="Surat penelitian tersimpan"
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          accentClassName="bg-blue-50 dark:bg-blue-950/30"
        />
        <TUMetricCard
          title="Total Wawancara"
          value={String(interviewRequests.length)}
          description="Surat wawancara tersimpan"
          icon={<MessageSquare className="h-5 w-5 text-violet-500" />}
          accentClassName="bg-violet-50 dark:bg-violet-950/30"
        />
        <TUMetricCard
          title="Terkirim"
          value={String([...researchRequests, ...interviewRequests, ...permissionRequests].filter(r => r.status === 'sent').length)}
          description="Surat sudah dikirim email"
          icon={<Mail className="h-5 w-5 text-emerald-500" />}
          accentClassName="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <TUMetricCard
          title="Menunggu"
          value={String([...researchRequests, ...interviewRequests, ...permissionRequests].filter(r => r.status === 'pending').length)}
          description="Belum diproses"
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
          accentClassName="bg-amber-50 dark:bg-amber-950/30"
        />
      </div>

      {/* Feedback */}
      {feedback && (
        <TUNotice tone={feedback.type === 'success' ? 'success' : 'danger'}>{feedback.message}</TUNotice>
      )}

      {/* Main Content */}
      {selectedLetter ? (
        /* Detail View */
        <TUSectionCard>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLetter(null)}
                className="gap-1 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-white">
                  {currentItem?.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-gray-400">
                  {currentType ? finalTaskTypeLabels[currentType].title : 'Surat Tugas Akhir'} - {currentItem?.nim}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                {currentItem?.status && getStatusBadge(currentItem.status)}
                {currentItem?.letterNumber && (
                  <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">
                    {currentItem.letterNumber}
                  </Badge>
                )}
              </div>
              <DetailRow label="Nama" value={currentItem?.name || '-'} />
              <DetailRow label="NIM" value={currentItem?.nim || '-'} />
              <DetailRow label="Email" value={currentItem?.email || '-'} />
              {currentItem?.letterKind === 'permission' && (
                <DetailRow label="Keperluan" value={currentItem?.permissionPurpose || '-'} />
              )}
              <DetailRow label="Judul" value={currentItem?.researchTitle || '-'} />
              <DetailRow label="Tujuan" value={currentItem?.destinationPlace || '-'} />
              <DetailRow label="Penerima" value={currentItem?.recipientName || '-'} />
              <DetailRow label="Tanggal Pengajuan" value={formatArchiveDate(currentItem?.createdAt)} />
              {currentItem?.letterGeneratedAt && (
                <DetailRow label="Tanggal Surat" value={formatArchiveDate(currentItem.letterGeneratedAt)} />
              )}

              {/* QR Code */}
              {currentItem?.validationToken && (
                <div className="pt-2">
                  <ValidationQrCode
                    value={getValidationUrl(currentItem.validationToken)}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  onClick={() => handleDownload(currentType!, currentItem!)}
                  disabled={isProcessing}
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  onClick={() => handleSendEmail(currentType!, currentItem!)}
                  disabled={isProcessing || !currentItem?.email}
                >
                  {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Kirim Email
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openDeleteSingle(currentItem!.id, currentType!, currentItem!.name)}
                  disabled={isProcessing}
                  className="w-full justify-center border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus Arsip Ini
                </Button>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden min-h-[400px]">
              <LetterPreview
                type={currentType}
                data={{ ...currentItem, deanName }}
                backgroundImageBase64={letterBackgrounds.document?.imageBase64}
                layout={letterLayouts.activeStudent}
              />
            </div>
          </CardContent>
        </TUSectionCard>
      ) : (
        /* List View */
        <TUSectionCard>
          <CardHeader className="pb-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={
                    finalTaskTypeLabels[activeListTab].searchPlaceholder
                  }
                  className="pl-10 dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {statusFilterOptions.map(option => {
                  const isActive = statusFilter === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isActive ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(option.value)}
                      className={`rounded-md ${!isActive ? 'dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800' : ''}`}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs value={activeListTab} onValueChange={v => setActiveListTab(v as FinalTaskLetterType)}>
              <PageTabs
                items={tabConfig}
              />

              {/* Research Tab */}
              <TabsContent value="research" className="mt-0">
                {selectedResearchIds.size > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg px-4 py-2 mb-3">
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      {selectedResearchIds.size} surat dipilih
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDelete('research')}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Hapus Dipilih
                    </Button>
                  </div>
                )}
                {loading ? renderLoadingState() : filteredResearchRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-gray-500">
                      {researchRequests.length === 0
                        ? 'Belum ada data surat penelitian yang tersimpan.'
                        : 'Tidak ada hasil yang sesuai dengan filter.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedResearchIds.size === filteredResearchRequests.length && filteredResearchRequests.length > 0}
                            onChange={toggleAllResearch}
                            className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="dark:text-gray-400">Nama / NIM</TableHead>
                        <TableHead className="dark:text-gray-400 hidden md:table-cell">Judul Penelitian</TableHead>
                        <TableHead className="dark:text-gray-400 hidden sm:table-cell">Tanggal</TableHead>
                        <TableHead className="dark:text-gray-400">Status</TableHead>
                        <TableHead className="dark:text-gray-400 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResearchRequests.map(item => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/50 dark:border-gray-700">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedResearchIds.has(item.id)}
                              onChange={() => toggleResearchId(item.id)}
                              className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800 dark:text-white text-sm">{item.name}</div>
                            <div className="text-xs text-slate-500 dark:text-gray-400">{item.nim}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-slate-600 dark:text-gray-300 max-w-[200px] truncate">
                            {item.researchTitle || '-'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-slate-500 dark:text-gray-400">
                            {formatArchiveDate(item.createdAt)}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLetter({ type: 'research', item })}
                                aria-label={`Lihat detail ${item.name}`}
                                className="dark:border-gray-600 dark:text-gray-300"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload('research', item)}
                                disabled={isProcessing}
                                aria-label={`Download ${item.name}`}
                                className="dark:border-gray-600 dark:text-gray-300"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteSingle(item.id, 'research', item.name)}
                                disabled={isProcessing}
                                aria-label={`Hapus arsip ${item.name}`}
                                className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Interview Tab */}
              <TabsContent value="interview" className="mt-0">
                {selectedInterviewIds.size > 0 && (
                  <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50 rounded-lg px-4 py-2 mb-3">
                    <span className="text-sm text-violet-700 dark:text-violet-300">
                      {selectedInterviewIds.size} surat dipilih
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDelete('interview')}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Hapus Dipilih
                    </Button>
                  </div>
                )}
                {loading ? renderLoadingState() : filteredInterviewRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-gray-500">
                      {interviewRequests.length === 0
                        ? 'Belum ada data surat wawancara yang tersimpan.'
                        : 'Tidak ada hasil yang sesuai dengan filter.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedInterviewIds.size === filteredInterviewRequests.length && filteredInterviewRequests.length > 0}
                            onChange={toggleAllInterview}
                            className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="dark:text-gray-400">Nama / NIM</TableHead>
                        <TableHead className="dark:text-gray-400 hidden md:table-cell">Topik Wawancara</TableHead>
                        <TableHead className="dark:text-gray-400 hidden sm:table-cell">Tanggal</TableHead>
                        <TableHead className="dark:text-gray-400">Status</TableHead>
                        <TableHead className="dark:text-gray-400 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInterviewRequests.map(item => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/50 dark:border-gray-700">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedInterviewIds.has(item.id)}
                              onChange={() => toggleInterviewId(item.id)}
                              className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800 dark:text-white text-sm">{item.name}</div>
                            <div className="text-xs text-slate-500 dark:text-gray-400">{item.nim}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-slate-600 dark:text-gray-300 max-w-[200px] truncate">
                            {item.researchTitle || '-'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-slate-500 dark:text-gray-400">
                            {formatArchiveDate(item.createdAt)}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLetter({ type: 'interview', item })}
                                aria-label={`Lihat detail ${item.name}`}
                                className="dark:border-gray-600 dark:text-gray-300"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload('interview', item)}
                                disabled={isProcessing}
                                aria-label={`Download ${item.name}`}
                                className="dark:border-gray-600 dark:text-gray-300"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteSingle(item.id, 'interview', item.name)}
                                disabled={isProcessing}
                                aria-label={`Hapus arsip ${item.name}`}
                                className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Permission Tab */}
              <TabsContent value="permission" className="mt-0">
                {selectedPermissionIds.size > 0 && (
                  <div className="flex items-center justify-between bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-lg px-4 py-2 mb-3">
                    <span className="text-sm text-sky-700 dark:text-sky-300">
                      {selectedPermissionIds.size} surat dipilih
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDelete('permission')}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Hapus Dipilih
                    </Button>
                  </div>
                )}
                {loading ? renderLoadingState() : filteredPermissionRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-gray-500">
                      {permissionRequests.length === 0
                        ? finalTaskTypeLabels.permission.empty
                        : 'Tidak ada hasil yang sesuai dengan filter.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedPermissionIds.size === filteredPermissionRequests.length && filteredPermissionRequests.length > 0}
                            onChange={toggleAllPermission}
                            className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="dark:text-gray-400">Nama / NIM</TableHead>
                        <TableHead className="dark:text-gray-400 hidden md:table-cell">Keperluan / Judul</TableHead>
                        <TableHead className="dark:text-gray-400 hidden sm:table-cell">Tanggal</TableHead>
                        <TableHead className="dark:text-gray-400">Status</TableHead>
                        <TableHead className="dark:text-gray-400 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPermissionRequests.map(item => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/50 dark:border-gray-700">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.has(item.id)}
                              onChange={() => togglePermissionId(item.id)}
                              className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800 dark:text-white text-sm">{item.name}</div>
                            <div className="text-xs text-slate-500 dark:text-gray-400">{item.nim}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-slate-600 dark:text-gray-300 max-w-[240px] truncate">
                            {item.permissionPurpose || item.researchTitle || '-'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-slate-500 dark:text-gray-400">
                            {formatArchiveDate(item.createdAt)}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLetter({ type: 'permission', item })}
                                aria-label={`Lihat detail ${item.name}`}
                                className="dark:border-gray-600 dark:text-gray-300"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload('permission', item)}
                                disabled={isProcessing}
                                aria-label={`Download ${item.name}`}
                                className="dark:border-gray-600 dark:text-gray-300"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteSingle(item.id, 'permission', item.name)}
                                disabled={isProcessing}
                                aria-label={`Hapus arsip ${item.name}`}
                                className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </TUSectionCard>
      )}

      {/* Delete Confirm Modal */}
      {confirmPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-red-200 dark:border-red-900/50 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
              {confirmPhase === 1 ? 'Konfirmasi Hapus' : 'Konfirmasi Akhir'}
            </h3>
            {confirmPhase === 1 ? (
              <>
                <p className="text-sm text-slate-600 dark:text-gray-300 mb-4">
                  {deleteTarget
                    ? `Hapus arsip "${deleteTarget.label}"? Data yang dihapus tidak dapat dikembalikan.`
                    : `Hapus ${batchDeleteTargets.length} arsip yang dipilih? Data yang dihapus tidak dapat dikembalikan.`}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setConfirmPhase(null); setDeleteTarget(null); setBatchDeleteTargets([]); }} className="dark:border-gray-600 dark:text-gray-300">
                    Batal
                  </Button>
                  <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                    Lanjutkan
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-gray-300 mb-3">
                  Ketik <strong>HAPUS</strong> untuk mengkonfirmasi penghapusan permanen.
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS"
                  className="w-full border rounded-md px-3 py-2 text-sm mb-4 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setConfirmPhase(null); setDeleteTarget(null); setBatchDeleteTargets([]); setConfirmText(''); }} className="dark:border-gray-600 dark:text-gray-300">
                    Batal
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    disabled={confirmText !== 'HAPUS' || isProcessing}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hapus Permanen'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Email Success Dialog */}
      {emailSuccessState && (
        <EmailSuccessDialog
          open={true}
          recipientEmail={emailSuccessState.email}
          letterNumber={emailSuccessState.letterNumber}
          title={emailSuccessState.title}
          onClose={() => setEmailSuccessState(null)}
        />
      )}

      {/* Email Sending Overlay */}
      {isSendingEmail && <EmailActionOverlay open={true} />}
    </div>
  );
}
