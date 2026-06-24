import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Role } from '../types';
import { ActiveStudentForm } from './components/ActiveStudentForm';
import { AdminPanel } from './components/AdminPanel';
import { LetterArchivePanel } from './components/LetterArchivePanel';
import { ObservationForm } from './components/ObservationForm';
import { LetterPreview } from './components/LetterPreview';
import { PageTabs, PageTabItem, PageTabSummary } from '../components/ui/page-tabs';
import { Tabs, TabsContent } from '../components/ui/tabs';
import PageHeader from '../components/PageHeader';
import { TUSegmentedControl } from './components/TUPageComponents';
import { Archive, FileText, Layout, NotePencil, ShieldCheck } from '@phosphor-icons/react';
import { api } from '../services/api';
import { ObservationData, TULetterBackgrounds, TULetterLayouts } from './types';

interface HalamanTUProps {
  role: Role;
}

const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  document: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

const normalizeLetterBackgrounds = (backgrounds?: Partial<TULetterBackgrounds>): TULetterBackgrounds => {
  const empty = createEmptyLetterBackgrounds();
  const sharedBackground = backgrounds?.document?.imageBase64
    ? backgrounds.document
    : backgrounds?.activeStudent?.imageBase64
      ? backgrounds.activeStudent
      : backgrounds?.observation?.imageBase64
        ? backgrounds.observation
        : empty.document;

  return {
    document: { ...empty.document, ...sharedBackground },
    activeStudent: { ...empty.activeStudent, ...sharedBackground },
    observation: { ...empty.observation, ...sharedBackground }
  };
};

type ObservationFeedback = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const sanitizeObservationData = (data: ObservationData): ObservationData => ({
  ...data,
  recipientName: data.recipientName.trim(),
  companyName: data.companyName.trim(),
  companyAddress: data.companyAddress.trim(),
  courseName: data.courseName.trim(),
  lecturerName: data.lecturerName.trim(),
  headOfProgramName: data.headOfProgramName.trim(),
  studyProgramId: data.studyProgramId,
  studyProgramName: data.studyProgramName,
  studyProgramLevel: data.studyProgramLevel,
  students: data.students
    .map((student) => ({
      name: student.name.trim(),
      nim: student.nim.trim()
    }))
    .filter((student) => student.name || student.nim)
});

const validateObservationData = (data: ObservationData) => {
  if (!data.recipientName) return 'Nama penerima atau jabatan tujuan masih perlu diisi.';
  if (!data.companyName) return 'Nama perusahaan atau instansi tujuan masih kosong.';
  if (!data.companyAddress) return 'Alamat perusahaan tujuan masih perlu dilengkapi.';
  if (!data.courseName) return 'Nama mata kuliah observasi belum diisi.';
  if (!data.lecturerName) return 'Nama dosen pengampu masih kosong.';
  if (!data.headOfProgramName) return 'Nama kaprodi masih kosong.';
  if (data.students.length === 0) return 'Tambahkan minimal satu mahasiswa untuk surat observasi.';

  const invalidStudent = data.students.find((student) => !student.name || !student.nim);
  if (invalidStudent) return 'Setiap mahasiswa harus memiliki nama dan NIM sebelum surat diunduh.';

  return null;
};

const buildObservationFileName = (data: ObservationData) => {
  const companySlug = data.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const dateStamp = new Date().toISOString().slice(0, 10);

  return `surat-observasi${companySlug ? `-${companySlug}` : ''}-${dateStamp}.pdf`;
};

