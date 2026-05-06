import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { Role } from '../types';
import { ActiveStudentForm } from './components/ActiveStudentForm';
import { AdminPanel } from './components/AdminPanel';
import { ObservationForm } from './components/ObservationForm';
import { LetterPreview } from './components/LetterPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { FileText, Shield, LayoutPanelTop, PenSquare } from 'lucide-react';
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
  const [isDownloadingObservationPdf, setIsDownloadingObservationPdf] = useState(false);
  const [isPreparingObservationOutput, setIsPreparingObservationOutput] = useState(false);
  const [observationFeedback, setObservationFeedback] = useState<ObservationFeedback>(null);

  // State untuk Preview Surat Observasi
  const [obsData, setObsData] = useState<ObservationData>({
    recipientName: '',
    companyName: '',
    companyAddress: '',
    courseName: '',
    lecturerName: '',
    headOfProgramName: '',
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

    setObsData(sanitizedData);
    setObservationView('preview');
    setIsPreparingObservationOutput(true);
    setObservationFeedback({ type: 'info', message: 'Preview siap dicetak. Pastikan pengaturan printer memakai ukuran A4.' });
    await waitForNextPaint();
    window.print();
  };

  const handleObservationDataChange = useCallback((data: ObservationData) => {
    setObsData(data);
    setObservationFeedback(null);
  }, []);

  const handleDownloadObservationPdf = useCallback(async () => {
    const sanitizedData = sanitizeObservationData(obsData);
    const validationMessage = validateObservationData(sanitizedData);

    if (validationMessage) {
      setObservationFeedback({ type: 'error', message: validationMessage });
      setObservationView('form');
      return;
    }

    const previewElement = capturePreviewRef.current;
    if (!previewElement) {
      setObservationFeedback({ type: 'error', message: 'Preview surat belum siap. Muat ulang halaman lalu coba lagi.' });
      return;
    }

    setObsData(sanitizedData);
    setObservationView('preview');
    setIsDownloadingObservationPdf(true);
    setIsPreparingObservationOutput(true);
    setObservationFeedback({ type: 'info', message: 'Sedang menyiapkan PDF surat observasi...' });

    try {
      if ('fonts' in document) {
        await document.fonts.ready;
      }

      await waitForNextPaint();

      const dataUrl = await htmlToImage.toPng(previewElement, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
      pdf.save(buildObservationFileName(sanitizedData));

      setObservationFeedback({ type: 'success', message: 'PDF surat observasi berhasil diunduh.' });
      setObservationView('preview');
    } catch (error) {
      console.error('Failed to generate observation PDF:', error);
      setObservationFeedback({ type: 'error', message: 'Gagal membuat PDF surat observasi. Silakan coba lagi.' });
    } finally {
      setIsDownloadingObservationPdf(false);
      setIsPreparingObservationOutput(false);
    }
  }, [obsData]);

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

  const tabDescriptions: Record<string, { title: string; description: string }> = {
    aktif: {
      title: 'Surat Aktif Kuliah',
      description: 'Alur singkat untuk cek KST, upload transkrip, lalu ajukan permohonan surat aktif kuliah.'
    },
    observasi: {
      title: 'Surat Ijin Observasi',
      description: isMahasiswa
        ? 'Role Mahasiswa hanya dapat melihat template dan preview surat observasi pada halaman ini.'
        : 'Isi data observasi dan cek preview surat secara langsung sebelum dicetak.'
    },
    "panel-admin": {
      title: 'Panel Admin TU',
      description: 'Kelola pengajuan, atur semester berjalan, dan siapkan pengesahan surat dari satu tempat.'
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Layanan Tata Usaha
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isTUAdmin 
              ? 'Kelola permohonan surat dan administrasi mahasiswa Fakultas Teknologi Informasi.' 
              : 'Pusat layanan administrasi dan pengajuan surat mahasiswa Fakultas Teknologi Informasi.'}
          </p>
        </div>
      </div>

      {/* Konten Utama berdasarkan Role */}
      <div className="pt-2 print:p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="flex w-full flex-col">
          <TabsList
            className="mb-4 flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit print:hidden"
          >
            {!isMahasiswa && (
              <TabsTrigger value="aktif" className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center">
                Surat Aktif Kuliah
              </TabsTrigger>
            )}
            <TabsTrigger value="observasi" className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center">
              Surat Ijin Observasi
            </TabsTrigger>
            {isTUAdmin && (
              <TabsTrigger value="panel-admin" className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center">
                <Shield className="w-4 h-4 mr-2" />
                Panel Admin
              </TabsTrigger>
            )}
          </TabsList>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/70 print:hidden">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {tabDescriptions[activeTab]?.title}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {tabDescriptions[activeTab]?.description}
            </p>
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
                  onDownloadPdf={handleDownloadObservationPdf}
                  isDownloadingPdf={isDownloadingObservationPdf}
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
