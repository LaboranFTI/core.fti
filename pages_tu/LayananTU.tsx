import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Role } from '../types';
import { ActiveStudentForm } from './components/ActiveStudentForm';
import { AdminPanel } from './components/AdminPanel';
import { LetterArchivePanel } from './components/LetterArchivePanel';
import { ObservationForm } from './components/ObservationForm';
import { LetterPreview } from './components/LetterPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Archive, FileText, LayoutPanelTop, PenSquare, Shield } from 'lucide-react';
import { api } from '../services/api';
import { ObservationData, TULetterBackgrounds, TULetterLayouts } from './types';

interface HalamanTUProps {
  role: Role;
}

const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

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
      description: 'Alur singkat untuk cek KST, upload transkrip, lalu ajukan permohonan surat aktif kuliah.',
      icon: FileText
    },
    observasi: {
      title: 'Surat Ijin Observasi',
      description: isMahasiswa
        ? 'Role Mahasiswa hanya dapat melihat template dan preview surat observasi pada halaman ini.'
        : 'Isi data observasi dan cek preview surat secara langsung sebelum dicetak.',
      icon: observationView === 'form' ? PenSquare : LayoutPanelTop
    },
    'arsip-surat': {
      title: 'Arsip Surat',
      description: 'Lihat data surat aktif kuliah dan observasi yang tersimpan, lalu cetak ulang atau kirim email kembali saat diperlukan.',
      icon: Archive
    },
    'panel-admin': {
      title: 'Panel Admin TU',
      description: 'Kelola pengajuan, atur semester berjalan, dan siapkan pengesahan surat dari satu tempat.',
      icon: Shield
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
        setLetterBackgrounds(json.letterBackgrounds);
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Layanan Tata Usaha</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Layanan pengajuan Surat Keterangan Aktif Kuliah dan Surat Observasi
          </p>
        </div>
      </div>

      {/* Konten Utama berdasarkan Role */}
      <div className="pt-2 print:p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="flex w-full flex-col">
          <TabsList
            className="mb-4 flex w-full flex-wrap gap-2 rounded-3xl bg-transparent p-0 print:hidden"
          >
            {!isMahasiswa && (
              <TabsTrigger value="aktif" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:data-[state=active]:border-blue-900/50 dark:data-[state=active]:bg-blue-950/30 dark:data-[state=active]:text-blue-300">
                <FileText className="mr-2 h-4 w-4" />
                Surat Aktif Kuliah
              </TabsTrigger>
            )}
            <TabsTrigger value="observasi" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:data-[state=active]:border-blue-900/50 dark:data-[state=active]:bg-blue-950/30 dark:data-[state=active]:text-blue-300">
              <PenSquare className="mr-2 h-4 w-4" />
              Surat Ijin Observasi
            </TabsTrigger>
            {isTUAdmin && (
              <TabsTrigger value="arsip-surat" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:data-[state=active]:border-blue-900/50 dark:data-[state=active]:bg-blue-950/30 dark:data-[state=active]:text-blue-300">
                <Archive className="w-4 h-4 mr-2" />
                Arsip Surat
              </TabsTrigger>
            )}
            {isTUAdmin && (
              <TabsTrigger value="panel-admin" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:data-[state=active]:border-blue-900/50 dark:data-[state=active]:bg-blue-950/30 dark:data-[state=active]:text-blue-300">
                <Shield className="w-4 h-4 mr-2" />
                Panel Admin
              </TabsTrigger>
            )}
          </TabsList>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/70 print:hidden">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <ActiveTabIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  {activeTabMeta[activeTab]?.title}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {activeTabMeta[activeTab]?.description}
                </p>
              </div>
            </div>
          </div>
          
          <TabsContent value="aktif" className="print:m-0 focus:outline-none">
            <ActiveStudentForm />
          </TabsContent>
          
          <TabsContent value="observasi" className="print:m-0 focus:outline-none">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800/70 xl:hidden print:hidden">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                {observationView === "form" ? <PenSquare className="w-4 h-4 text-blue-600" /> : <LayoutPanelTop className="w-4 h-4 text-blue-600" />}
                {observationView === "form" ? 'Mode Formulir' : 'Mode Preview'}
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setObservationView("form")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${observationView === "form" ? 'bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setObservationView("preview")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${observationView === "preview" ? 'bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Preview
                </button>
              </div>
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
                  backgroundImageBase64={letterBackgrounds.observation.imageBase64}
                  layout={letterLayouts.observation}
                  showLayoutGuide={!isPreparingObservationOutput}
                />
              </div>
            </div>
            <div className="pointer-events-none fixed -left-2500 top-0 opacity-100" aria-hidden="true">
              <LetterPreview
                ref={capturePreviewRef}
                data={sanitizeObservationData(obsData)}
                backgroundImageBase64={letterBackgrounds.observation.imageBase64}
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
