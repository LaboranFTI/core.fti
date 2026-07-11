import React, { useEffect, useState } from 'react';
// date-fns format/locale no longer needed – using Intl.DateTimeFormat with explicit timezone
import { ActiveStudentRequest, ObservationRequest, CounselingRequest, SuRekRequest, TULetterBackgrounds, TULetterLayouts } from '../types';
import { ActiveStudentLetter } from './ActiveStudentLetter';
import { LetterPreview } from './LetterPreview';
import { ValidationQrCode } from './ValidationQrCode';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { PageTabs } from '../../components/ui/page-tabs';
import { Tabs, TabsContent } from '../../components/ui/tabs';
import { EmailActionOverlay } from './EmailActionOverlay';
import { EmailSuccessDialog } from './EmailSuccessDialog';
import { TUMetricCard, TUNotice, TUSectionCard } from './TUPageComponents';
import { ArchiveStatusBadge } from './archive/ArchiveStatusBadge';
import { DetailRow } from './archive/DetailRow';
import {
  countArchiveStatuses,
  filterArchiveRequests,
  StatusFilter
} from './archive/archiveFilters';
import {
  createEmptyLetterBackgrounds,
  createEmptyLetterLayouts,
  formatSemesterLabel,
  getSemesterMeta,
  normalizeLetterBackgrounds,
  normalizeLetterLayouts
} from '../lib/letterSettings';
import { formatArchiveDate } from '../lib/archiveFormatting';
import { getArchiveApiType, getArchiveTitle, tuApi } from '../services/tuApi';
import {
  ArrowLeft,
  Award,
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
  Download,
  ExternalLink,
  QrCode
} from 'lucide-react';

type ArchiveSelection =
  | { type: 'active'; item: ActiveStudentRequest }
  | { type: 'observation'; item: ObservationRequest }
  | { type: 'counseling'; item: CounselingRequest }
  | { type: 'su-rek'; item: SuRekRequest }
  | null;

interface LetterArchivePanelProps {
  refreshKey?: number;
}

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'verified', label: 'Terverifikasi' },
  { value: 'sent', label: 'Terkirim' }
];