const HalamanTU: React.FC<HalamanTUProps> = ({ role }) => {
  // Tentukan apakah user memiliki hak akses sebagai Tata Usaha / Admin
  const isTUAdmin =
    role.toString().toUpperCase() === Role.ADMIN.toString().toUpperCase() ||
    role.toString().toUpperCase() === Role.ADMIN_TU.toString().toUpperCase();
  const isMahasiswa = role.toString().toUpperCase() === Role.MAHASISWA.toString().toUpperCase();
  const [activeTab, setActiveTab] = useState(isMahasiswa ? "observasi" : isTUAdmin ? "panel-admin" : "aktif");
  const [observationView, setObservationView] = useState<"form" | "preview">("form");
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const capturePreviewRef = useRef<HTMLDivElement>(null);
  const [isPreparingObservationOutput, setIsPreparingObservationOutput] = useState(false);
  const [observationFeedback, setObservationFeedback] = useState<ObservationFeedback>(null);
  const [letterArchiveRefreshKey, setLetterArchiveRefreshKey] = useState(0);
  const lastSavedObservationSignatureRef = useRef<string | null>(null);
  const activeTabMeta: Record<string, { title: string; description: string; icon: React.ElementType }> = {
    aktif: {
      title: 'Surat Aktif Kuliah',
      description: 'Alur singkat untuk cek KST, lalu ajukan permohonan surat aktif kuliah.',
      icon: FileText
    },
    observasi: {
      title: 'Surat Ijin Observasi',
      description: isMahasiswa
        ? 'Role Mahasiswa hanya dapat melihat template dan preview surat observasi pada halaman ini.'
        : 'Isi data observasi dan cek preview surat secara langsung sebelum dicetak.',
      icon: observationView === 'form' ? NotePencil : Layout
    },
    'arsip-surat': {
      title: 'Arsip Surat',
      description: 'Lihat data surat aktif kuliah dan observasi yang tersimpan, lalu cetak ulang atau kirim email kembali saat diperlukan.',
      icon: Archive
    },
    'panel-admin': {
      title: 'Panel Admin TU',
      description: 'Kelola pengajuan, atur semester berjalan, dan siapkan pengesahan surat dari satu tempat.',
      icon: ShieldCheck
    }
  };

  // State untuk Preview Surat Observasi
  const [obsData, setObsData] = useState<ObservationData>({
    recipientName: '',
    companyName: '',
    companyAddress: '',
    courseName: '',
    lecturerName: '',
    headOfProgramName: '',
    studyProgramId: '',
    studyProgramName: '',
    studyProgramLevel: '',
    students: []
  });

  const handlePrint = async () => {
    const sanitizedData = sanitizeObservationData(obsData);
    const validationMessage = validateObservationData(sanitizedData);

    if (validationMessage) {
      setObservationFeedback({ type: 'error', message: validationMessage });
      setObservationView('form');
      return;
    }

    try {
      await persistObservationRequest(sanitizedData);
      setObsData(sanitizedData);
      setObservationView('preview');
      setIsPreparingObservationOutput(true);
      setObservationFeedback({ type: 'info', message: 'Preview siap dicetak. Pastikan pengaturan printer memakai ukuran A4.' });
      await waitForNextPaint();
      window.print();
    } catch (error) {
      console.error('Failed to save observation request:', error);
      setObservationFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Gagal menyimpan data surat observasi.' });
      setIsPreparingObservationOutput(false);
    }
  };

  const handleObservationDataChange = useCallback((data: ObservationData) => {
    setObsData(data);
    setObservationFeedback(null);
    lastSavedObservationSignatureRef.current = null;
  }, []);

  const persistObservationRequest = useCallback(async (data: ObservationData) => {
    const payloadSignature = JSON.stringify(data);
    if (lastSavedObservationSignatureRef.current === payloadSignature) {
      return;
    }

    const response = await api('/api/observation-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientName: data.recipientName,
        companyName: data.companyName,
        company: data.companyName,
        companyAddress: data.companyAddress,
        courseName: data.courseName,
        lecturerName: data.lecturerName,
        headOfProgramName: data.headOfProgramName,
        students: data.students
      })
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.error || 'Gagal menyimpan data surat observasi.');
    }

    lastSavedObservationSignatureRef.current = payloadSignature;
    setLetterArchiveRefreshKey((prev) => prev + 1);
  }, []);

  const fetchLetterBackgrounds = useCallback(async () => {
    try {
      const res = await api('/api/tu/letter-backgrounds');
      const json = await res.json();
      if (res.ok && json?.letterBackgrounds) {
        setLetterBackgrounds(normalizeLetterBackgrounds(json.letterBackgrounds));
        setLetterLayouts(json.letterLayouts || createEmptyLetterLayouts());
      }
    } catch (error) {
      console.error('Failed to fetch TU letter backgrounds:', error);
    }
  }, []);

  useEffect(() => {
    fetchLetterBackgrounds();
  }, [fetchLetterBackgrounds]);

  useEffect(() => {
    if (isMahasiswa && activeTab !== 'observasi') {
      setActiveTab('observasi');
    }
  }, [activeTab, isMahasiswa]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPreparingObservationOutput(false);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const ActiveTabIcon = activeTabMeta[activeTab]?.icon || FileText;
  const serviceTabs: PageTabItem[] = [
    !isMahasiswa && { value: 'aktif', label: 'Surat Aktif Kuliah', icon: FileText },
    { value: 'observasi', label: 'Surat Ijin Observasi', icon: NotePencil },
    isTUAdmin && { value: 'arsip-surat', label: 'Arsip Surat', icon: Archive },
    isTUAdmin && { value: 'panel-admin', label: 'Panel Admin', icon: ShieldCheck }
  ].filter(Boolean) as PageTabItem[];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Layanan Tata Usaha"
        description="Layanan pengajuan Surat Keterangan Aktif Kuliah dan Surat Observasi."
        className="print:hidden"
      />

      {/* Konten Utama berdasarkan Role */}
      <div className="pt-2 print:p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="flex w-full flex-col">
          <PageTabs items={serviceTabs} className="mb-4 print:hidden" />


          <TabsContent value="aktif" className="print:m-0 focus:outline-none">
            <ActiveStudentForm />
          </TabsContent>
          
          <TabsContent value="observasi" className="print:m-0 focus:outline-none">
            <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:hidden print:hidden">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                {observationView === "form" ? <NotePencil className="h-4 w-4 text-slate-600 dark:text-slate-300" /> : <Layout className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
                {observationView === "form" ? 'Mode Formulir' : 'Mode Preview'}
              </div>
              <TUSegmentedControl
                value={observationView}
                options={[
                  { value: 'form', label: 'Form' },
                  { value: 'preview', label: 'Preview' }
                ]}
                onChange={(value) => setObservationView(value)}
              />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className={`${observationView === "preview" ? 'hidden xl:block' : 'block'} xl:col-span-5 print:hidden`}>
                <ObservationForm
                  onDataChange={handleObservationDataChange}
                  onPrint={handlePrint}
                  feedback={observationFeedback}
                  readOnly={isMahasiswa}
                />
              </div>
              <div className={`${observationView === "form" ? 'hidden xl:block' : 'block'} xl:col-span-7 print:block print:w-full print:absolute print:top-0 print:left-0 print:m-0 print:p-0`}>
                <LetterPreview
                  data={obsData}
                  backgroundImageBase64={letterBackgrounds.document.imageBase64}
                  layout={letterLayouts.observation}
                  showLayoutGuide={!isPreparingObservationOutput}
                />
              </div>
            </div>
            <div className="pointer-events-none fixed -left-2500 top-0 opacity-100" aria-hidden="true">
              <LetterPreview
                ref={capturePreviewRef}
                data={sanitizeObservationData(obsData)}
                backgroundImageBase64={letterBackgrounds.document.imageBase64}
                layout={letterLayouts.observation}
                showLayoutGuide={false}
              />
            </div>
          </TabsContent>

          {isTUAdmin && (
            <TabsContent value="arsip-surat" className="print:hidden focus:outline-none">
              <LetterArchivePanel refreshKey={letterArchiveRefreshKey} />
            </TabsContent>
          )}

          {isTUAdmin && (
            <TabsContent value="panel-admin" className="print:hidden focus:outline-none">
              <AdminPanel onSettingsSaved={fetchLetterBackgrounds} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default HalamanTU;
