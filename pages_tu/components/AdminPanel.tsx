import {
  ArrowLeft,
  CheckCircle,
  Clock,
  DownloadSimple as Download,
  Eye,
  FileText,
  SpinnerGap as Loader2,
  EnvelopeSimple as Mail,
  PencilSimpleLine as Pencil,
  Plus,
  Printer,
  FloppyDisk as Save,
  GearSix as Settings,
  Trash as Trash2,
  UploadSimple as Upload,
  X
} from '@phosphor-icons/react';
import React, { useEffect, useState, useCallback } from 'react';
import { ActiveStudentRequest, ObservationRequest, SuRekRequest, CounselingRequest, LetterLayout, TULetterBackgrounds, TULetterLayouts } from '../types';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
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
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ActiveStudentLetter } from './ActiveStudentLetter';
import { LetterPreview } from './LetterPreview';
import { EmailActionOverlay } from './EmailActionOverlay';
import { EmailSuccessDialog } from './EmailSuccessDialog';
import {
  createEmptyLetterBackgrounds,
  createEmptyLetterLayouts,
  DEFAULT_COUNSELING_RECIPIENT_NAME,
  DEFAULT_COUNSELING_REFERRAL_UNIT,
  DEFAULT_COUNSELING_SUBJECT,
  DEFAULT_INTERVIEW_ADVISOR_TITLE,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST,
  DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND,
  DEFAULT_INTERVIEW_ASSIGNMENT_TYPE,
  DEFAULT_PERMISSION_ADVISOR_TITLE,
  DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST,
  DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND,
  DEFAULT_PERMISSION_ASSIGNMENT_TYPE,
  DEFAULT_RESEARCH_ADVISOR_TITLE,
  DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST,
  DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND,
  DEFAULT_RESEARCH_ASSIGNMENT_TYPE,
  formatSemesterLabel,
  getDefaultLetterLayout,
  getSemesterMeta,
  LetterLayoutKey,
  letterLayoutSections,
  normalizeLetterBackgrounds,
  normalizeLetterLayouts
} from '../lib/letterSettings';
import { getDummyDataForPreview } from '../lib/letterPreviewData';
import { tuApi, TuApiRequestType } from '../services/tuApi';

interface AdminPanelProps {
  onSettingsSaved?: () => Promise<void> | void;
  mode?: 'requests' | 'settings' | 'all';
}

