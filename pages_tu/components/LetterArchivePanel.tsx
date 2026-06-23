import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ActiveStudentRequest, ObservationRequest, TULetterBackgrounds, TULetterLayouts } from '../types';
import { ActiveStudentLetter } from './ActiveStudentLetter';
import { LetterPreview } from './LetterPreview';
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
  Building2,
  CalendarDays,
  CheckCircle,
  Clock3,
  Eye,
  FileSearch,
  FileText,
  GraduationCap,
  Mail,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Download
} from 'lucide-react';

const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

type ArchiveSelection =
  | { type: 'active'; item: ActiveStudentRequest }
  | { type: 'observation'; item: ObservationRequest }
  | null;

type ArchiveStatus = ActiveStudentRequest['status'];
type StatusFilter = 'all' | ArchiveStatus;

interface LetterArchivePanelProps {
  refreshKey?: number;
}

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'verified', label: 'Terverifikasi' },
  { value: 'sent', label: 'Terkirim' }
];

function formatArchiveDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return format(date, 'dd MMM yyyy HH:mm', { locale: localeId });
}

function ArchiveMetricCard({
  title,
  value,
  description,
  icon,
  accentClass
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <TUMetricCard title={title} value={value} description={description} icon={icon} accentClassName={accentClass} />
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-gray-700 py-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500 dark:text-gray-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800 dark:text-white">{value}</span>
    </div>
  );
}

