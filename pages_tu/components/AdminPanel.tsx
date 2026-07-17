import {
  SpinnerGap as Loader2,
  Plus,
  FloppyDisk as Save,
  GearSix as Settings,
  UploadSimple as Upload,
  Trash as Trash2
} from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import { LetterLayout, TULetterBackgrounds, TULetterLayouts } from '../types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { LetterPreview } from './LetterPreview';
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
  LetterLayoutKey,
  letterLayoutSections,
  normalizeLetterBackgrounds,
  normalizeLetterLayouts
} from '../lib/letterSettings';
import { getDummyDataForPreview } from '../lib/letterPreviewData';
import { tuApi } from '../services/tuApi';

interface AdminPanelProps {
  onSettingsSaved?: () => Promise<void> | void;
}

export function AdminPanel({ onSettingsSaved }: AdminPanelProps) {
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

  useEffect(() => {
    fetchTuSettings();
  }, []);

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
  };

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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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
                            size="sm"
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
    </div>
  );
}