export function LetterArchivePanel({ refreshKey = 0 }: LetterArchivePanelProps) {
  const [activeRequests, setActiveRequests] = useState<ActiveStudentRequest[]>([]);
  const [observationRequests, setObservationRequests] = useState<ObservationRequest[]>([]);
  const [counselingRequests, setCounselingRequests] = useState<CounselingRequest[]>([]);
  const [suRekRequests, setSuRekRequests] = useState<SuRekRequest[]>([]);
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [currentSemesterCode, setCurrentSemesterCode] = useState('');
  const [deanName, setDeanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailSuccessState, setEmailSuccessState] = useState<{ email: string; letterNumber?: string | null; title: string } | null>(null);
  const [activeListTab, setActiveListTab] = useState<'active' | 'observation' | 'counseling' | 'su-rek'>('active');
  const [selectedLetter, setSelectedLetter] = useState<ArchiveSelection>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'active' | 'observation' | 'counseling' | 'su-rek'; label: string } | null>(null);
  const [batchDeleteTargets, setBatchDeleteTargets] = useState<Array<{ id: string; type: 'active' | 'observation' | 'counseling' | 'su-rek'; label: string }>>([]);
  const [confirmPhase, setConfirmPhase] = useState<1 | 2 | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedActiveIds, setSelectedActiveIds] = useState<Set<string>>(new Set());
  const [selectedObsIds, setSelectedObsIds] = useState<Set<string>>(new Set());
  const [selectedCounselingIds, setSelectedCounselingIds] = useState<Set<string>>(new Set());
  const [selectedSuRekIds, setSelectedSuRekIds] = useState<Set<string>>(new Set());
  // Edit observation state
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const fetchArchiveData = async ({
    showLoader = false,
    showError = true
  }: {
    showLoader?: boolean;
    showError?: boolean;
  } = {}) => {
    if (showLoader && activeRequests.length === 0 && observationRequests.length === 0 && counselingRequests.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [activeRes, observationRes, counselingRes, suRekRes, settingsRes] = await Promise.all([
        tuApi.getActiveStudentRequests(),
        tuApi.getObservationRequests(),
        tuApi.getCounselingRequests(),
        tuApi.getSuRekRequests(),
        tuApi.getSettings()
      ]);

      const [activeJson, observationJson, counselingJson, suRekJson, settingsJson] = await Promise.all([
        activeRes.json(),
        observationRes.json(),
        counselingRes.json(),
        suRekRes.json(),
        settingsRes.json()
      ]);

      const nextActiveRequests: ActiveStudentRequest[] =
        activeRes.ok && activeJson.success && Array.isArray(activeJson.data) ? activeJson.data : [];
      const nextObservationRequests: ObservationRequest[] =
        observationRes.ok && observationJson.success && Array.isArray(observationJson.data) ? observationJson.data : [];
      const nextCounselingRequests: CounselingRequest[] =
        counselingRes.ok && counselingJson.success && Array.isArray(counselingJson.data) ? counselingJson.data : [];
      const nextSuRekRequests: SuRekRequest[] =
        suRekRes.ok && suRekJson.success && Array.isArray(suRekJson.data) ? suRekJson.data : [];

      setActiveRequests(nextActiveRequests);
      setObservationRequests(nextObservationRequests);
      setCounselingRequests(nextCounselingRequests);
      setSuRekRequests(nextSuRekRequests);

      if (settingsRes.ok) {
        setLetterBackgrounds(normalizeLetterBackgrounds(settingsJson.letterBackgrounds));
        setLetterLayouts(normalizeLetterLayouts(settingsJson.letterLayouts || createEmptyLetterLayouts()));
        setCurrentSemesterCode(settingsJson.currentSemesterCode || '');
      }

      setSelectedLetter((prev) => {
        if (!prev) return prev;

        if (prev.type === 'active') {
          const updatedItem = nextActiveRequests.find((item: ActiveStudentRequest) => item.id === prev.item.id);
          return updatedItem ? { type: 'active', item: updatedItem } : null;
        } else if (prev.type === 'counseling') {
          const updatedItem = nextCounselingRequests.find((item: CounselingRequest) => item.id === prev.item.id);
          return updatedItem ? { type: 'counseling', item: updatedItem } : null;
        } else if (prev.type === 'su-rek') {
          const updatedItem = nextSuRekRequests.find((item) => item.id === prev.item.id);
          return updatedItem ? { type: 'su-rek', item: updatedItem } : null;
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
        const res = await tuApi.getDeanLecturers();
        const json = await res.json();
        if (json.found && json.data.length > 0) {
          setDeanName(json.data[0].nama);
          return;
        }

        const viceRes = await tuApi.getViceDeanLecturers();
        const viceJson = await viceRes.json();
        if (viceJson.found && viceJson.data.length > 0) {
          setDeanName(viceJson.data[0].nama);
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

  const handleSendEmail = async (type: 'active-student' | 'observation' | 'counseling' | 'su-rek', id: string) => {
    setIsProcessing(true);
    setIsSendingEmail(true);
    setFeedback(null);
    try {
      const selectedItem =
        type === 'active-student'
          ? activeRequests.find((item: ActiveStudentRequest) => item.id === id)
          : type === 'observation'
            ? observationRequests.find((item: ObservationRequest) => item.id === id)
            : type === 'counseling'
              ? counselingRequests.find((item: CounselingRequest) => item.id === id)
              : suRekRequests.find((item) => item.id === id);
      const res = await tuApi.sendLetterEmail(type, id);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || 'Gagal mengirim email surat.');
      }

      await fetchArchiveData({ showError: false });
      setFeedback({ type: 'success', message: 'Surat berhasil dikirim ulang. Jika belum masuk ke inbox, cek juga folder spam.' });
      setEmailSuccessState({
        email: selectedItem?.email || '',
        letterNumber: json?.letterNumber || selectedItem?.letterNumber || null,
        title: type === 'observation'
          ? 'Surat observasi berhasil dikirim'
          : type === 'counseling'
            ? 'Surat konseling berhasil dikirim'
            : type === 'su-rek'
              ? 'Surat rekomendasi berhasil dikirim'
              : 'Surat aktif kuliah berhasil dikirim'
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
    const apiType = getArchiveApiType(type);

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await tuApi.downloadLetter(apiType, item.id);
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
      const isCounselingTarget = selectedLetter?.type === 'counseling';
      const res = isCounselingTarget
        ? await tuApi.verifyCounseling(id)
        : await tuApi.verifyObservation(id);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || `Gagal memverifikasi ${isCounselingTarget ? 'surat konseling' : 'surat observasi'}.`);
      }

      await fetchArchiveData({ showError: false });
      setSelectedLetter((prev) =>
        prev && prev.type === 'observation' && prev.item.id === id
          ? {
              type: 'observation',
              item: {
                ...prev.item,
                status: 'verified',
                letterNumber: json?.letterNumber || prev.item.letterNumber,
                validationToken: json?.validationToken || prev.item.validationToken
              }
            }
          : prev
      );
      setSelectedLetter((prev) =>
        prev && prev.type === 'counseling' && prev.item.id === id
          ? {
              type: 'counseling',
              item: {
                ...prev.item,
                status: 'verified',
                letterNumber: json?.letterNumber || prev.item.letterNumber,
                validationToken: json?.validationToken || prev.item.validationToken
              }
            }
          : prev
      );
      setFeedback({ type: 'success', message: `${isCounselingTarget ? 'Surat konseling' : 'Surat observasi'} berhasil diverifikasi dan diberi nomor surat.` });
    } catch (error) {
      console.error('Failed to verify observation:', error);
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal memverifikasi surat.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getPublicValidationUrl = (token?: string | null) =>
    token ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tu/validasi-surat/${token}` : '';

  const handleCreateValidationToken = async () => {
    if (!selectedLetter) return;
    const apiType = getArchiveApiType(selectedLetter.type);

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await tuApi.ensureValidationToken(apiType, selectedLetter.item.id);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Gagal membuat link validasi surat.');
      }

      setSelectedLetter((prev) =>
        prev?.type === 'active'
          ? {
              type: 'active',
              item: { ...prev.item, validationToken: json.validationToken }
            }
          : prev?.type === 'observation'
            ? {
                type: 'observation',
                item: { ...prev.item, validationToken: json.validationToken }
              }
            : prev?.type === 'su-rek'
              ? {
                  type: 'su-rek',
                  item: { ...prev.item, validationToken: json.validationToken }
                }
              : prev
      );
      await fetchArchiveData({ showError: false });
      setFeedback({ type: 'success', message: 'Link validasi publik berhasil dibuat.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal membuat link validasi surat.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Delete handlers ─────────────────────────────────────────────────────────
  const openDeleteSingle = (id: string, type: 'active' | 'observation' | 'counseling' | 'su-rek', label: string) => {
    setDeleteTarget({ id, type, label });
    setBatchDeleteTargets([]);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const openBatchDelete = (type: 'active' | 'observation' | 'counseling' | 'su-rek') => {
    const ids = type === 'active'
      ? selectedActiveIds
      : type === 'observation'
        ? selectedObsIds
        : type === 'counseling'
          ? selectedCounselingIds
          : selectedSuRekIds;
    const sourceList = type === 'active'
      ? activeRequests
      : type === 'observation'
        ? observationRequests
        : type === 'counseling'
          ? counselingRequests
          : suRekRequests;
    const targets = sourceList
      .filter(i => ids.has(i.id))
      .map(i => ({ id: i.id, type, label: i.name }));
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
        const apiType = getArchiveApiType(deleteTarget.type);
        const res = await tuApi.deleteLetter(apiType, deleteTarget.id);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal menghapus.');
        if (selectedLetter?.item.id === deleteTarget.id) setSelectedLetter(null);
        setFeedback({ type: 'success', message: `${deleteTarget.label} berhasil dihapus.` });
      } else {
        const type = batchDeleteTargets[0]?.type;
        const apiType = type ? getArchiveApiType(type) : 'active-student';
        const ids = batchDeleteTargets.map(t => t.id);
        const res = await tuApi.batchDeleteLetters(apiType, ids);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal batch delete.');
        if (type === 'active') setSelectedActiveIds(new Set());
        else if (type === 'observation') setSelectedObsIds(new Set());
        else if (type === 'counseling') setSelectedCounselingIds(new Set());
        else setSelectedSuRekIds(new Set());
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
  const toggleCounselingId = (id: string) => setSelectedCounselingIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSuRekId = (id: string) => setSelectedSuRekIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllActive = () => setSelectedActiveIds(selectedActiveIds.size === filteredActiveRequests.length ? new Set() : new Set(filteredActiveRequests.map(i => i.id)));
  const toggleAllObs = () => setSelectedObsIds(selectedObsIds.size === filteredObservationRequests.length ? new Set() : new Set(filteredObservationRequests.map(i => i.id)));
  const toggleAllCounseling = () => setSelectedCounselingIds(selectedCounselingIds.size === filteredCounselingRequests.length ? new Set() : new Set(filteredCounselingRequests.map(i => i.id)));
  const toggleAllSuRek = () => setSelectedSuRekIds(selectedSuRekIds.size === filteredSuRekRequests.length ? new Set() : new Set(filteredSuRekRequests.map(i => i.id)));

  // ── Edit Observation ────────────────────────────────────────────────────────
  const handleSaveObservationEdit = async (data: Partial<ObservationRequest> & { students: { name: string; nim: string }[] }) => {
    if (!editTarget) return;
    setIsProcessing(true);
    try {
      const res = await tuApi.updateObservation(editTarget.id, data as Record<string, unknown>);
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

  const handleSaveSuRekEdit = async (data: any) => {
    if (!editTarget) return;
    setIsProcessing(true);
    try {
      const res = await tuApi.updateSuRek(editTarget.id, {
        recipientName: data.recipientName,
        berdasarkanNo: data.berdasarkanNo,
        perihal: data.perihal,
        lampiran: data.lampiran,
        carbonCopies: data.carbonCopies
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan perubahan.');
      setEditTarget(null);
      await fetchArchiveData({ showError: false });
      setFeedback({ type: 'success', message: 'Data surat rekomendasi berhasil diperbarui.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menyimpan perubahan.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveCounselingEdit = async (data: any) => {
    if (!editTarget) return;
    setIsProcessing(true);
    try {
      const res = await tuApi.updateCounseling(editTarget.id, {
        subject: data.subject,
        recipientName: data.recipientName,
        referralUnit: data.referralUnit,
        carbonCopies: data.carbonCopies
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan perubahan.');
      setEditTarget(null);
      await fetchArchiveData({ showError: false });
      setFeedback({ type: 'success', message: 'Data surat konseling berhasil diperbarui.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menyimpan perubahan.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const {
    filteredActiveRequests,
    filteredObservationRequests,
    filteredCounselingRequests,
    filteredSuRekRequests
  } = filterArchiveRequests({
    activeRequests,
    observationRequests,
    counselingRequests,
    suRekRequests,
    searchQuery,
    statusFilter,
    formatDate: formatArchiveDate
  });

  const {
    totalArchiveCount,
    pendingCount,
    verifiedCount,
    sentCount
  } = countArchiveStatuses({
    activeRequests,
    observationRequests,
    counselingRequests,
    suRekRequests
  });

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
    const isCounseling = selectedLetter.type === 'counseling';
    const isSuRek = selectedLetter.type === 'su-rek';
    const observationItem = selectedLetter.type === 'observation' ? selectedLetter.item : null;
    const counselingItem = selectedLetter.type === 'counseling' ? selectedLetter.item : null;
    const activeItem = selectedLetter.type === 'active' ? selectedLetter.item : null;
    const suRekItem = selectedLetter.type === 'su-rek' ? selectedLetter.item : null;
    const item = selectedLetter.item;
    const canSendEmail = item.status === 'verified' || item.status === 'sent';
    const validationUrl = getPublicValidationUrl(item.validationToken);
    const actionHint =
      item.status === 'pending'
        ? isObservation
          ? 'Verifikasi surat observasi untuk membuat nomor surat dan mengaktifkan pengiriman email.'
          : isCounseling
            ? 'Verifikasi surat konseling untuk membuat nomor surat dan mengaktifkan pengiriman email.'
            : isSuRek
              ? 'Surat rekomendasi masih menunggu verifikasi dari Panel Admin sebelum dapat dikirim ke email.'
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
                    {isObservation ? 'Surat Observasi' : isCounseling ? 'Surat Konseling' : isSuRek ? 'Rekomendasi Afirmasi' : 'Surat Aktif Kuliah'}
                  </Badge>
                  <ArchiveStatusBadge status={item.status} />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {isObservation ? 'Detail Arsip Surat Observasi' : isCounseling ? 'Detail Arsip Surat Konseling' : isSuRek ? 'Detail Arsip Surat Rekomendasi' : 'Detail Arsip Surat Aktif Kuliah'}
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
                    backgroundImageBase64={letterBackgrounds.document.imageBase64}
                    layout={letterLayouts.observation}
                    showLayoutGuide={false}
                    letterNumber={observationItem?.letterNumber}
                    validationToken={observationItem?.validationToken}
                    validationUrl={validationUrl}
                    letterDate={observationItem?.letterGeneratedAt || observationItem?.createdAt}
                  />
                ) : isCounseling ? (
                  <LetterPreview
                    type="counseling"
                    data={{
                      ...counselingItem,
                      subject: counselingItem?.subject || 'Pengantar Konseling',
                      recipientName: counselingItem?.recipientName || '',
                      referralUnit: counselingItem?.referralUnit || '',
                      studyProgramName: counselingItem?.studyProgramName,
                      studyProgramLevel: counselingItem?.studyProgramLevel,
                      faculty: counselingItem?.faculty || 'FTI',
                      status: counselingItem?.status
                    }}
                    backgroundImageBase64={letterBackgrounds.document.imageBase64}
                    layout={letterLayouts.counseling}
                    showLayoutGuide={false}
                    letterNumber={counselingItem?.letterNumber}
                    validationToken={counselingItem?.validationToken}
                    validationUrl={validationUrl}
                    letterDate={counselingItem?.letterGeneratedAt || counselingItem?.createdAt}
                  />
                ) : isSuRek ? (
                  <LetterPreview
                    type="su-rek"
                    data={{
                      ...suRekItem,
                      recipientName: suRekItem?.recipientName || '',
                      berdasarkanNo: suRekItem?.berdasarkanNo || '',
                      perihal: suRekItem?.perihal || '',
                      lampiran: suRekItem?.lampiran || '',
                      status: suRekItem?.status
                    }}
                    backgroundImageBase64={letterBackgrounds.document.imageBase64}
                    layout={letterLayouts.suRek}
                    showLayoutGuide={false}
                    letterNumber={suRekItem?.letterNumber}
                    validationToken={suRekItem?.validationToken}
                    validationUrl={validationUrl}
                    letterDate={suRekItem?.letterGeneratedAt || suRekItem?.createdAt}
                  />
                ) : (
                  <ActiveStudentLetter
                    data={{
                      ...activeItem!,
                      semesterCode: currentSemesterCode,
                      semesterName: semesterMeta.semesterName,
                      academicYear: semesterMeta.academicYear,
                      backgroundImageBase64: letterBackgrounds.document.imageBase64,
                      layout: letterLayouts.activeStudent,
                      deanName: deanName,
                      validationUrl
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
                {(isObservation || isCounseling) && item.status === 'pending' && (
                  <Button onClick={() => handleVerifyObservation(item.id)} disabled={isProcessing} className="w-full justify-center">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Verifikasi Surat
                  </Button>
                )}
                <Button variant="outline" onClick={handlePrint} disabled={!canSendEmail || isProcessing} className="w-full justify-center dark:border-gray-700 dark:hover:bg-gray-800">
                  <Printer className="mr-2 h-4 w-4" /> Cetak Ulang
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={!canSendEmail || isProcessing} className="w-full justify-center dark:border-gray-700 dark:hover:bg-gray-800">
                  <Download className="mr-2 h-4 w-4" /> {canSendEmail ? 'Download PDF' : 'PDF Belum Tersedia'}
                </Button>
                <Button
                  onClick={() => handleSendEmail(isObservation ? 'observation' : isCounseling ? 'counseling' : isSuRek ? 'su-rek' : 'active-student', item.id)}
                  disabled={!canSendEmail || isProcessing || isSendingEmail}
                  className="w-full justify-center"
                >
                  {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isSendingEmail ? 'Mengirim Email...' : canSendEmail ? 'Kirim ke Email' : 'Email Belum Tersedia'}
                </Button>
                {(isObservation || isCounseling || isSuRek) && (
                  <Button
                    variant="outline"
                    onClick={() => setEditTarget(isSuRek ? { ...suRekItem, type: 'su-rek' } : isCounseling ? { ...counselingItem, type: 'counseling' } : observationItem)}
                    disabled={isProcessing}
                    className="w-full justify-center border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit Data Surat
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => openDeleteSingle(item.id, isObservation ? 'observation' : isCounseling ? 'counseling' : isSuRek ? 'su-rek' : 'active', item.name)}
                  disabled={isProcessing}
                  className="w-full justify-center border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus Arsip Ini
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-gray-700">
                <CardTitle className="flex items-center gap-2 text-base text-slate-800 dark:text-white">
                  <QrCode className="h-4 w-4 text-sky-600" /> Validasi Publik
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  QR pada surat membuka halaman detail validasi tanpa login.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {validationUrl ? (
                  <>
                    <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                      <ValidationQrCode value={validationUrl} size={128} />
                    </div>
                    <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                      {validationUrl}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full justify-center dark:border-gray-700 dark:hover:bg-gray-800"
                      onClick={() => window.open(validationUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" /> Buka Halaman Validasi
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 dark:text-gray-400">
                      Link validasi belum tersedia untuk arsip ini.
                    </p>
                    <Button
                      onClick={handleCreateValidationToken}
                      disabled={isProcessing || item.status === 'pending'}
                      className="w-full justify-center"
                    >
                      <QrCode className="mr-2 h-4 w-4" /> Buat Link Validasi
                    </Button>
                    {item.status === 'pending' && (
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        Surat harus diverifikasi terlebih dahulu sebelum memiliki QR validasi.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>


            <Card className="border-slate-200 dark:border-gray-700 shadow-sm">
              <CardHeader className="border-b border-slate-100 dark:border-gray-700">
                <CardTitle className="text-base text-slate-800 dark:text-white">Ringkasan Data</CardTitle>
                <CardDescription className="dark:text-gray-400">Data pemohon, arsip, dan nomor surat.</CardDescription>
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
                ) : isCounseling ? (
                  <>
                    <DetailRow label="Hal" value={counselingItem?.subject || '-'} />
                    <DetailRow label="Yang Terhormat" value={(counselingItem?.recipientName || '-').replace(/\n/g, ' / ')} />
                    <DetailRow label="Unit Rujukan" value={counselingItem?.referralUnit || '-'} />
                    <DetailRow label="Program Studi" value={counselingItem?.studyProgramName || '-'} />
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
                    terbaru berdasarkan template, background, nama penanggung jawab, dan QR validasi yang aktif.
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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Arsip Surat TU</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            Kelola arsip surat aktif kuliah, observasi, konseling, dan rekomendasi
          </p>
          {lastUpdatedAt && (
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
              Terakhir diperbarui {formatArchiveDate(lastUpdatedAt)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchArchiveData()}
          disabled={isRefreshing || loading}
          className="gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TUMetricCard
          title="Total Arsip"
          value={String(totalArchiveCount)}
          description={`${activeRequests.length} aktif kuliah, ${observationRequests.length} observasi, ${counselingRequests.length} konseling, ${suRekRequests.length} rekomendasi`}
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          accentClassName="bg-blue-50 dark:bg-blue-950/30"
        />
        <TUMetricCard
          title="Menunggu"
          value={String(pendingCount)}
          description="Surat yang belum diproses"
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
          accentClassName="bg-amber-50 dark:bg-amber-950/30"
        />
        <TUMetricCard
          title="Terverifikasi"
          value={String(verifiedCount)}
          description="Surat siap dicetak atau dikirim"
          icon={<CheckCircle className="h-5 w-5 text-sky-500" />}
          accentClassName="bg-sky-50 dark:bg-sky-950/30"
        />
        <TUMetricCard
          title="Terkirim"
          value={String(sentCount)}
          description="Surat sudah dikirim email"
          icon={<Mail className="h-5 w-5 text-emerald-500" />}
          accentClassName="bg-emerald-50 dark:bg-emerald-950/30"
        />
      </div>

      <TUSectionCard>
        <CardHeader className="pb-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={activeListTab === 'active'
                  ? 'Cari nama, NIM, email, prodi, atau nomor surat...'
                  : activeListTab === 'observation'
                    ? 'Cari tujuan, instansi, nama mahasiswa, atau nomor surat...'
                    : activeListTab === 'counseling'
                      ? 'Cari nama, NIM, hal, tujuan, unit rujukan, atau nomor surat...'
                      : 'Cari nama, NIM, perihal, atau nomor surat...'}
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
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeListTab} onValueChange={(value) => setActiveListTab(value as 'active' | 'observation' | 'counseling' | 'su-rek')}>
            <PageTabs
              items={[
                { value: 'active', label: `Aktif Kuliah (${activeRequests.length})`, icon: GraduationCap },
                { value: 'observation', label: `Observasi (${observationRequests.length})`, icon: Building2 },
                { value: 'counseling', label: `Konseling (${counselingRequests.length})`, icon: FileText },
                { value: 'su-rek', label: `Rekomendasi (${suRekRequests.length})`, icon: Award }
              ]}
            />
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
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-3 text-sm text-slate-500 dark:text-gray-400">Memuat arsip surat aktif kuliah...</span>
                </div>
              ) : filteredActiveRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-gray-500">
                    {activeRequests.length === 0 ? 'Belum ada data surat aktif kuliah yang tersimpan.' : 'Tidak ada arsip yang cocok dengan filter saat ini.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
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
                            <TableCell><ArchiveStatusBadge status={item.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedLetter({ type: 'active', item })} className="dark:border-gray-700 dark:hover:bg-gray-800">
                                  <Eye className="mr-2 h-4 w-4" /> Detail
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Hapus arsip ${item.name}`} onClick={() => openDeleteSingle(item.id, 'active', item.name)} disabled={isProcessing} className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
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
                          <ArchiveStatusBadge status={item.status} />
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
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-3 text-sm text-slate-500 dark:text-gray-400">Memuat arsip surat observasi...</span>
                </div>
              ) : filteredObservationRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-gray-500">
                    {observationRequests.length === 0 ? 'Belum ada data surat observasi yang tersimpan.' : 'Tidak ada arsip yang cocok dengan filter saat ini.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
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
                            <TableCell><ArchiveStatusBadge status={item.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedLetter({ type: 'observation', item })} className="dark:border-gray-700 dark:hover:bg-gray-800">
                                  <Eye className="mr-2 h-4 w-4" /> Detail
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Edit arsip observasi ${item.name}`} onClick={() => setEditTarget(item)} className="border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Hapus arsip observasi ${item.name}`} onClick={() => openDeleteSingle(item.id, 'observation', item.name + ' — ' + (item.company || ''))} disabled={isProcessing} className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
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
                          <ArchiveStatusBadge status={item.status} />
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

            <TabsContent value="counseling" className="mt-0">
              {selectedCounselingIds.size > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3">
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">
                    {selectedCounselingIds.size} surat dipilih
                  </span>
                  <Button
                    variant="outline" size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40"
                    onClick={() => openBatchDelete('counseling')}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Hapus Terpilih
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-3 text-sm text-slate-500 dark:text-gray-400">Memuat arsip surat konseling...</span>
                </div>
              ) : filteredCounselingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-gray-500">
                    {counselingRequests.length === 0 ? 'Belum ada data surat konseling yang tersimpan.' : 'Tidak ada arsip yang cocok dengan filter saat ini.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                              checked={selectedCounselingIds.size === filteredCounselingRequests.length && filteredCounselingRequests.length > 0}
                              onChange={toggleAllCounseling} />
                          </TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Mahasiswa</TableHead>
                          <TableHead>Hal</TableHead>
                          <TableHead>Unit Rujukan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCounselingRequests.map((item: CounselingRequest) => (
                          <TableRow key={item.id} className={`hover:bg-slate-50/80 dark:hover:bg-gray-800/50 ${selectedCounselingIds.has(item.id) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                            <TableCell>
                              <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                                checked={selectedCounselingIds.has(item.id)}
                                onChange={() => toggleCounselingId(item.id)} />
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{formatArchiveDate(item.createdAt)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{item.nim}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.subject || '-'}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{item.letterNumber || 'Nomor surat belum dibuat'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300 max-w-[220px] truncate">{item.referralUnit || '-'}</TableCell>
                            <TableCell><ArchiveStatusBadge status={item.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedLetter({ type: 'counseling', item })} className="dark:border-gray-700 dark:hover:bg-gray-800">
                                  <Eye className="mr-2 h-4 w-4" /> Detail
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Edit arsip konseling ${item.name}`} onClick={() => setEditTarget({ ...item, type: 'counseling' })} className="border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Hapus arsip konseling ${item.name}`} onClick={() => openDeleteSingle(item.id, 'counseling', item.name + ' - ' + (item.subject || 'Konseling'))} disabled={isProcessing} className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
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
                    {filteredCounselingRequests.map((item: CounselingRequest) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-slate-500 dark:text-gray-400">{item.nim}</p>
                          </div>
                          <ArchiveStatusBadge status={item.status} />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Hal</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{item.subject || '-'}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Tanggal</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{formatArchiveDate(item.createdAt)}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                            {item.referralUnit || 'Unit rujukan belum diisi'}
                          </div>
                        </div>
                        <Button variant="outline" className="mt-4 w-full justify-center dark:border-gray-700 dark:hover:bg-gray-700" onClick={() => setSelectedLetter({ type: 'counseling', item })}>
                          <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="su-rek" className="mt-0">
              {/* Batch Delete Toolbar */}
              {selectedSuRekIds.size > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3">
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">
                    {selectedSuRekIds.size} surat dipilih
                  </span>
                  <Button
                    variant="outline" size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40"
                    onClick={() => openBatchDelete('su-rek')}
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Hapus Terpilih
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-3 text-sm text-slate-500 dark:text-gray-400">Memuat arsip surat rekomendasi...</span>
                </div>
              ) : filteredSuRekRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-10 w-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-gray-500">
                    {suRekRequests.length === 0 ? 'Belum ada data surat rekomendasi yang tersimpan.' : 'Tidak ada arsip yang cocok dengan filter saat ini.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                              checked={selectedSuRekIds.size === filteredSuRekRequests.length && filteredSuRekRequests.length > 0}
                              onChange={toggleAllSuRek} />
                          </TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Nama Mahasiswa</TableHead>
                          <TableHead>NIM</TableHead>
                          <TableHead>Perihal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSuRekRequests.map((item) => (
                          <TableRow key={item.id} className={`hover:bg-slate-50/80 dark:hover:bg-gray-800/50 ${selectedSuRekIds.has(item.id) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                            <TableCell>
                              <input type="checkbox" className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                                checked={selectedSuRekIds.has(item.id)}
                                onChange={() => toggleSuRekId(item.id)} />
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{formatArchiveDate(item.createdAt)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{item.letterNumber || 'Nomor surat belum dibuat'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300">{item.nim}</TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-gray-300 max-w-[200px] truncate">{item.perihal || '-'}</TableCell>
                            <TableCell><ArchiveStatusBadge status={item.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedLetter({ type: 'su-rek', item })} className="dark:border-gray-700 dark:hover:bg-gray-800">
                                  <Eye className="mr-2 h-4 w-4" /> Detail
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Edit arsip rekomendasi ${item.name}`} onClick={() => setEditTarget({ ...item, type: 'su-rek' })} className="border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" aria-label={`Hapus arsip rekomendasi ${item.name}`} onClick={() => openDeleteSingle(item.id, 'su-rek', item.name + ' — ' + (item.nim || ''))} disabled={isProcessing} className="border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
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
                    {filteredSuRekRequests.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-slate-500 dark:text-gray-400">{item.nim}</p>
                          </div>
                          <ArchiveStatusBadge status={item.status} />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Perihal</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{item.perihal || '-'}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-gray-900/50 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-gray-400">Tanggal</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">{formatArchiveDate(item.createdAt)}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                            {item.perihal || 'Beasiswa Afirmasi Cemerlang'}
                          </div>
                        </div>
                        <Button variant="outline" className="mt-4 w-full justify-center dark:border-gray-700 dark:hover:bg-gray-700" onClick={() => setSelectedLetter({ type: 'su-rek', item })}>
                          <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
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

      {/* ── Edit Observation & Recommendation Modal ─────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
                  <Pencil className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    {editTarget.type === 'su-rek' ? 'Edit Data Rekomendasi' : editTarget.type === 'counseling' ? 'Edit Data Konseling' : 'Edit Data Observasi'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nomor surat tidak akan berubah.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditTarget(null)} className="rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {editTarget.type === 'su-rek' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Yang Terhormat (Penerima)</label>
                    <Textarea 
                      value={editTarget.recipientName || ''} 
                      onChange={e => setEditTarget({...editTarget, recipientName: e.target.value})} 
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Berdasarkan Surat No</label>
                    <Input 
                      value={editTarget.berdasarkanNo || ''} 
                      onChange={e => setEditTarget({...editTarget, berdasarkanNo: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Lampiran</label>
                    <Input 
                      value={editTarget.lampiran || ''} 
                      onChange={e => setEditTarget({...editTarget, lampiran: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Hal / Perihal</label>
                    <Input 
                      value={editTarget.perihal || ''} 
                      onChange={e => setEditTarget({...editTarget, perihal: e.target.value})} 
                    />
                  </div>
                </div>
              ) : editTarget.type === 'counseling' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Hal</label>
                    <Input
                      value={editTarget.subject || ''}
                      onChange={e => setEditTarget({ ...editTarget, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Unit Rujukan</label>
                    <Input
                      value={editTarget.referralUnit || ''}
                      onChange={e => setEditTarget({ ...editTarget, referralUnit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Yang Terhormat</label>
                    <Textarea
                      value={editTarget.recipientName || ''}
                      onChange={e => setEditTarget({ ...editTarget, recipientName: e.target.value })}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Mahasiswa</label>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <Input value={editTarget.name || ''} readOnly className="bg-slate-50 dark:bg-gray-900/50" />
                      <Input value={editTarget.nim || ''} readOnly className="bg-slate-50 dark:bg-gray-900/50" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                      {editTarget.students.map((stu: any, i: number) => (
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
                </>
              )}

              <div className="mt-6 border-t border-slate-100 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Tembusan Surat (Opsional)</label>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    onClick={() => setEditTarget({
                      ...editTarget, 
                      carbonCopies: [...(editTarget.carbonCopies || []), { role: '', name: '' }]
                    })}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Tembusan
                  </Button>
                </div>
                {(!editTarget.carbonCopies || editTarget.carbonCopies.length === 0) ? (
                  <p className="text-xs text-slate-500 italic">Tidak ada tembusan.</p>
                ) : (
                  <div className="space-y-2">
                    {editTarget.carbonCopies.map((cc: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <Input 
                          placeholder="Jabatan (contoh: Dekan FTI UKSW)" 
                          className="flex-1" 
                          value={cc.role || ''} 
                          onChange={e => {
                            const newCc = [...(editTarget.carbonCopies || [])];
                            newCc[i].role = e.target.value;
                            setEditTarget({...editTarget, carbonCopies: newCc});
                          }} 
                        />
                        <Input 
                          placeholder="Nama (contoh: Dr. Ir. X - Opsional)" 
                          className="flex-1" 
                          value={cc.name || ''} 
                          onChange={e => {
                            const newCc = [...(editTarget.carbonCopies || [])];
                            newCc[i].name = e.target.value;
                            setEditTarget({...editTarget, carbonCopies: newCc});
                          }} 
                        />
                        <Button 
                          type="button" variant="outline" size="icon" className="shrink-0 border-red-200 text-red-500 hover:bg-red-50"
                          onClick={() => {
                            const newCc = [...(editTarget.carbonCopies || [])];
                            newCc.splice(i, 1);
                            setEditTarget({...editTarget, carbonCopies: newCc});
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50 flex justify-end gap-3 rounded-b-2xl">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Batal</Button>
              <Button 
                onClick={() => {
                  if (editTarget.type === 'su-rek') {
                    handleSaveSuRekEdit(editTarget);
                  } else if (editTarget.type === 'counseling') {
                    handleSaveCounselingEdit(editTarget);
                  } else {
                    handleSaveObservationEdit(editTarget);
                  }
                }} 
                disabled={isProcessing || (!['su-rek', 'counseling'].includes(editTarget.type) && editTarget.students.length === 0)}
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