export function LetterArchivePanel({ refreshKey = 0 }: LetterArchivePanelProps) {
  const [activeRequests, setActiveRequests] = useState<ActiveStudentRequest[]>([]);
  const [observationRequests, setObservationRequests] = useState<ObservationRequest[]>([]);
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [currentSemesterCode, setCurrentSemesterCode] = useState('');
  const [defaultSignature, setDefaultSignature] = useState('');
  const [defaultStamp, setDefaultStamp] = useState('');
  const [deanName, setDeanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailSuccessState, setEmailSuccessState] = useState<{ email: string; letterNumber?: string | null; title: string } | null>(null);
  const [activeListTab, setActiveListTab] = useState<'active' | 'observation'>('active');
  const [selectedLetter, setSelectedLetter] = useState<ArchiveSelection>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'active' | 'observation'; label: string } | null>(null);
  const [batchDeleteTargets, setBatchDeleteTargets] = useState<Array<{ id: string; type: 'active' | 'observation'; label: string }>>([]);
  const [confirmPhase, setConfirmPhase] = useState<1 | 2 | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedActiveIds, setSelectedActiveIds] = useState<Set<string>>(new Set());
  const [selectedObsIds, setSelectedObsIds] = useState<Set<string>>(new Set());
  // Edit observation state
  const [editTarget, setEditTarget] = useState<ObservationRequest | null>(null);

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
    if (showLoader && activeRequests.length === 0 && observationRequests.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [activeRes, observationRes, settingsRes] = await Promise.all([
        api('/api/active-student'),
        api('/api/observation-requests'),
        api('/api/tu/settings')
      ]);

      const [activeJson, observationJson, settingsJson] = await Promise.all([
        activeRes.json(),
        observationRes.json(),
        settingsRes.json()
      ]);

      const nextActiveRequests: ActiveStudentRequest[] =
        activeRes.ok && activeJson.success && Array.isArray(activeJson.data) ? activeJson.data : [];
      const nextObservationRequests: ObservationRequest[] =
        observationRes.ok && observationJson.success && Array.isArray(observationJson.data) ? observationJson.data : [];

      setActiveRequests(nextActiveRequests);
      setObservationRequests(nextObservationRequests);

      if (settingsRes.ok) {
        setLetterBackgrounds(settingsJson.letterBackgrounds || createEmptyLetterBackgrounds());
        setLetterLayouts(settingsJson.letterLayouts || createEmptyLetterLayouts());
        setCurrentSemesterCode(settingsJson.currentSemesterCode || '');
        setDefaultSignature(settingsJson.signatureBase64 || '');
        setDefaultStamp(settingsJson.stampBase64 || '');
      }

      setSelectedLetter((prev) => {
        if (!prev) return prev;

        if (prev.type === 'active') {
          const updatedItem = nextActiveRequests.find((item: ActiveStudentRequest) => item.id === prev.item.id);
          return updatedItem ? { type: 'active', item: updatedItem } : null;
        }

        const updatedItem = nextObservationRequests.find((item: ObservationRequest) => item.id === prev.item.id);
        return updatedItem ? { type: 'observation', item: updatedItem } : null;
      });

      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch letter archive data:', error);
      if (showError) {
        setFeedback({ type: 'error', message: 'Gagal memuat arsip surat.' });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchArchiveData({ showLoader: true });

    // Fetch dean name
    (async () => {
      try {
        const res = await api('/api/lecturers/by-jabatan/Dekan');
        const json = await res.json();
        if (json.found && json.data.length > 0) {
          setDeanName(json.data[0].nama);
        }
      } catch (e) {
        console.error('Failed to fetch dean name:', e);
      }
    })();

    const interval = setInterval(() => {
      fetchArchiveData({ showError: false });
    }, 20000);

    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleSendEmail = async (type: 'active-student' | 'observation', id: string) => {
    setIsProcessing(true);
    setIsSendingEmail(true);
    setFeedback(null);
    try {
      const selectedItem =
        type === 'active-student'
          ? activeRequests.find((item: ActiveStudentRequest) => item.id === id)
          : observationRequests.find((item: ObservationRequest) => item.id === id);
      const res = await api(`/api/tu/requests/${type}/${id}/send-email`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal mengirim email surat.');
      }

      await fetchArchiveData({ showError: false });
      setFeedback({ type: 'success', message: 'Surat berhasil dikirim ulang. Jika belum masuk ke inbox, cek juga folder spam.' });
      setEmailSuccessState({
        email: selectedItem?.email || '',
        letterNumber: json?.letterNumber || selectedItem?.letterNumber || null,
        title: type === 'observation' ? 'Surat observasi berhasil dikirim' : 'Surat aktif kuliah berhasil dikirim'
      });
    } catch (error) {
      console.error('Failed to send letter email:', error);
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal mengirim email surat.' });
    } finally {
      setIsSendingEmail(false);
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedLetter) return;
    const { type, item } = selectedLetter;
    const apiType = type === 'active' ? 'active-student' : 'observation';

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await api(`/api/tu/requests/${apiType}/${item.id}/download`, {
        method: 'GET'
      });
      if (!res.ok) throw new Error('Gagal mendownload PDF');

      const blob = await res.blob();
      const safeLetterNumber = item.letterNumber ? item.letterNumber.replace(/\//g, '_') : 'Arsip';
      const filename = `${safeLetterNumber}_${item.nim}.pdf`;

      // Memaksa browser downloader dengan mengubah tipe MIME menjadi octet-stream
      const forceBrowserDownloadBlob = new Blob([blob], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(forceBrowserDownloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      setFeedback({ type: 'error', message: 'Gagal mendownload PDF surat.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!selectedLetter) return;

    const item = selectedLetter.item;
    const safeLetterNumber = (item.letterNumber || 'Arsip').replace(/\//g, '_');
    const printTitle = `${safeLetterNumber}_${item.nim}`;

    const printArea = document.getElementById('print-area-archive');
    if (!printArea) {
      const originalTitle = document.title;
      document.title = printTitle;
      window.print();
      document.title = originalTitle;
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    let stylesHtml = '';
    styles.forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printTitle}</title>
          ${stylesHtml}
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-wrapper { display: flex; justify-content: center; width: 100%; }
          </style>
        </head>
        <body>
          <div class="print-wrapper">${printArea.innerHTML}</div>
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  const handleVerifyObservation = async (id: string) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await api(`/api/observation-requests/${id}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureBase64: defaultSignature,
          stampBase64: defaultStamp
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal memverifikasi surat observasi.');
      }

      await fetchArchiveData({ showError: false });
      setSelectedLetter((prev) =>
        prev && prev.type === 'observation' && prev.item.id === id
          ? {
              type: 'observation',
              item: {
                ...prev.item,
                status: 'verified',
                signatureBase64: defaultSignature,
                stampBase64: defaultStamp,
                letterNumber: json?.letterNumber || prev.item.letterNumber
              }
            }
          : prev
      );
      setFeedback({ type: 'success', message: 'Surat observasi berhasil diverifikasi dan diberi nomor surat.' });
    } catch (error) {
      console.error('Failed to verify observation:', error);
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal memverifikasi surat observasi.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Delete handlers ─────────────────────────────────────────────────────────
  const openDeleteSingle = (id: string, type: 'active' | 'observation', label: string) => {
    setDeleteTarget({ id, type, label });
    setBatchDeleteTargets([]);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const openBatchDelete = (type: 'active' | 'observation') => {
    const ids = type === 'active' ? selectedActiveIds : selectedObsIds;
    const sourceList = type === 'active' ? activeRequests : observationRequests;
    const targets = sourceList
      .filter(i => ids.has(i.id))
      .map(i => ({ id: i.id, type, label: i.name + (type === 'observation' ? ` — ${(i as ObservationRequest).company || ''}` : '') }));
    setDeleteTarget(null);
    setBatchDeleteTargets(targets);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const closeConfirm = () => { setConfirmPhase(null); setConfirmText(''); setDeleteTarget(null); setBatchDeleteTargets([]); };

  const executeDelete = async () => {
    if (confirmText !== 'HAPUS') return;
    setIsProcessing(true);
    closeConfirm();
    try {
      if (deleteTarget) {
        const apiType = deleteTarget.type === 'active' ? 'active-student' : 'observation';
        const res = await api(`/api/tu/requests/${apiType}/${deleteTarget.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal menghapus.');
        if (selectedLetter?.item.id === deleteTarget.id) setSelectedLetter(null);
        setFeedback({ type: 'success', message: `${deleteTarget.label} berhasil dihapus.` });
      } else {
        const type = batchDeleteTargets[0]?.type;
        const apiType = type === 'active' ? 'active-student' : 'observation';
        const ids = batchDeleteTargets.map(t => t.id);
        const res = await api(`/api/tu/requests/${apiType}/batch-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal batch delete.');
        if (type === 'active') setSelectedActiveIds(new Set());
        else setSelectedObsIds(new Set());
        setFeedback({ type: 'success', message: `${batchDeleteTargets.length} arsip berhasil dihapus.` });
      }
      await fetchArchiveData({ showError: false });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menghapus data.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleActiveId = (id: string) => setSelectedActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleObsId = (id: string) => setSelectedObsIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllActive = () => setSelectedActiveIds(selectedActiveIds.size === filteredActiveRequests.length ? new Set() : new Set(filteredActiveRequests.map(i => i.id)));
  const toggleAllObs = () => setSelectedObsIds(selectedObsIds.size === filteredObservationRequests.length ? new Set() : new Set(filteredObservationRequests.map(i => i.id)));

  // ── Edit Observation ────────────────────────────────────────────────────────
  const handleSaveObservationEdit = async (data: Partial<ObservationRequest> & { students: { name: string; nim: string }[] }) => {
    if (!editTarget) return;
    setIsProcessing(true);
    try {
      const res = await api(`/api/tu/requests/observation/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan perubahan.');
      setEditTarget(null);
      await fetchArchiveData({ showError: false });
      setFeedback({ type: 'success', message: 'Data surat observasi berhasil diperbarui.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menyimpan perubahan.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesStatus = (status: ArchiveStatus) => statusFilter === 'all' || status === statusFilter;
  const matchesQuery = (fields: Array<string | undefined>) =>
    normalizedQuery === '' ||
    fields.some((field) => (field || '').toLowerCase().includes(normalizedQuery));

  const filteredActiveRequests = activeRequests.filter((item: ActiveStudentRequest) =>
    matchesStatus(item.status) &&
    matchesQuery([
      item.name,
      item.nim,
      item.email,
      item.letterNumber,
      item.studyProgramName,
      item.faculty,
      formatArchiveDate(item.createdAt)
    ])
  );

  const filteredObservationRequests = observationRequests.filter((item: ObservationRequest) =>
    matchesStatus(item.status) &&
    matchesQuery([
      item.name,
      item.nim,
      item.email,
      item.recipientName,
      item.company,
      item.courseName,
      item.lecturerName,
      item.letterNumber,
      formatArchiveDate(item.createdAt)
    ])
  );

  const totalArchiveCount = activeRequests.length + observationRequests.length;
  const pendingCount = [...activeRequests, ...observationRequests].filter(
    (item: ActiveStudentRequest | ObservationRequest) => item.status === 'pending'
  ).length;
  const verifiedCount = [...activeRequests, ...observationRequests].filter(
    (item: ActiveStudentRequest | ObservationRequest) => item.status === 'verified'
  ).length;
  const sentCount = [...activeRequests, ...observationRequests].filter(
    (item: ActiveStudentRequest | ObservationRequest) => item.status === 'sent'
  ).length;
  const currentResultsCount = activeListTab === 'active' ? filteredActiveRequests.length : filteredObservationRequests.length;
  const currentTotalCount = activeListTab === 'active' ? activeRequests.length : observationRequests.length;
  const emailUx = (
    <>
      <EmailActionOverlay
        open={isSendingEmail}
        title="Mengirim surat dari arsip..."
        description="Sistem sedang membuat ulang file surat terbaru dan mengirimkannya ke email tujuan."
      />
      <EmailSuccessDialog
        open={Boolean(emailSuccessState)}
        onClose={() => setEmailSuccessState(null)}
        recipientEmail={emailSuccessState?.email}
        letterNumber={emailSuccessState?.letterNumber}
        title={emailSuccessState?.title}
      />
    </>
  );

  if (selectedLetter) {
    const semesterMeta = getSemesterMeta(currentSemesterCode);
    const isObservation = selectedLetter.type === 'observation';
    const observationItem = selectedLetter.type === 'observation' ? selectedLetter.item : null;
    const activeItem = selectedLetter.type === 'active' ? selectedLetter.item : null;
    const item = selectedLetter.item;
    const canSendEmail = item.status === 'verified' || item.status === 'sent';
    const actionHint =
      item.status === 'pending'
        ? isObservation
          ? 'Verifikasi surat observasi untuk membuat nomor surat dan mengaktifkan pengiriman email.'
          : 'Surat aktif kuliah masih menunggu verifikasi dari Panel Admin sebelum dapat dikirim ke email.'
        : item.status === 'verified'
          ? 'Surat sudah siap dicetak ulang atau dikirim langsung ke email mahasiswa.'
          : 'Surat sudah pernah dikirim dan tetap bisa dicetak ulang atau dikirim kembali kapan saja.';

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
        {feedback && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {feedback.message}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-gradient-to-br from-white via-slate-50 to-sky-50 dark:from-gray-900 dark:via-gray-800 dark:to-sky-900/20 p-5 shadow-sm print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedLetter(null)} className="w-fit dark:hover:bg-gray-800 dark:text-gray-300">
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke daftar arsip
              </Button>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300">
                    {isObservation ? 'Surat Observasi' : 'Surat Aktif Kuliah'}
                  </Badge>
                  {getStatusBadge(item.status)}
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {isObservation ? 'Detail Arsip Surat Observasi' : 'Detail Arsip Surat Aktif Kuliah'}
                </h2>
                <p className="text-sm text-slate-600 dark:text-gray-400">
                  {item.name} ({item.nim}){item.email ? ` | ${item.email}` : ''}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <div className="rounded-2xl border border-white/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">
                  <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  Dibuat
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatArchiveDate(item.createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">
                  <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  Nomor Surat
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{item.letterNumber || 'Belum dibuat'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="print:block print:w-full print:m-0 print:p-0">
            <Card className="h-full border-slate-200 dark:border-gray-700 shadow-sm print:border-0 print:shadow-none">
              <CardHeader className="border-b dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 py-4 print:hidden">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-800 dark:text-white">
                  <Printer className="h-5 w-5 text-slate-600" /> Preview Surat
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Data arsip diambil dari database. PDF akan digenerate hanya saat dicetak atau dikirim ulang.
                </CardDescription>
              </CardHeader>
              <CardContent id="print-area-archive" className="flex min-h-200 justify-center overflow-auto print:overflow-visible bg-slate-200/50 p-6 print:bg-white print:p-0">
                {isObservation ? (
                  <LetterPreview
                    data={{
                      recipientName: observationItem?.recipientName || '',
                      companyName: observationItem?.company || '',
                      companyAddress: observationItem?.companyAddress || '',
                      courseName: observationItem?.courseName || '',
                      lecturerName: observationItem?.lecturerName || '',
                      headOfProgramName: observationItem?.headOfProgramName || '',
                      studyProgramName: (observationItem as any)?.studyProgramName,
                      studyProgramLevel: (observationItem as any)?.studyProgramLevel,
                      students: observationItem?.students || []
                    }}
                    backgroundImageBase64={letterBackgrounds.observation.imageBase64}
                    layout={letterLayouts.observation}
                    showLayoutGuide={false}
                    letterNumber={observationItem?.letterNumber}
                    signatureBase64={observationItem?.status === 'pending' ? defaultSignature : observationItem?.signatureBase64 || defaultSignature}
                    stampBase64={observationItem?.status === 'pending' ? defaultStamp : observationItem?.stampBase64 || defaultStamp}
                  />
                ) : (
                  <ActiveStudentLetter
                    data={{
                      ...activeItem!,
                      semesterCode: currentSemesterCode,
                      semesterName: semesterMeta.semesterName,
                      academicYear: semesterMeta.academicYear,
                      signatureBase64: activeItem?.status === 'pending' ? defaultSignature : activeItem?.signatureBase64,
                      stampBase64: activeItem?.status === 'pending' ? defaultStamp : activeItem?.stampBase64,
                      backgroundImageBase64: letterBackgrounds.activeStudent.imageBase64,
                      layout: letterLayouts.activeStudent,
                      deanName: deanName
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 print:hidden">
            <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-gray-700">
                <CardTitle className="text-base text-slate-800 dark:text-white">Aksi Cepat</CardTitle>
                <CardDescription className="dark:text-gray-400">{actionHint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {isObservation && item.status === 'pending' && (
                  <Button onClick={() => handleVerifyObservation(item.id)} disabled={isProcessing} className="w-full justify-center">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Verifikasi Surat
                  </Button>
                )}
                <Button variant="outline" onClick={handlePrint} className="w-full justify-center dark:border-gray-700 dark:hover:bg-gray-800">
                  <Printer className="mr-2 h-4 w-4" /> Cetak Ulang
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={isProcessing} className="w-full justify-center dark:border-gray-700 dark:hover:bg-gray-800">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button
                  onClick={() => handleSendEmail(isObservation ? 'observation' : 'active-student', item.id)}
                  disabled={!canSendEmail || isProcessing || isSendingEmail}
                  className="w-full justify-center"
                >
                  {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isSendingEmail ? 'Mengirim Email...' : canSendEmail ? 'Kirim ke Email' : 'Email Belum Tersedia'}
                </Button>
                {isObservation && (
                  <Button
                    variant="outline"
                    onClick={() => setEditTarget(observationItem)}
                    disabled={isProcessing}
                    className="w-full justify-center border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit Data Surat
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => openDeleteSingle(item.id, isObservation ? 'observation' : 'active', item.name)}
                  disabled={isProcessing}
                  className="w-full justify-center border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus Arsip Ini
                </Button>
              </CardContent>
            </Card>


            <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-gray-700">
                <CardTitle className="text-base text-slate-800 dark:text-white">Ringkasan Data</CardTitle>
                <CardDescription className="dark:text-gray-400">Informasi penting untuk cek cepat sebelum mencetak ulang atau mengirimkan surat.</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <DetailRow label="Nama" value={item.name} />
                <DetailRow label="NIM" value={item.nim} />
                <DetailRow label="Email" value={item.email || '-'} />
                <DetailRow label="Tanggal Arsip" value={formatArchiveDate(item.createdAt)} />
                <DetailRow label="Nomor Surat" value={item.letterNumber || 'Belum dibuat'} />
                {isObservation ? (
                  <>
                    <DetailRow label="Tujuan" value={observationItem?.recipientName || '-'} />
                    <DetailRow label="Instansi" value={observationItem?.company || '-'} />
                    <DetailRow label="Mahasiswa di Surat" value={`${observationItem?.students?.length || 0} orang`} />
                  </>
                ) : (
                  <>
                    <DetailRow label="Program Studi" value={activeItem?.studyProgramName || '-'} />
                    <DetailRow label="Fakultas" value={activeItem?.faculty || '-'} />
                    <DetailRow label="Semester" value={formatSemesterLabel(currentSemesterCode)} />
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
              <CardContent className="pt-4">
                <div className="rounded-2xl bg-slate-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Catatan Operasional</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-400">
                    Arsip ini menyimpan data sumber surat. Saat aksi cetak atau kirim dijalankan, sistem akan membuat output
                    terbaru berdasarkan template, stempel, dan tanda tangan TU yang aktif.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {emailUx}
      </div>
    );
  }

  return (
    <div className="space-y-6 print:hidden">
      {feedback && (
        <TUNotice tone={feedback.type === 'success' ? 'success' : 'danger'}>
          {feedback.message}
        </TUNotice>
      )}

      <TUSectionCard
        title="Kelola arsip surat lebih cepat"
        description="Arsip menyimpan data surat aktif kuliah dan observasi agar dapat dilihat kembali, dicetak ulang, atau dikirim email tanpa menyimpan file PDF hasil generate."
        className="overflow-visible"
        contentClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        actions={
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-gray-200">Sinkronisasi otomatis tiap 20 detik</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                {lastUpdatedAt ? `Terakhir diperbarui ${formatArchiveDate(lastUpdatedAt)}` : 'Belum ada data terbaru.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => fetchArchiveData()} disabled={isRefreshing || loading} className="dark:border-gray-700 dark:hover:bg-gray-800">
              <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Muat Ulang
            </Button>
          </div>
        }
      >
        <ArchiveMetricCard
          title="Total Arsip"
          value={String(totalArchiveCount)}
          description={`${activeRequests.length} surat aktif kuliah dan ${observationRequests.length} surat observasi.`}
          accentClass="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          icon={<FileText className="h-5 w-5" />}
        />
        <ArchiveMetricCard
          title="Perlu Tindak Lanjut"
          value={String(pendingCount)}
          description="Surat yang masih menunggu verifikasi atau proses lanjutan."
          accentClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <ArchiveMetricCard
          title="Siap Dikirim"
          value={String(verifiedCount)}
          description="Surat terverifikasi yang sudah siap dicetak atau dikirim ke email."
          accentClass="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <ArchiveMetricCard
          title="Sudah Terkirim"
          value={String(sentCount)}
          description="Riwayat surat yang sudah pernah didistribusikan ke pemohon."
          accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          icon={<Mail className="h-5 w-5" />}
        />
      </TUSectionCard>

      <TUSectionCard
        title="Daftar Arsip"
        description="Cari arsip berdasarkan nama, NIM, tujuan surat, instansi, nomor surat, atau tanggal pembuatan."
        contentClassName="space-y-5"
        actions={
          <Tabs value={activeListTab} onValueChange={(value) => setActiveListTab(value as 'active' | 'observation')}>
            <PageTabs
              items={[
                { value: 'active', label: `Aktif Kuliah (${activeRequests.length})`, icon: GraduationCap },
                { value: 'observation', label: `Observasi (${observationRequests.length})`, icon: Building2 }
              ]}
              className="w-full sm:w-fit"
            />
          </Tabs>
        }
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={activeListTab === 'active' ? 'Cari nama, NIM, email, prodi, atau nomor surat...' : 'Cari tujuan, instansi, nama mahasiswa, atau nomor surat...'}
              className="pl-10 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilterOptions.map((option) => {
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

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white dark:bg-gray-700 p-3 text-slate-600 dark:text-gray-300 shadow-sm">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Menampilkan {currentResultsCount} dari {currentTotalCount} arsip
                </p>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {activeListTab === 'active' ? 'Daftar surat aktif kuliah yang tersimpan di sistem.' : 'Daftar surat observasi yang dapat diverifikasi, dicetak, atau dikirim ulang.'}
                </p>
              </div>
            </div>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="dark:hover:bg-gray-700"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Reset Filter
              </Button>
            )}
          </div>

          <Tabs value={activeListTab}>
            <TabsContent value="active" className="mt-0">
              {/* Batch Delete Toolbar */}
              {selectedActiveIds.size > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3">
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">
                    {selectedActiveIds.size} surat dipilih
                  </span>
                  <Button
                    variant="outline" size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40"
                    onClick={() => openBatchDelete('active')}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Hapus Terpilih
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 p-10 text-center text-slate-500 dark:text-gray-400">
                  Memuat arsip surat aktif kuliah...
                </div>
              ) : filteredActiveRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 p-10 text-center">
                  <FileText className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-gray-600" />
                  <p className="text-base font-medium text-slate-700 dark:text-gray-300">
                    {activeRequests.length === 0 ? 'Belum ada data surat aktif kuliah yang tersimpan.' : 'Tidak ada arsip yang cocok dengan filter saat ini.'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">Ubah kata kunci pencarian atau reset filter untuk melihat arsip lainnya.</p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-gray-700 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-gray-800/50">
                          <TableHead className="w-10">
                            <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                              checked={selectedActiveIds.size === filteredActiveRequests.length && filteredActiveRequests.length > 0}
                              onChange={toggleAllActive} />
                          </TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Mahasiswa</TableHead>
                          <TableHead>Program Studi</TableHead>
                          <TableHead>Nomor Surat</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActiveRequests.map((item) => (
                          <TableRow key={item.id} className={`hover:bg-slate-50/80 dark:hover:bg-gray-800/50 ${selectedActiveIds.has(item.id) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                            <TableCell>
                              <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                                checked={selectedActiveIds.has(item.id)}
                                onChange={() => toggleActiveId(item.id)} />
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{formatArchiveDate(item.createdAt)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{item.nim}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{item.studyProgramName || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-500 dark:text-gray-400">{item.letterNumber || 'Belum dibuat'}</TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedLetter({ type: 'active', item })} className="dark:border-gray-700 dark:hover:bg-gray-800">
                                  <Eye className="mr-2 h-4 w-4" /> Detail
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => openDeleteSingle(item.id, 'active', item.name)} disabled={isProcessing} className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {filteredActiveRequests.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-slate-500 dark:text-gray-400">{item.nim}</p>
                          </div>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Tanggal</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{formatArchiveDate(item.createdAt)}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Nomor Surat</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{item.letterNumber || 'Belum dibuat'}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                          <GraduationCap className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                          {item.studyProgramName || 'Program studi belum tersedia'}
                        </div>
                        <Button variant="outline" className="mt-4 w-full justify-center dark:border-gray-700 dark:hover:bg-gray-700" onClick={() => setSelectedLetter({ type: 'active', item })}>
                          <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="observation" className="mt-0">
              {/* Batch Delete Toolbar */}
              {selectedObsIds.size > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3">
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">
                    {selectedObsIds.size} surat dipilih
                  </span>
                  <Button
                    variant="outline" size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40"
                    onClick={() => openBatchDelete('observation')}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Hapus Terpilih
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 p-10 text-center text-slate-500 dark:text-gray-400">
                  Memuat arsip surat observasi...
                </div>
              ) : filteredObservationRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 p-10 text-center">
                  <FileText className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-gray-600" />
                  <p className="text-base font-medium text-slate-700 dark:text-gray-300">
                    {observationRequests.length === 0 ? 'Belum ada data surat observasi yang tersimpan.' : 'Tidak ada arsip yang cocok dengan filter saat ini.'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">Coba kata kunci lain atau reset filter untuk melihat seluruh arsip.</p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-gray-700 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-gray-800/50">
                          <TableHead className="w-10">
                            <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                              checked={selectedObsIds.size === filteredObservationRequests.length && filteredObservationRequests.length > 0}
                              onChange={toggleAllObs} />
                          </TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Tujuan</TableHead>
                          <TableHead>Instansi</TableHead>
                          <TableHead>Mahasiswa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredObservationRequests.map((item) => (
                          <TableRow key={item.id} className={`hover:bg-slate-50/80 dark:hover:bg-gray-800/50 ${selectedObsIds.has(item.id) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                            <TableCell>
                              <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                                checked={selectedObsIds.has(item.id)}
                                onChange={() => toggleObsId(item.id)} />
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{formatArchiveDate(item.createdAt)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{item.recipientName || '-'}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{item.letterNumber || 'Nomor surat belum dibuat'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{item.company || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{item.students.length} mahasiswa</TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedLetter({ type: 'observation', item })} className="dark:border-gray-700 dark:hover:bg-gray-800">
                                  <Eye className="mr-2 h-4 w-4" /> Detail
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setEditTarget(item)} className="border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => openDeleteSingle(item.id, 'observation', item.name + ' — ' + (item.company || ''))} disabled={isProcessing} className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {filteredObservationRequests.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.recipientName || 'Tujuan belum diisi'}</p>
                            <p className="text-sm text-slate-500 dark:text-gray-400">{item.company || 'Instansi belum diisi'}</p>
                          </div>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Pemohon</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{item.name}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400">{item.nim}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Tanggal</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{formatArchiveDate(item.createdAt)}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                            {item.company || 'Instansi belum diisi'}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                            {item.students.length} mahasiswa pada surat
                          </div>
                        </div>
                        <Button variant="outline" className="mt-4 w-full justify-center dark:border-gray-700 dark:hover:bg-gray-700" onClick={() => setSelectedLetter({ type: 'observation', item })}>
                          <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
      </TUSectionCard>

      {/* ── Double Confirm Delete Dialog ───────────────────────────────────── */}
      {confirmPhase === 1 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Hapus Arsip?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Langkah 1 dari 2 — tinjau data</p>
              </div>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 mb-5 space-y-1 max-h-40 overflow-y-auto">
              {deleteTarget ? (
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{deleteTarget.label}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">{batchDeleteTargets.length} arsip akan dihapus</p>
                  {batchDeleteTargets.map(r => (
                    <p key={r.id} className="text-xs text-slate-600 dark:text-slate-400">• {r.label}</p>
                  ))}
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 dark:border-gray-600" onClick={closeConfirm}>Batal</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => setConfirmPhase(2)}>Lanjutkan →</Button>
            </div>
          </div>
        </div>
      )}

      {confirmPhase === 2 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Konfirmasi Penghapusan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Ketik <strong className="text-red-600 dark:text-red-400">HAPUS</strong> untuk menghapus permanen.
            </p>
            <Input
              placeholder="Ketik HAPUS"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="mb-4 border-red-300 focus:ring-red-400 dark:border-red-800 dark:bg-gray-700"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmText === 'HAPUS' && executeDelete()}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 dark:border-gray-600" onClick={() => setConfirmPhase(1)}>← Kembali</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50" onClick={executeDelete} disabled={confirmText !== 'HAPUS' || isProcessing}>
                <Trash2 className="w-4 h-4 mr-2" /> Hapus
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Observation Modal ─────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
                  <Pencil className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Data Observasi</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nomor surat tidak akan berubah.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditTarget(null)} className="rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Tujuan Surat</label>
                  <Input 
                    value={editTarget.recipientName || ''} 
                    onChange={e => setEditTarget({...editTarget, recipientName: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Instansi</label>
                  <Input 
                    value={editTarget.company || ''} 
                    onChange={e => setEditTarget({...editTarget, company: e.target.value})} 
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Alamat Instansi</label>
                  <Input 
                    value={editTarget.companyAddress || ''} 
                    onChange={e => setEditTarget({...editTarget, companyAddress: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Mata Kuliah</label>
                  <Input 
                    value={editTarget.courseName || ''} 
                    onChange={e => setEditTarget({...editTarget, courseName: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Dosen Pengampu</label>
                  <Input 
                    value={editTarget.lecturerName || ''} 
                    onChange={e => setEditTarget({...editTarget, lecturerName: e.target.value})} 
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Daftar Mahasiswa ({editTarget.students.length})</label>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    onClick={() => setEditTarget({...editTarget, students: [...editTarget.students, {name: '', nim: ''}]})}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Mahasiswa
                  </Button>
                </div>
                <div className="space-y-2">
                  {editTarget.students.map((stu, i) => (
                    <div key={i} className="flex gap-2">
                      <Input 
                        placeholder="NIM" className="w-1/3" value={stu.nim} 
                        onChange={e => {
                          const newStudents = [...editTarget.students];
                          newStudents[i].nim = e.target.value;
                          setEditTarget({...editTarget, students: newStudents});
                        }} 
                      />
                      <Input 
                        placeholder="Nama Lengkap" className="flex-1" value={stu.name} 
                        onChange={e => {
                          const newStudents = [...editTarget.students];
                          newStudents[i].name = e.target.value;
                          setEditTarget({...editTarget, students: newStudents});
                        }} 
                      />
                      <Button 
                        type="button" variant="outline" size="icon" className="shrink-0 border-red-200 text-red-500 hover:bg-red-50"
                        onClick={() => {
                          const newStudents = [...editTarget.students];
                          newStudents.splice(i, 1);
                          setEditTarget({...editTarget, students: newStudents});
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 flex justify-end gap-3 rounded-b-2xl">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Batal</Button>
              <Button 
                onClick={() => handleSaveObservationEdit(editTarget)} 
                disabled={isProcessing || editTarget.students.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Pencil className="w-4 h-4 mr-2" /> Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {emailUx}
    </div>
  );
}