export function AdminPanel({ onSettingsSaved, mode = 'all' }: AdminPanelProps) {
  const [activeMainTab, setActiveMainTab] = useState<'requests' | 'settings'>('requests');
  const effectiveTab = (mode === 'requests' || mode === 'settings') ? mode : activeMainTab;
  const [activeRequestType, setActiveRequestType] = useState<'activeStudent' | 'observation' | 'counseling' | 'suRek'>('activeStudent');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessState, setEmailSuccessState] = useState<{ email: string; letterNumber?: string | null } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [batchDeleteTargets, setBatchDeleteTargets] = useState<any[]>([]);
  const [confirmPhase, setConfirmPhase] = useState<1 | 2 | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedLayoutConfigKey, setSelectedLayoutConfigKey] = useState<LetterLayoutKey>('activeStudent');

  // State untuk pengaturan default
  const [currentSemesterCode, setCurrentSemesterCode] = useState<string>('');
  const [suRekYangTerhormat, setSuRekYangTerhormat] = useState<string>('');
  const [suRekBerdasarkanNo, setSuRekBerdasarkanNo] = useState<string>('');
  const [suRekPerihal, setSuRekPerihal] = useState<string>('');
  const [suRekLampiran, setSuRekLampiran] = useState<string>('');
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // State untuk perubahan sementara di UI pengaturan
  const [tempSignature, setTempSignature] = useState<string>('');
  const [tempStamp, setTempStamp] = useState<string>('');
  const [tempCurrentSemesterCode, setTempCurrentSemesterCode] = useState<string>('');
  const [tempCounselingSubject, setTempCounselingSubject] = useState<string>(DEFAULT_COUNSELING_SUBJECT);
  const [tempCounselingRecipientName, setTempCounselingRecipientName] = useState<string>(DEFAULT_COUNSELING_RECIPIENT_NAME);
  const [tempCounselingReferralUnit, setTempCounselingReferralUnit] = useState<string>(DEFAULT_COUNSELING_REFERRAL_UNIT);
  const [tempResearchAssignmentType, setTempResearchAssignmentType] = useState<string>(DEFAULT_RESEARCH_ASSIGNMENT_TYPE);
  const [tempResearchAdvisorTitle, setTempResearchAdvisorTitle] = useState<string>(DEFAULT_RESEARCH_ADVISOR_TITLE);
  const [tempResearchAdvisorTitleFirst, setTempResearchAdvisorTitleFirst] = useState<string>(DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST);
  const [tempResearchAdvisorTitleSecond, setTempResearchAdvisorTitleSecond] = useState<string>(DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND);
  const [tempInterviewAssignmentType, setTempInterviewAssignmentType] = useState<string>(DEFAULT_INTERVIEW_ASSIGNMENT_TYPE);
  const [tempInterviewAdvisorTitle, setTempInterviewAdvisorTitle] = useState<string>(DEFAULT_INTERVIEW_ADVISOR_TITLE);
  const [tempInterviewAdvisorTitleFirst, setTempInterviewAdvisorTitleFirst] = useState<string>(DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST);
  const [tempInterviewAdvisorTitleSecond, setTempInterviewAdvisorTitleSecond] = useState<string>(DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND);
  const [tempPermissionAssignmentType, setTempPermissionAssignmentType] = useState<string>(DEFAULT_PERMISSION_ASSIGNMENT_TYPE);
  const [tempPermissionAdvisorTitle, setTempPermissionAdvisorTitle] = useState<string>(DEFAULT_PERMISSION_ADVISOR_TITLE);
  const [tempPermissionAdvisorTitleFirst, setTempPermissionAdvisorTitleFirst] = useState<string>(DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST);
  const [tempPermissionAdvisorTitleSecond, setTempPermissionAdvisorTitleSecond] = useState<string>(DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND);
  const [tempSuRekYangTerhormat, setTempSuRekYangTerhormat] = useState<string>('');
  const [tempSuRekBerdasarkanNo, setTempSuRekBerdasarkanNo] = useState<string>('');
  const [tempSuRekPerihal, setTempSuRekPerihal] = useState<string>('');
  const [tempSuRekLampiran, setTempSuRekLampiran] = useState<string>('');
  const [tempSuRekTembusan, setTempSuRekTembusan] = useState<Array<{role: string; name: string}>>([]);
  const [tempLetterBackgrounds, setTempLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [tempLetterLayouts, setTempLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [panelFeedback, setPanelFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [requestToVerify, setRequestToVerify] = useState<any | null>(null);
  const [deanName, setDeanName] = useState<string>('');
  const [isEnsuringValidationToken, setIsEnsuringValidationToken] = useState(false);
  const [validationTokenAttemptedId, setValidationTokenAttemptedId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await tuApi.getRequestsByAdminType(activeRequestType);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data);
      }
    } catch (error) {
      console.error(`Failed to fetch requests for type ${activeRequestType}:`, error);
    } finally {
      setLoading(false);
    }
  }, [activeRequestType]);

  const fetchTuSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const res = await tuApi.getSettings();
      const json = await res.json();
      if (res.ok) {
        setCurrentSemesterCode(json.currentSemesterCode || '');
        setSuRekYangTerhormat(json.suRekYangTerhormat || '');
        setSuRekBerdasarkanNo(json.suRekBerdasarkanNo || '');
        setSuRekPerihal(json.suRekPerihal || '');
        setSuRekLampiran(json.suRekLampiran || '');

        const normalizedBackgrounds = normalizeLetterBackgrounds(json.letterBackgrounds);
        setLetterBackgrounds(normalizedBackgrounds);
        const normalizedLayouts = normalizeLetterLayouts(json.letterLayouts);
        setLetterLayouts(normalizedLayouts);

        setTempSignature(json.signatureBase64);
        setTempStamp(json.stampBase64);
        setTempCurrentSemesterCode(json.currentSemesterCode || '');
        setTempCounselingSubject(json.counselingSubject || DEFAULT_COUNSELING_SUBJECT);
        setTempCounselingRecipientName(json.counselingRecipientName || DEFAULT_COUNSELING_RECIPIENT_NAME);
        setTempCounselingReferralUnit(json.counselingReferralUnit || DEFAULT_COUNSELING_REFERRAL_UNIT);
        setTempResearchAssignmentType(json.researchAssignmentType || DEFAULT_RESEARCH_ASSIGNMENT_TYPE);
        setTempResearchAdvisorTitle(json.researchAdvisorTitle || DEFAULT_RESEARCH_ADVISOR_TITLE);
        setTempResearchAdvisorTitleFirst(json.researchAdvisorTitleFirst || DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST);
        setTempResearchAdvisorTitleSecond(json.researchAdvisorTitleSecond || DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND);
        setTempInterviewAssignmentType(json.interviewAssignmentType || DEFAULT_INTERVIEW_ASSIGNMENT_TYPE);
        setTempInterviewAdvisorTitle(json.interviewAdvisorTitle || DEFAULT_INTERVIEW_ADVISOR_TITLE);
        setTempInterviewAdvisorTitleFirst(json.interviewAdvisorTitleFirst || DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST);
        setTempInterviewAdvisorTitleSecond(json.interviewAdvisorTitleSecond || DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND);
        setTempPermissionAssignmentType(json.permissionAssignmentType || DEFAULT_PERMISSION_ASSIGNMENT_TYPE);
        setTempPermissionAdvisorTitle(json.permissionAdvisorTitle || DEFAULT_PERMISSION_ADVISOR_TITLE);
        setTempPermissionAdvisorTitleFirst(json.permissionAdvisorTitleFirst || DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST);
        setTempPermissionAdvisorTitleSecond(json.permissionAdvisorTitleSecond || DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND);
        setTempSuRekYangTerhormat(json.suRekYangTerhormat || '');
        setTempSuRekBerdasarkanNo(json.suRekBerdasarkanNo || '');
        setTempSuRekPerihal(json.suRekPerihal || '');
        setTempSuRekLampiran(json.suRekLampiran || '');
        setTempSuRekTembusan(Array.isArray(json.suRekTembusan) ? json.suRekTembusan : []);

        setTempLetterBackgrounds(normalizedBackgrounds);
        setTempLetterLayouts(normalizedLayouts);
        return json;
      }
    } catch (error) {
      console.error('Failed to fetch TU settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }

    return null;
  };

  const fetchDeanName = async () => {
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
    } catch (error) {
      console.error('Failed to fetch dean name:', error);
    }
  };

  const getRequestTypeSlug = (type = activeRequestType): TuApiRequestType => {
    if (type === 'activeStudent') return 'active-student';
    if (type === 'observation') return 'observation';
    if (type === 'counseling') return 'counseling';
    return 'su-rek';
  };

  const getRequestTypeTitle = (type = activeRequestType) => {
    if (type === 'activeStudent') return 'Surat Aktif Kuliah';
    if (type === 'observation') return 'Surat Observasi';
    if (type === 'counseling') return 'Surat Konseling';
    return 'Surat Rekomendasi';
  };

  useEffect(() => {
    fetchTuSettings();
    fetchDeanName();
  }, []);

  useEffect(() => {
    setRequests([]);
    setLoading(true);
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000); // Poll for new requests
    return () => clearInterval(interval);
  }, [activeRequestType, fetchRequests]);

  useEffect(() => {
    if (!selectedRequest) return;
    const latestRequest = requests.find((request) => request.id === selectedRequest.id);
    if (!latestRequest) return;

    const nextValidationToken = latestRequest.validationToken || selectedRequest.validationToken;
    const needsSync =
      latestRequest.status !== selectedRequest.status ||
      latestRequest.letterNumber !== selectedRequest.letterNumber ||
      nextValidationToken !== selectedRequest.validationToken;

    if (needsSync) {
      setSelectedRequest((prev: any | null) => prev && prev.id === latestRequest.id
        ? { ...prev, ...latestRequest, validationToken: nextValidationToken }
        : prev
      );
    }
  }, [requests, selectedRequest?.id, selectedRequest?.status, selectedRequest?.letterNumber, selectedRequest?.validationToken]);

  useEffect(() => {
    if (
      !selectedRequest ||
      !['verified', 'sent'].includes(selectedRequest.status) ||
      selectedRequest.validationToken ||
      isEnsuringValidationToken ||
      validationTokenAttemptedId === selectedRequest.id
    ) {
      return;
    }

    let isCancelled = false;
    const ensureValidationToken = async () => {
      setIsEnsuringValidationToken(true);
      setValidationTokenAttemptedId(selectedRequest.id);

      try {
        const typeSlug = getRequestTypeSlug();
      const res = await tuApi.ensureValidationToken(typeSlug, selectedRequest.id);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.validationToken || isCancelled) return;

        setSelectedRequest((prev: any | null) => prev && prev.id === selectedRequest.id
          ? { ...prev, validationToken: json.validationToken, letterNumber: json.letterNumber || prev.letterNumber }
          : prev
        );
        setRequests((prev: any[]) => prev.map((request) => request.id === selectedRequest.id
          ? { ...request, validationToken: json.validationToken, letterNumber: json.letterNumber || request.letterNumber }
          : request
        ));
      } catch (error) {
        console.error('Failed to ensure validation token:', error);
      } finally {
        if (!isCancelled) {
          setIsEnsuringValidationToken(false);
        }
      }
    };

    ensureValidationToken();

    return () => {
      isCancelled = true;
    };
  }, [selectedRequest?.id, selectedRequest?.status, selectedRequest?.validationToken, isEnsuringValidationToken, validationTokenAttemptedId, activeRequestType]);

  const handleLetterBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const nextAsset = {
        imageBase64: reader.result as string,
        fileName: file.name,
        mimeType: file.type || 'image/png'
      };
      setTempLetterBackgrounds((prev) => ({
        ...prev,
        document: nextAsset,
        activeStudent: nextAsset,
        observation: nextAsset,
        counseling: nextAsset,
        research: nextAsset,
        suRek: nextAsset
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleLetterLayoutChange = (
    letterKey: LetterLayoutKey,
    field: keyof LetterLayout,
    value: string
  ) => {
    const sanitized = value === '' ? '' : value.replace(',', '.');
    setTempLetterLayouts((prev: TULetterLayouts) => ({
      ...prev,
      [letterKey]: {
        ...getDefaultLetterLayout(letterKey),
        ...(prev[letterKey] || {}),
        [field]: sanitized === '' ? 0 : Number(sanitized)
      }
    }));
  };

  const handleVerify = async (reqId: string) => {
    setIsProcessing(true);
    setPanelFeedback(null);
    try {
      let bodyData: Record<string, unknown> | undefined = undefined;
      if (activeRequestType === 'suRek' && selectedRequest) {
        bodyData = {
          recipientName: selectedRequest.recipientName,
          berdasarkanNo: selectedRequest.berdasarkanNo,
          perihal: selectedRequest.perihal,
          lampiran: selectedRequest.lampiran,
          carbonCopies: selectedRequest.carbonCopies
        };
      } else if (activeRequestType === 'counseling' && selectedRequest) {
        bodyData = {
          subject: selectedRequest.subject,
          recipientName: selectedRequest.recipientName,
          referralUnit: selectedRequest.referralUnit,
          carbonCopies: selectedRequest.carbonCopies
        };
      }

      const res = await tuApi.verifyAdminRequest(activeRequestType, reqId, bodyData);
      const json = await res.json().catch(() => null);
      if (res.ok) {
        const nextLetterNumber = json?.letterNumber || selectedRequest?.letterNumber || '';
        const nextValidationToken = json?.validationToken || selectedRequest?.validationToken || '';
        setRequests((prev: any[]) => prev.map((request) => request.id === reqId
          ? {
              ...request,
              status: 'verified',
              letterNumber: nextLetterNumber || request.letterNumber,
              validationToken: nextValidationToken || request.validationToken
            }
          : request
        ));
        if (selectedRequest?.id === reqId) {
          setSelectedRequest((prev: any | null) => prev ? {
            ...prev,
            status: 'verified',
            letterNumber: nextLetterNumber || prev.letterNumber,
            validationToken: nextValidationToken || prev.validationToken
          } : null);
        }
        await fetchRequests();
        setPanelFeedback({ type: 'success', message: 'Berkas berhasil diverifikasi dan siap dicetak atau dikirim.' });
      } else {
        setPanelFeedback({ type: 'error', message: json?.error || 'Verifikasi berkas gagal dilakukan.' });
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      setPanelFeedback({ type: 'error', message: 'Verifikasi berkas gagal dilakukan.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const res = await tuApi.saveSettings({
        signatureBase64: tempSignature,
        stampBase64: tempStamp,
        currentSemesterCode: tempCurrentSemesterCode,
        counselingSubject: tempCounselingSubject,
        counselingRecipientName: tempCounselingRecipientName,
        counselingReferralUnit: tempCounselingReferralUnit,
        researchAssignmentType: tempResearchAssignmentType,
        researchAdvisorTitle: tempResearchAdvisorTitle,
        researchAdvisorTitleFirst: tempResearchAdvisorTitleFirst,
        researchAdvisorTitleSecond: tempResearchAdvisorTitleSecond,
        interviewAssignmentType: tempInterviewAssignmentType,
        interviewAdvisorTitle: tempInterviewAdvisorTitle,
        interviewAdvisorTitleFirst: tempInterviewAdvisorTitleFirst,
        interviewAdvisorTitleSecond: tempInterviewAdvisorTitleSecond,
        permissionAssignmentType: tempPermissionAssignmentType,
        permissionAdvisorTitle: tempPermissionAdvisorTitle,
        permissionAdvisorTitleFirst: tempPermissionAdvisorTitleFirst,
        permissionAdvisorTitleSecond: tempPermissionAdvisorTitleSecond,
        suRekYangTerhormat: tempSuRekYangTerhormat,
        suRekBerdasarkanNo: tempSuRekBerdasarkanNo,
        suRekPerihal: tempSuRekPerihal,
        suRekLampiran: tempSuRekLampiran,
        suRekTembusan: tempSuRekTembusan,
        letterBackgrounds: tempLetterBackgrounds,
        letterLayouts: tempLetterLayouts
      });
      if (res.ok) {
        await fetchTuSettings(); // Re-fetch to confirm
        await onSettingsSaved?.();
        setSettingsFeedback({ type: 'success', message: 'Pengaturan TU berhasil disimpan.' });
      } else {
        const json = await res.json().catch(() => null);
        setSettingsFeedback({ type: 'error', message: json?.error || 'Gagal menyimpan pengaturan TU.' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsFeedback({ type: 'error', message: 'Gagal menyimpan pengaturan TU.' });
    } finally {
      setIsSavingSettings(false);
    }
  }

  const handleSendEmail = async (reqId: string) => {
    setIsSendingEmail(true);
    setPanelFeedback(null);
    try {
      const typeSlug = getRequestTypeSlug();
      const res = await tuApi.sendLetterEmail(typeSlug, reqId);
      const json = await res.json().catch(() => null);
      if (res.ok) {
        await fetchRequests();
        if (selectedRequest?.id === reqId) {
          setSelectedRequest((prev: any | null) => prev ? { ...prev, status: 'sent' } : null);
        }
        const requestEmail =
          selectedRequest?.id === reqId
            ? selectedRequest.email
            : requests.find((request) => request.id === reqId)?.email || '';
        setPanelFeedback({ type: 'success', message: 'Surat berhasil dikirim. Jika belum masuk ke inbox, cek juga folder spam.' });
        setEmailSuccessState({
          email: requestEmail,
          letterNumber: json?.letterNumber || selectedRequest?.letterNumber || null
        });
      } else {
        setPanelFeedback({ type: 'error', message: json?.error || 'Gagal mengirim surat ke email mahasiswa.' });
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      setPanelFeedback({ type: 'error', message: 'Gagal mengirim surat ke email mahasiswa.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    setPanelFeedback(null);
    try {
      const typeSlug = getRequestTypeSlug();
      const res = await tuApi.downloadLetter(typeSlug, selectedRequest.id);
      if (!res.ok) throw new Error('Gagal mendownload PDF');

      const blob = await res.blob();
      const safeLetterNumber = selectedRequest.letterNumber ? selectedRequest.letterNumber.replace(/\//g, '_') : 'Draft';
      const filename = `${safeLetterNumber}_${selectedRequest.nim}.pdf`;

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
      setPanelFeedback({ type: 'error', message: 'Gagal mendownload file PDF surat.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    const safeLetterNumber = selectedRequest?.letterNumber ? selectedRequest.letterNumber.replace(/\//g, '_') : 'Draft';
    const printTitle = `${safeLetterNumber}_${selectedRequest?.nim}`;

    const printArea = document.getElementById('print-area-admin');
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

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const handleDeleteSingle = (req: ActiveStudentRequest) => {
    setDeleteTarget(req);
    setBatchDeleteTargets([]);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const handleBatchDeleteOpen = () => {
    setBatchDeleteTargets(requests.filter(r => selectedIds.has(r.id)));
    setDeleteTarget(null);
    setConfirmPhase(1);
    setConfirmText('');
  };

  const closeConfirm = () => {
    setConfirmPhase(null);
    setConfirmText('');
    setDeleteTarget(null);
    setBatchDeleteTargets([]);
  };

  const executeDelete = async () => {
    if (confirmText !== 'HAPUS') return;
    setIsProcessing(true);
    closeConfirm();
    try {
      const typeSlug = getRequestTypeSlug();
      if (deleteTarget) {
        const res = await tuApi.deleteLetter(typeSlug, deleteTarget.id);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal menghapus.');
        setPanelFeedback({ type: 'success', message: `Pengajuan ${deleteTarget.name} berhasil dihapus.` });
      } else {
        const ids = batchDeleteTargets.map(r => r.id);
        const res = await tuApi.batchDeleteLetters(typeSlug, ids);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal batch delete.');
        setSelectedIds(new Set());
        setPanelFeedback({ type: 'success', message: `${batchDeleteTargets.length} pengajuan berhasil dihapus.` });
      }
      await fetchRequests();
    } catch (err) {
      setPanelFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Gagal menghapus data.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === requests.length ? new Set() : new Set(requests.map(r => r.id)));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25"><Clock className="w-3 h-3 mr-1" /> Menunggu</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/25"><CheckCircle className="w-3 h-3 mr-1" /> Terverifikasi</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25"><Mail className="w-3 h-3 mr-1" /> Terkirim</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  const emailUx = (
    <>
      <EmailActionOverlay
        open={isSendingEmail}
        title={`Mengirim ${getRequestTypeTitle().toLowerCase()}...`}
        description="Dokumen final sedang diproses lalu dikirimkan ke email mahasiswa."
      />
      <EmailSuccessDialog
        open={Boolean(emailSuccessState)}
        onClose={() => setEmailSuccessState(null)}
        recipientEmail={emailSuccessState?.email}
        letterNumber={emailSuccessState?.letterNumber}
        title={`${getRequestTypeTitle()} berhasil dikirim`}
      />
    </>
  );

  if (selectedRequest) {
    const semesterMeta = getSemesterMeta(currentSemesterCode);
    const selectedValidationUrl = selectedRequest.validationToken
      ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tu/validasi-surat/${selectedRequest.validationToken}`
      : '';
    const showPendingContentEditor =
      (activeRequestType === 'suRek' || activeRequestType === 'counseling') &&
      selectedRequest.status === 'pending';

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {panelFeedback && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            panelFeedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
          }`}>
            {panelFeedback.message}
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 mb-6 print:hidden gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Proses Permohonan</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">{selectedRequest.name} ({selectedRequest.nim})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(selectedRequest.status)}
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            {selectedRequest.status === 'pending' && (
              <Button 
                onClick={() => setRequestToVerify(selectedRequest)}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Verifikasi Berkas
              </Button>
            )}
            {(selectedRequest.status === 'verified' || selectedRequest.status === 'sent') && (
              <>
                <Button variant="outline" onClick={handlePrint} className="border-slate-300 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700">
                  <Printer className="w-4 h-4 mr-2" /> Cetak Surat
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={isProcessing} className="border-slate-300 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700">
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </Button>
                <Button 
                  onClick={() => handleSendEmail(selectedRequest.id)}
                  disabled={isProcessing || isSendingEmail}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSendingEmail
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengirim...</>
                    : <><Mail className="w-4 h-4 mr-2" />Kirim ke Email User</>
                  }
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`grid grid-cols-1 ${showPendingContentEditor ? 'lg:grid-cols-12' : ''} gap-6`}>
          {showPendingContentEditor && (
            <div className="lg:col-span-4 space-y-4 print:hidden">
              <Card className="shadow-sm border-slate-200 dark:border-gray-700">
                <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700 py-4">
                  <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                    <Settings className="w-4 h-4 text-slate-600" />
                    Kustomisasi Konten Surat
                  </CardTitle>
                  <CardDescription className="text-xs dark:text-gray-400">
                    Sesuaikan parameter surat sebelum diverifikasi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {activeRequestType === 'suRek' ? (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="detail-recipientName" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Yang Terhormat (Penerima)
                        </Label>
                        <Textarea
                          id="detail-recipientName"
                          value={selectedRequest.recipientName || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, recipientName: e.target.value })}
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="detail-berdasarkanNo" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Berdasarkan Surat No
                        </Label>
                        <Input
                          id="detail-berdasarkanNo"
                          value={selectedRequest.berdasarkanNo || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, berdasarkanNo: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="detail-lampiran" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Lampiran
                        </Label>
                        <Input
                          id="detail-lampiran"
                          value={selectedRequest.lampiran || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, lampiran: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="detail-perihal" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Hal / Perihal
                        </Label>
                        <Input
                          id="detail-perihal"
                          value={selectedRequest.perihal || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, perihal: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="detail-subject" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Hal
                        </Label>
                        <Input
                          id="detail-subject"
                          value={selectedRequest.subject || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, subject: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="detail-recipientName" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Yang Terhormat
                        </Label>
                        <Textarea
                          id="detail-recipientName"
                          value={selectedRequest.recipientName || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, recipientName: e.target.value })}
                          className="min-h-[96px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="detail-referralUnit" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Unit Rujukan
                        </Label>
                        <Input
                          id="detail-referralUnit"
                          value={selectedRequest.referralUnit || ''}
                          onChange={(e) => setSelectedRequest({ ...selectedRequest, referralUnit: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="border-t border-slate-100 dark:border-gray-700 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Tembusan (Opsional)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="text-xs py-1 px-2 h-7"
                        onClick={() => setSelectedRequest({
                          ...selectedRequest,
                          carbonCopies: [...(selectedRequest.carbonCopies || []), { role: '', name: '' }]
                        })}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                      </Button>
                    </div>

                    {(!selectedRequest.carbonCopies || selectedRequest.carbonCopies.length === 0) ? (
                      <p className="text-xs text-slate-500 italic">Tidak ada tembusan.</p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {selectedRequest.carbonCopies.map((cc: any, i: number) => (
                          <div key={i} className="flex gap-1.5 items-center">
                            <Input
                              placeholder="Jabatan"
                              className="text-xs h-8 py-1 px-2 flex-1"
                              value={cc.role || ''}
                              onChange={(e) => {
                                const newCc = [...selectedRequest.carbonCopies];
                                newCc[i] = { ...newCc[i], role: e.target.value };
                                setSelectedRequest({ ...selectedRequest, carbonCopies: newCc });
                              }}
                            />
                            <Input
                              placeholder="Nama (Opsional)"
                              className="text-xs h-8 py-1 px-2 flex-1"
                              value={cc.name || ''}
                              onChange={(e) => {
                                const newCc = [...selectedRequest.carbonCopies];
                                newCc[i] = { ...newCc[i], name: e.target.value };
                                setSelectedRequest({ ...selectedRequest, carbonCopies: newCc });
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0 w-8 h-8 border-red-200 text-red-500 hover:bg-red-50"
                              onClick={() => {
                                const newCc = [...selectedRequest.carbonCopies];
                                newCc.splice(i, 1);
                                setSelectedRequest({ ...selectedRequest, carbonCopies: newCc });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className={`${showPendingContentEditor ? 'lg:col-span-8' : 'lg:col-span-12'} print:block print:w-full print:m-0 print:p-0`}>
            <Card className="shadow-sm border-slate-200 dark:border-gray-700 print:border-0 print:shadow-none h-full">
              <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700 py-4 print:hidden">
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                  <Printer className="w-5 h-5 text-slate-600" /> Preview Surat
                </CardTitle>
                {selectedRequest.status === 'pending' && (
                  <CardDescription className="text-xs dark:text-gray-400">Ini adalah preview surat sebelum nomor dan QR validasi resmi dibuat.</CardDescription>
                )}
                {selectedRequest.status !== 'pending' && !selectedRequest.validationToken && (
                  <CardDescription className="text-xs dark:text-gray-400">
                    {isEnsuringValidationToken ? 'QR validasi sedang dibuat...' : 'QR validasi belum tersedia untuk surat ini.'}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent id="print-area-admin" className="p-6 bg-slate-200/50 print:bg-white print:p-0 flex justify-center overflow-auto print:overflow-visible min-h-200">
                {activeRequestType === 'activeStudent' ? (
                  <ActiveStudentLetter data={{
                    ...selectedRequest, 
                    semesterCode: currentSemesterCode,
                    semesterName: semesterMeta.semesterName,
                    academicYear: semesterMeta.academicYear,
                    backgroundImageBase64: letterBackgrounds.document.imageBase64,
                    layout: letterLayouts.activeStudent,
                    deanName: deanName,
                    validationUrl: selectedValidationUrl
                  }} />
                ) : activeRequestType === 'observation' ? (
                  <LetterPreview
                    type="observation"
                    data={{
                      recipientName: selectedRequest.recipientName || '',
                      companyName: selectedRequest.company || selectedRequest.companyName || '',
                      companyAddress: selectedRequest.companyAddress || '',
                      courseName: selectedRequest.courseName || '',
                      lecturerName: selectedRequest.lecturerName || '',
                      headOfProgramName: selectedRequest.headOfProgramName || '',
                      studyProgramName: selectedRequest.studyProgramName,
                      studyProgramLevel: selectedRequest.studyProgramLevel,
                      students: selectedRequest.students || []
                    }}
                    backgroundImageBase64={letterBackgrounds.document.imageBase64}
                    layout={letterLayouts.observation}
                    showLayoutGuide={false}
                    letterNumber={selectedRequest.letterNumber}
                    validationToken={selectedRequest.validationToken}
                    validationUrl={selectedValidationUrl}
                    letterDate={selectedRequest.letterGeneratedAt || selectedRequest.createdAt}
                  />
                ) : activeRequestType === 'counseling' ? (
                  <LetterPreview
                    type="counseling"
                    data={{
                      ...selectedRequest,
                      subject: selectedRequest.subject || 'Pengantar Konseling',
                      recipientName: selectedRequest.recipientName || '',
                      referralUnit: selectedRequest.referralUnit || '',
                      studyProgramName: selectedRequest.studyProgramName,
                      studyProgramLevel: selectedRequest.studyProgramLevel,
                      faculty: selectedRequest.faculty || 'FTI',
                      status: selectedRequest.status
                    }}
                    backgroundImageBase64={letterBackgrounds.document.imageBase64}
                    layout={letterLayouts.counseling}
                    showLayoutGuide={false}
                    letterNumber={selectedRequest.letterNumber}
                    validationToken={selectedRequest.validationToken}
                    validationUrl={selectedValidationUrl}
                    letterDate={selectedRequest.letterGeneratedAt || selectedRequest.createdAt}
                  />
                ) : (
                  <LetterPreview
                    type="su-rek"
                    data={{
                      ...selectedRequest,
                      recipientName: selectedRequest.recipientName || '',
                      berdasarkanNo: selectedRequest.berdasarkanNo || '',
                      perihal: selectedRequest.perihal || '',
                      lampiran: selectedRequest.lampiran || '',
                      status: selectedRequest.status
                    }}
                    backgroundImageBase64={letterBackgrounds.document.imageBase64}
                    layout={letterLayouts.suRek}
                    showLayoutGuide={false}
                    letterNumber={selectedRequest.letterNumber}
                    validationToken={selectedRequest.validationToken}
                    validationUrl={selectedValidationUrl}
                    letterDate={selectedRequest.letterGeneratedAt || selectedRequest.createdAt}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={Boolean(requestToVerify)} onOpenChange={(open) => {
          if (!open) setRequestToVerify(null);
        }}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Verifikasi berkas sekarang?</AlertDialogTitle>
              <AlertDialogDescription>
                Surat akan mendapat nomor resmi dan QR validasi publik. Nama pejabat tetap ditampilkan tanpa upload tanda tangan atau cap manual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (requestToVerify) {
                    handleVerify(requestToVerify.id);
                  }
                  setRequestToVerify(null);
                }}
              >
                Verifikasi Berkas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {emailUx}
      </div>
    );
  }

  const selectedLayoutConfig = tempLetterLayouts[selectedLayoutConfigKey] || getDefaultLetterLayout(selectedLayoutConfigKey);
  const selectedPreviewData = getDummyDataForPreview(selectedLayoutConfigKey, {
    previewBaseUrl: import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin,
    counselingSubject: tempCounselingSubject,
    counselingRecipientName: tempCounselingRecipientName,
    counselingReferralUnit: tempCounselingReferralUnit,
    researchAssignmentType: tempResearchAssignmentType,
    researchAdvisorTitleFirst: tempResearchAdvisorTitleFirst,
    researchAdvisorTitleSecond: tempResearchAdvisorTitleSecond,
    interviewAssignmentType: tempInterviewAssignmentType,
    interviewAdvisorTitleFirst: tempInterviewAdvisorTitleFirst,
    interviewAdvisorTitleSecond: tempInterviewAdvisorTitleSecond,
    permissionAssignmentType: tempPermissionAssignmentType,
    permissionAdvisorTitleFirst: tempPermissionAdvisorTitleFirst,
    permissionAdvisorTitleSecond: tempPermissionAdvisorTitleSecond,
    suRekYangTerhormat: tempSuRekYangTerhormat,
    suRekBerdasarkanNo: tempSuRekBerdasarkanNo,
    suRekPerihal: tempSuRekPerihal,
    suRekLampiran: tempSuRekLampiran,
    suRekTembusan: tempSuRekTembusan
  });
  const selectedPreviewType: 'active-student' | 'observation' | 'counseling' | 'research' | 'interview' | 'permission' | 'su-rek' =
    selectedLayoutConfigKey === 'activeStudent'
      ? 'active-student'
      : selectedLayoutConfigKey === 'suRek'
        ? 'su-rek'
        : selectedLayoutConfigKey;

  return (
    <div className="flex flex-col gap-6 print:hidden">
      {/* Tab Switcher if mode === 'all' */}
      {mode === 'all' && (
        <div className="flex border-b border-slate-200 dark:border-gray-700 mb-2">
          <button
            type="button"
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition-colors ${
              activeMainTab === 'requests'
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
            onClick={() => setActiveMainTab('requests')}
          >
            Kelola Permohonan
          </button>
          <button
            type="button"
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition-colors ${
              activeMainTab === 'settings'
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
            onClick={() => setActiveMainTab('settings')}
          >
            Pengaturan Layanan
          </button>
        </div>
      )}

      {/* Render Settings View */}
      {effectiveTab === 'settings' && (
        <div className="flex flex-col gap-6">
          {settingsFeedback && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${
              settingsFeedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
            }`}>
              {settingsFeedback.message}
            </div>
          )}

          {/* Dedicated Header for Settings (with Simpan Pengaturan button) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 print:hidden gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Konfigurasi Surat</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">Atur parameter global surat dan background template</p>
            </div>
            <Button 
              onClick={handleSaveSettings} 
              disabled={isSavingSettings || isLoadingSettings}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isSavingSettings ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Simpan Pengaturan
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {isLoadingSettings ? (
              <div className="xl:col-span-3 flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-slate-500 dark:text-gray-400">Memuat konfigurasi...</p>
              </div>
            ) : (<>
            <Card className="shadow-sm border-slate-200 dark:border-gray-700 xl:col-span-1">
              <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <CardTitle className="text-xl text-slate-800 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Semester Berjalan
                </CardTitle>
                <CardDescription className="dark:text-gray-400">Tentukan semester aktif yang dipakai saat verifikasi KST mahasiswa.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
                  Pengaturan ini akan menjadi default untuk pengecekan KST dan penentuan status mahasiswa aktif.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentSemesterCode" className="text-sm font-medium text-slate-600 dark:text-slate-300">Semester Berjalan</Label>
                  <Input
                    id="currentSemesterCode"
                    value={tempCurrentSemesterCode}
                    onChange={(e) => setTempCurrentSemesterCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="Contoh: 20252"
                    className="bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Format `YYYYS` (S=1=Ganjil, 2=Genap, 3=Antara).<br/>Contoh:<br/>`20251` = Ganjil 2025/2026<br/>`20252` = Genap 2025/2026<br/>`20253` = Antara 2025/2026
                  </p>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Aktif: {formatSemesterLabel(tempCurrentSemesterCode)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 dark:border-gray-700 xl:col-span-2">
              <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <CardTitle className="text-xl text-slate-800 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Background Surat
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Upload satu PNG ukuran A4 sebagai background bersama untuk semua format surat TU.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Background Utama</p>
                    <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-slate-100 p-2 dark:bg-gray-900/50">
                      {tempLetterBackgrounds.document.imageBase64 ? (
                        <img
                          src={tempLetterBackgrounds.document.imageBase64}
                          alt="Background surat utama"
                          className="max-h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Belum diupload</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {tempLetterBackgrounds.document.fileName || 'Pilih file PNG ukuran A4'}
                    </p>
                    <label className="cursor-pointer w-full text-center bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 border border-slate-300 dark:border-gray-600 px-4 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4" /> Upload Background
                      <input
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={handleLetterBackgroundChange}
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
                    Background ini menjadi sumber tunggal untuk surat aktif kuliah, surat observasi, dan format surat TU berikutnya.
                    Saat format surat bertambah, admin cukup menyesuaikan template dan margin area tulisan tanpa mengupload ulang background yang sama.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 dark:border-gray-700 xl:col-span-3">
              <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <CardTitle className="text-xl text-slate-800 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Pengaturan & Pratinjau Margin Surat
                </CardTitle>
                <CardDescription className="dark:text-gray-400">
                  Atur batas area tulisan, konten default surat, dan tembusan sambil melihat preview surat.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Pilih jenis surat</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pilih jenis surat di bawah untuk menyesuaikan batas margin tulisan secara langsung dengan preview visual.</p>
                  </div>

                  {/* Tab/Selector Panel */}
                  <div className="flex flex-wrap gap-2 mb-6 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl max-w-max border border-slate-200 dark:border-slate-700">
                    {letterLayoutSections.map((section) => {
                      const isSelected = selectedLayoutConfigKey === section.key;
                      return (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => setSelectedLayoutConfigKey(section.key)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            isSelected
                              ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          {section.title}
                        </button>
                      );
                    })}
                  </div>

                  {/* Side-by-Side Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Margin Controls */}
                    <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/40 space-y-5">
                      <div>
                        <h4 className="text-base font-semibold text-slate-800 dark:text-white">
                          {letterLayoutSections.find(s => s.key === selectedLayoutConfigKey)?.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {letterLayoutSections.find(s => s.key === selectedLayoutConfigKey)?.description}
                        </p>
                      </div>

                      {selectedLayoutConfigKey === 'suRek' && (
                        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Konten Surat Rekomendasi</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Nilai default ini dipakai pada pengajuan rekomendasi baru dan langsung terlihat di preview.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="suRekYangTerhormat" className="text-xs text-slate-500 dark:text-slate-400">
                              Yang Terhormat (Penerima)
                            </Label>
                            <Textarea
                              id="suRekYangTerhormat"
                              value={tempSuRekYangTerhormat}
                              onChange={(e) => setTempSuRekYangTerhormat(e.target.value)}
                              placeholder="Contoh: Wakil Rektor Bidang Kerjasama dan Kealumnian..."
                              className="min-h-24 bg-white text-sm dark:bg-gray-800"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="suRekBerdasarkanNo" className="text-xs text-slate-500 dark:text-slate-400">
                              Berdasarkan Surat No
                            </Label>
                            <Input
                              id="suRekBerdasarkanNo"
                              value={tempSuRekBerdasarkanNo}
                              onChange={(e) => setTempSuRekBerdasarkanNo(e.target.value)}
                              placeholder="Contoh: 008/WR-KK/02/2025"
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="suRekLampiran" className="text-xs text-slate-500 dark:text-slate-400">
                                Lampiran
                              </Label>
                              <Input
                                id="suRekLampiran"
                                value={tempSuRekLampiran}
                                onChange={(e) => setTempSuRekLampiran(e.target.value)}
                                placeholder="Contoh: 1 bendel atau -"
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="suRekPerihal" className="text-xs text-slate-500 dark:text-slate-400">
                                Hal / Perihal
                              </Label>
                              <Input
                                id="suRekPerihal"
                                value={tempSuRekPerihal}
                                onChange={(e) => setTempSuRekPerihal(e.target.value)}
                                placeholder="Contoh: Beasiswa Afirmasi Cemerlang..."
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedLayoutConfigKey === 'counseling' && (
                        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Konten Surat Konseling</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Nilai default ini dipakai saat surat konseling dibuat dari tab Surat.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="counselingSubject" className="text-xs text-slate-500 dark:text-slate-400">
                              Hal
                            </Label>
                            <Input
                              id="counselingSubject"
                              value={tempCounselingSubject}
                              onChange={(e) => setTempCounselingSubject(e.target.value)}
                              placeholder={DEFAULT_COUNSELING_SUBJECT}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="counselingRecipientName" className="text-xs text-slate-500 dark:text-slate-400">
                              Yang Terhormat
                            </Label>
                            <Textarea
                              id="counselingRecipientName"
                              value={tempCounselingRecipientName}
                              onChange={(e) => setTempCounselingRecipientName(e.target.value)}
                              placeholder={DEFAULT_COUNSELING_RECIPIENT_NAME}
                              className="min-h-24 bg-white text-sm dark:bg-gray-800"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="counselingReferralUnit" className="text-xs text-slate-500 dark:text-slate-400">
                              Unit Rujukan Konseling
                            </Label>
                            <Input
                              id="counselingReferralUnit"
                              value={tempCounselingReferralUnit}
                              onChange={(e) => setTempCounselingReferralUnit(e.target.value)}
                              placeholder={DEFAULT_COUNSELING_REFERRAL_UNIT}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>
                        </div>
                      )}

                      {selectedLayoutConfigKey === 'research' && (
                        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Konten Surat Penelitian</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Nilai default ini dipakai pada pengajuan penelitian baru dan langsung terlihat di preview.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="researchAssignmentType" className="text-xs text-slate-500 dark:text-slate-400">
                              Jenis Tugas
                            </Label>
                            <Input
                              id="researchAssignmentType"
                              value={tempResearchAssignmentType}
                              onChange={(e) => setTempResearchAssignmentType(e.target.value)}
                              placeholder={DEFAULT_RESEARCH_ASSIGNMENT_TYPE}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="researchAdvisorTitle" className="text-xs text-slate-500 dark:text-slate-400">
                              Label Jabatan Saat Satu Pembimbing
                            </Label>
                            <Input
                              id="researchAdvisorTitle"
                              value={tempResearchAdvisorTitle}
                              onChange={(e) => setTempResearchAdvisorTitle(e.target.value)}
                              placeholder={DEFAULT_RESEARCH_ADVISOR_TITLE}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="researchAdvisorTitleFirst" className="text-xs text-slate-500 dark:text-slate-400">
                                Label Pembimbing Pertama
                              </Label>
                              <Input
                                id="researchAdvisorTitleFirst"
                                value={tempResearchAdvisorTitleFirst}
                                onChange={(e) => setTempResearchAdvisorTitleFirst(e.target.value)}
                                placeholder={DEFAULT_RESEARCH_ADVISOR_TITLE_FIRST}
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="researchAdvisorTitleSecond" className="text-xs text-slate-500 dark:text-slate-400">
                                Label Pembimbing Kedua
                              </Label>
                              <Input
                                id="researchAdvisorTitleSecond"
                                value={tempResearchAdvisorTitleSecond}
                                onChange={(e) => setTempResearchAdvisorTitleSecond(e.target.value)}
                                placeholder={DEFAULT_RESEARCH_ADVISOR_TITLE_SECOND}
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedLayoutConfigKey === 'interview' && (
                        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Konten Surat Wawancara</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Nilai default ini dipakai pada pengajuan izin wawancara baru dan langsung terlihat di preview.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="interviewAssignmentType" className="text-xs text-slate-500 dark:text-slate-400">
                              Jenis Tugas
                            </Label>
                            <Input
                              id="interviewAssignmentType"
                              value={tempInterviewAssignmentType}
                              onChange={(e) => setTempInterviewAssignmentType(e.target.value)}
                              placeholder={DEFAULT_INTERVIEW_ASSIGNMENT_TYPE}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="interviewAdvisorTitle" className="text-xs text-slate-500 dark:text-slate-400">
                              Label Jabatan Saat Satu Pembimbing
                            </Label>
                            <Input
                              id="interviewAdvisorTitle"
                              value={tempInterviewAdvisorTitle}
                              onChange={(e) => setTempInterviewAdvisorTitle(e.target.value)}
                              placeholder={DEFAULT_INTERVIEW_ADVISOR_TITLE}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="interviewAdvisorTitleFirst" className="text-xs text-slate-500 dark:text-slate-400">
                                Label Pembimbing Pertama
                              </Label>
                              <Input
                                id="interviewAdvisorTitleFirst"
                                value={tempInterviewAdvisorTitleFirst}
                                onChange={(e) => setTempInterviewAdvisorTitleFirst(e.target.value)}
                                placeholder={DEFAULT_INTERVIEW_ADVISOR_TITLE_FIRST}
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="interviewAdvisorTitleSecond" className="text-xs text-slate-500 dark:text-slate-400">
                                Label Pembimbing Kedua
                              </Label>
                              <Input
                                id="interviewAdvisorTitleSecond"
                                value={tempInterviewAdvisorTitleSecond}
                                onChange={(e) => setTempInterviewAdvisorTitleSecond(e.target.value)}
                                placeholder={DEFAULT_INTERVIEW_ADVISOR_TITLE_SECOND}
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedLayoutConfigKey === 'permission' && (
                        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Konten Surat Perizinan</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Nilai default ini dipakai pada pengajuan perizinan baru dan langsung terlihat di preview.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="permissionAssignmentType" className="text-xs text-slate-500 dark:text-slate-400">
                              Jenis Tugas
                            </Label>
                            <Input
                              id="permissionAssignmentType"
                              value={tempPermissionAssignmentType}
                              onChange={(e) => setTempPermissionAssignmentType(e.target.value)}
                              placeholder={DEFAULT_PERMISSION_ASSIGNMENT_TYPE}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="permissionAdvisorTitle" className="text-xs text-slate-500 dark:text-slate-400">
                              Label Jabatan Saat Satu Pembimbing
                            </Label>
                            <Input
                              id="permissionAdvisorTitle"
                              value={tempPermissionAdvisorTitle}
                              onChange={(e) => setTempPermissionAdvisorTitle(e.target.value)}
                              placeholder={DEFAULT_PERMISSION_ADVISOR_TITLE}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="permissionAdvisorTitleFirst" className="text-xs text-slate-500 dark:text-slate-400">
                                Label Pembimbing Pertama
                              </Label>
                              <Input
                                id="permissionAdvisorTitleFirst"
                                value={tempPermissionAdvisorTitleFirst}
                                onChange={(e) => setTempPermissionAdvisorTitleFirst(e.target.value)}
                                placeholder={DEFAULT_PERMISSION_ADVISOR_TITLE_FIRST}
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="permissionAdvisorTitleSecond" className="text-xs text-slate-500 dark:text-slate-400">
                                Label Pembimbing Kedua
                              </Label>
                              <Input
                                id="permissionAdvisorTitleSecond"
                                value={tempPermissionAdvisorTitleSecond}
                                onChange={(e) => setTempPermissionAdvisorTitleSecond(e.target.value)}
                                placeholder={DEFAULT_PERMISSION_ADVISOR_TITLE_SECOND}
                                className="bg-white dark:bg-gray-800"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Margin Area Tulisan (mm)</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Top (Atas)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="80"
                              step="0.5"
                              value={selectedLayoutConfig.marginTopMm}
                              onChange={(e) => handleLetterLayoutChange(selectedLayoutConfigKey, 'marginTopMm', e.target.value)}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Right (Kanan)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="80"
                              step="0.5"
                              value={selectedLayoutConfig.marginRightMm}
                              onChange={(e) => handleLetterLayoutChange(selectedLayoutConfigKey, 'marginRightMm', e.target.value)}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Bottom (Bawah)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="80"
                              step="0.5"
                              value={selectedLayoutConfig.marginBottomMm}
                              onChange={(e) => handleLetterLayoutChange(selectedLayoutConfigKey, 'marginBottomMm', e.target.value)}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Left (Kiri)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="80"
                              step="0.5"
                              value={selectedLayoutConfig.marginLeftMm}
                              onChange={(e) => handleLetterLayoutChange(selectedLayoutConfigKey, 'marginLeftMm', e.target.value)}
                              className="bg-white dark:bg-gray-800"
                            />
                          </div>
                        </div>
                      </div>

                      {selectedLayoutConfigKey === 'suRek' && (
                        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tembusan Default</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                Tembusan ini otomatis masuk ke pengajuan rekomendasi baru dan tampil di preview.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              className="h-8 shrink-0 px-2 text-xs"
                              onClick={() => setTempSuRekTembusan([...tempSuRekTembusan, { role: '', name: '' }])}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" /> Tambah
                            </Button>
                          </div>

                          {tempSuRekTembusan.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              Belum ada tembusan default.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {tempSuRekTembusan.map((cc, i) => (
                                <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                                  <div className="grid grid-cols-1 gap-2">
                                    <Input
                                      placeholder="Jabatan tembusan"
                                      className="h-9 bg-white text-xs dark:bg-gray-800"
                                      value={cc.role || ''}
                                      onChange={(e) => {
                                        const newCc = [...tempSuRekTembusan];
                                        newCc[i] = { ...newCc[i], role: e.target.value };
                                        setTempSuRekTembusan(newCc);
                                      }}
                                    />
                                    <Input
                                      placeholder="Nama (opsional)"
                                      className="h-9 bg-white text-xs dark:bg-gray-800"
                                      value={cc.name || ''}
                                      onChange={(e) => {
                                        const newCc = [...tempSuRekTembusan];
                                        newCc[i] = { ...newCc[i], name: e.target.value };
                                        setTempSuRekTembusan(newCc);
                                      }}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
                                    onClick={() => {
                                      const newCc = [...tempSuRekTembusan];
                                      newCc.splice(i, 1);
                                      setTempSuRekTembusan(newCc);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                        * Nilai margin dinyatakan dalam milimeter (mm), menyesuaikan area kosong pada kop surat background.
                      </div>
                    </div>

                    {/* Right Column: Live Real-time Preview */}
                    <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/20 flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pratinjau Layout Margin Resmi</span>
                        <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-400">Skala Lembar A4</span>
                      </div>

                      <div className="w-full overflow-auto bg-slate-200/50 dark:bg-gray-900/50 rounded-xl p-4 flex justify-center items-start border border-slate-100 dark:border-slate-800 min-h-[450px]">
                        <div 
                          className="scale-[0.5] sm:scale-[0.6] md:scale-[0.7] lg:scale-[0.65] xl:scale-[0.75] origin-top my-4"
                          key={`${selectedLayoutConfigKey}-${selectedLayoutConfig.marginTopMm}-${selectedLayoutConfig.marginRightMm}-${selectedLayoutConfig.marginBottomMm}-${selectedLayoutConfig.marginLeftMm}-${tempLetterBackgrounds.document.imageBase64 ? 'has-bg' : 'no-bg'}`}
                        >
                          <LetterPreview
                            type={selectedPreviewType}
                            data={selectedPreviewData}
                            backgroundImageBase64={tempLetterBackgrounds.document.imageBase64}
                            layout={selectedLayoutConfig}
                            letterNumber={selectedPreviewData.letterNumber}
                            validationToken={selectedPreviewData.validationToken}
                            validationUrl={selectedPreviewData.validationUrl}
                            letterDate={selectedPreviewData.letterDate}
                            showLayoutGuide={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </>)}
          </div>
        </div>
      )}

      {/* Render Requests View */}
      {effectiveTab === 'requests' && (
        <div className="space-y-4">
          {/* Request Type Selector */}
          <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl max-w-max border border-slate-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => { setActiveRequestType('activeStudent'); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeRequestType === 'activeStudent'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Surat Aktif Kuliah
            </button>

            <button
              type="button"
              onClick={() => { setActiveRequestType('counseling'); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeRequestType === 'counseling'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Surat Konseling
            </button>
            <button
              type="button"
              onClick={() => { setActiveRequestType('suRek'); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeRequestType === 'suRek'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Surat Rekomendasi
            </button>
          </div>

          <Card className="shadow-sm border-slate-200 dark:border-gray-700">
            <CardHeader className="bg-slate-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-slate-800 dark:text-white">
                    Daftar Permohonan {getRequestTypeTitle()}
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">Verifikasi dan proses permohonan dari mahasiswa.</CardDescription>
                </div>
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={handleBatchDeleteOpen}
                  disabled={isProcessing}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus {selectedIds.size} Terpilih
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Memuat data...</div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <p>Belum ada permohonan yang masuk.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-gray-600 cursor-pointer accent-blue-600"
                        checked={selectedIds.size === requests.length && requests.length > 0}
                        onChange={toggleSelectAll}
                        title="Pilih semua"
                      />
                    </TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama Mahasiswa</TableHead>
                    <TableHead>NIM</TableHead>
                    <TableHead>Nomor Surat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id} className={selectedIds.has(req.id) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-gray-600 cursor-pointer accent-blue-600"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelectId(req.id)}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {format(new Date(req.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-white">{req.name}</TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">{req.nim}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {req.letterNumber || 'Akan dibuat saat verifikasi'}
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline" className="border-slate-300 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
                            size="sm"
                            onClick={() => setSelectedRequest(req)}
                          >
                            <Eye className="w-4 h-4 mr-2" /> Detail & Proses
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Hapus permohonan ${req.name}`}
                            className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => handleDeleteSingle(req)}
                            disabled={isProcessing}
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
          </CardContent>
        </Card>
        </div>
      )}

      {/* ── Double Confirm Delete Dialog ───────────────────────────────────── */}
      {confirmPhase === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Hapus Pengajuan?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Langkah 1 dari 2 — tinjau data yang akan dihapus</p>
              </div>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 mb-5 space-y-1">
              {deleteTarget ? (
                <>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{deleteTarget.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">NIM: {deleteTarget.nim} | Status: {deleteTarget.status}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">{batchDeleteTargets.length} pengajuan akan dihapus</p>
                  {batchDeleteTargets.slice(0, 4).map(r => (
                    <p key={r.id} className="text-xs text-slate-600 dark:text-slate-400">• {r.name} ({r.nim})</p>
                  ))}
                  {batchDeleteTargets.length > 4 && <p className="text-xs text-slate-400">...dan {batchDeleteTargets.length - 4} lainnya</p>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Konfirmasi Penghapusan</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Langkah 2 dari 2 — tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Ketik <strong className="text-red-600 dark:text-red-400">HAPUS</strong> untuk mengkonfirmasi penghapusan permanen.
            </p>
            <Input
              placeholder="Ketik HAPUS di sini"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="mb-4 border-red-300 focus:ring-red-400 dark:border-red-800 dark:bg-gray-700"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmText === 'HAPUS' && executeDelete()}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 dark:border-gray-600" onClick={() => setConfirmPhase(1)}>← Kembali</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                onClick={executeDelete}
                disabled={confirmText !== 'HAPUS' || isProcessing}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Hapus Permanen
              </Button>
            </div>
          </div>
        </div>
      )}



      {emailUx}
    </div>
  );
}
