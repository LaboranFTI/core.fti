import {
  ArrowLeft,
  Layout,
  Archive as PhArchive,
  Buildings as PhBuildings,
  ChatCircleText as PhChatCircleText,
  FileLock as PhFileLock,
  FileMagnifyingGlass as PhFileMagnifyingGlass,
  FileText as PhFileText,
  GearSix as PhGearSix,
  GraduationCap as PhGraduationCap,
  Medal as PhMedal,
  MicrophoneStage as PhMicrophoneStage,
  ShieldCheck as PhShieldCheck,
  Student as PhStudent
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Role } from '../types';
import { ActiveStudentForm } from './components/ActiveStudentForm';
import { AdminPanel } from './components/AdminPanel';
import { CounselingForm } from './components/CounselingForm';
import { LetterArchivePanel } from './components/LetterArchivePanel';
import { FinalTaskArchivePanel } from './components/FinalTaskArchivePanel';
import { ObservationForm } from './components/ObservationForm';
import { ResearchLetterForm } from './components/ResearchLetterForm';
import { SuRekForm } from './components/SuRekForm';
import { PageTabs, PageTabItem } from '../components/ui/page-tabs';
import { Tabs, TabsContent } from '../components/ui/tabs';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import { TULetterBackgrounds, TULetterLayouts } from './types';
import { cn } from '../lib/utils';

interface HalamanTUProps {
  role: Role;
}

const createEmptyLetterBackgrounds = (): TULetterBackgrounds => ({
  document: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  counseling: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  research: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

const createEmptyLetterLayouts = (): TULetterLayouts => ({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  counseling: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  research: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  suRek: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

const normalizeLetterBackgrounds = (backgrounds?: Partial<TULetterBackgrounds>): TULetterBackgrounds => {
  const empty = createEmptyLetterBackgrounds();
  const sharedBackground = backgrounds?.document?.imageBase64
    ? backgrounds.document
    : backgrounds?.activeStudent?.imageBase64
      ? backgrounds.activeStudent
    : backgrounds?.observation?.imageBase64
      ? backgrounds.observation
      : backgrounds?.counseling?.imageBase64
        ? backgrounds.counseling
        : backgrounds?.research?.imageBase64
          ? backgrounds.research
          : empty.document;

  return {
    document: { ...empty.document, ...sharedBackground },
    activeStudent: { ...empty.activeStudent, ...sharedBackground },
    observation: { ...empty.observation, ...sharedBackground },
    counseling: { ...empty.counseling, ...sharedBackground },
    research: { ...empty.research, ...sharedBackground }
  };
};

type LetterCategoryId = 'tata-usaha' | 'tugas-akhir';
type LetterServiceId =
  | 'aktif'
  | 'observasi'
  | 'penelitian'
  | 'konseling'
  | 'rekomendasi'
  | 'wawancara-ta'
  | 'perizinan-ta'
  | 'arsip-surat'
  | 'panel-admin';

interface LetterServiceCard {
  value: LetterServiceId;
  title: string;
  description: string;
  icon: React.ElementType;
  group: 'letter' | 'admin';
  category?: LetterCategoryId;
  adminOnly?: boolean;
  status?: 'available' | 'soon';
}


const HalamanTU: React.FC<HalamanTUProps> = ({ role }) => {
  // Tentukan apakah user memiliki hak akses sebagai Tata Usaha / Admin
  const isTUAdmin =
    role.toString().toUpperCase() === Role.ADMIN.toString().toUpperCase() ||
    role.toString().toUpperCase() === Role.ADMIN_TU.toString().toUpperCase();
  const isMahasiswa = role.toString().toUpperCase() === Role.MAHASISWA.toString().toUpperCase();
  const [activeMainTab, setActiveMainTab] = useState<string>('surat');
  const handleMainTabChange = (value: string) => {
    setActiveMainTab(value);
    if (value !== 'surat') {
      setActiveServiceId(null);
    }
  };
  const [activeServiceId, setActiveServiceId] = useState<LetterServiceId | null>(null);
  const [activeLetterCategory, setActiveLetterCategory] = useState<LetterCategoryId>('tata-usaha');
  const [letterBackgrounds, setLetterBackgrounds] = useState<TULetterBackgrounds>(createEmptyLetterBackgrounds);
  const [letterLayouts, setLetterLayouts] = useState<TULetterLayouts>(createEmptyLetterLayouts);
  const [letterArchiveRefreshKey, setLetterArchiveRefreshKey] = useState(0);
  const letterServiceCards: LetterServiceCard[] = [
    {
      value: 'aktif',
      title: 'Surat Aktif Kuliah',
      description: 'Form pengajuan surat keterangan status mahasiswa aktif untuk kebutuhan administrasi.',
      icon: PhStudent,
      group: 'letter',
      category: 'tata-usaha'
    },
    {
      value: 'konseling',
      title: 'Pengantar Konseling',
      description: 'Buat surat pengantar konseling untuk mahasiswa ke Pusat Layanan Konseling Fakultas Psikologi.',
      icon: PhChatCircleText,
      group: 'letter',
      category: 'tata-usaha'
    },
    {
      value: 'observasi',
      title: 'Surat Ijin Observasi',
      description: isMahasiswa
        ? 'Ajukan surat observasi untuk kegiatan mata kuliah ke instansi tujuan.'
        : 'Form surat ijin observasi untuk kegiatan mata kuliah ke instansi tujuan.',
      icon: PhBuildings,
      group: 'letter',
      category: 'tata-usaha'
    },
    {
      value: 'rekomendasi',
      title: 'Rekomendasi Afirmasi',
      description: 'Form permohonan surat rekomendasi untuk pendaftaran Beasiswa Afirmasi Cemerlang.',
      icon: PhMedal,
      group: 'letter',
      category: 'tata-usaha'
    },
    {
      value: 'penelitian',
      title: 'Surat Penelitian',
      description: 'Buat surat rekomendasi penelitian dengan QR validasi dan pembimbing opsional.',
      icon: PhFileMagnifyingGlass,
      group: 'letter',
      category: 'tugas-akhir'
    },
    {
      value: 'wawancara-ta',
      title: 'Permohonan Wawancara',
      description: 'Buat surat pengantar atau izin wawancara dengan QR validasi dan pembimbing opsional.',
      icon: PhMicrophoneStage,
      group: 'letter',
      category: 'tugas-akhir'
    },
    {
      value: 'perizinan-ta',
      title: 'Surat Perizinan',
      description: 'Buat surat permohonan izin tugas akhir dengan keperluan khusus pada bagian Hal.',
      icon: PhFileLock,
      group: 'letter',
      category: 'tugas-akhir'
    }
  ];
  const adminToolCards: LetterServiceCard[] = [
    {
      value: 'panel-admin',
      title: 'Kelola Permohonan',
      description: 'Buka panel validasi permohonan, pengaturan surat, dan proses pengiriman.',
      icon: PhShieldCheck,
      group: 'admin'
    },
    {
      value: 'arsip-surat',
      title: 'Arsip Surat',
      description: 'Buka daftar surat tersimpan untuk cetak ulang atau kirim ulang ke email.',
      icon: PhArchive,
      group: 'admin'
    }
  ];
  const availableServiceCards = letterServiceCards.filter((item) => {
    if (item.adminOnly && !isTUAdmin) return false;
    return !isMahasiswa || item.value === 'observasi';
  });
  const letterCategoryTabs: PageTabItem[] = [
    { value: 'tata-usaha', label: 'Surat Tata Usaha', icon: PhFileText },
    { value: 'tugas-akhir', label: 'Surat Tugas Akhir', icon: PhGraduationCap }
  ];
  const availableLetterCategoryTabs = letterCategoryTabs.filter((item) =>
    availableServiceCards.some((card) => card.category === item.value)
  );
  const selectedService = activeServiceId
    ? availableServiceCards.find((item) => item.value === activeServiceId && item.status !== 'soon') || null
    : null;


  const fetchLetterBackgrounds = useCallback(async () => {
    try {
      const res = await api('/api/tu/letter-backgrounds');
      const json = await res.json();
      if (res.ok && json?.letterBackgrounds) {
        setLetterBackgrounds(normalizeLetterBackgrounds(json.letterBackgrounds));
        const defaultLayouts = createEmptyLetterLayouts();
        const mergedLayouts = {
          activeStudent: { ...defaultLayouts.activeStudent, ...json.letterLayouts?.activeStudent },
          observation: { ...defaultLayouts.observation, ...json.letterLayouts?.observation },
          counseling: { ...defaultLayouts.counseling, ...json.letterLayouts?.counseling },
          research: { ...defaultLayouts.research, ...json.letterLayouts?.research },
          suRek: { ...defaultLayouts.suRek, ...json.letterLayouts?.suRek }
        };
        setLetterLayouts(mergedLayouts);
      }
    } catch (error) {
      console.error('Failed to fetch TU letter backgrounds:', error);
    }
  }, []);

  useEffect(() => {
    fetchLetterBackgrounds();
  }, [fetchLetterBackgrounds]);

  useEffect(() => {
    if (!activeServiceId) {
      return;
    }

    if (isMahasiswa && activeServiceId !== 'observasi') {
      setActiveServiceId(null);
      return;
    }

    if (!isTUAdmin && (activeServiceId === 'arsip-surat' || activeServiceId === 'panel-admin')) {
      setActiveServiceId(null);
    }

  }, [activeServiceId, isMahasiswa, isTUAdmin]);



  useEffect(() => {
    if (activeServiceId || availableLetterCategoryTabs.some((item) => item.value === activeLetterCategory)) {
      return;
    }

    const nextCategory = availableLetterCategoryTabs[0]?.value as LetterCategoryId | undefined;
    if (nextCategory) {
      setActiveLetterCategory(nextCategory);
    }
  }, [activeLetterCategory, activeServiceId, availableLetterCategoryTabs]);


  const adminMainTabs: PageTabItem[] = [
    { value: 'surat', label: 'Surat', icon: PhFileText },
    { value: 'permohonan', label: 'Kelola Permohonan', icon: PhShieldCheck },
    { value: 'arsip', label: 'Arsip Surat TU', icon: PhArchive },
    { value: 'arsip-ta', label: 'Arsip Tugas Akhir', icon: PhGraduationCap },
    { value: 'konfigurasi', label: 'Konfigurasi Surat', icon: PhGearSix }
  ];

  const renderServiceCard = (item: LetterServiceCard) => {
    const Icon = item.icon;
    const isActive = activeServiceId === item.value;
    const isComingSoon = item.status === 'soon';

    return (
      <button
        key={item.value}
        type="button"
        aria-pressed={isActive}
        aria-disabled={isComingSoon}
        disabled={isComingSoon}
        onClick={() => {
          if (!isComingSoon) {
            setActiveServiceId(item.value);
          }
        }}
        className={cn(
          'group flex aspect-square min-h-40 w-full flex-col justify-between rounded-lg border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-fti-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fti-blue-500 focus-visible:ring-offset-2 dark:bg-gray-900 dark:focus-visible:ring-offset-gray-900',
          isComingSoon
            ? 'cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-75 hover:translate-y-0 hover:border-slate-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900/70'
            : isActive
            ? 'border-fti-blue-500 ring-1 ring-fti-blue-200 dark:border-fti-blue-300 dark:ring-fti-blue-300/30'
            : 'border-slate-200 dark:border-gray-700'
        )}
      >
        <span className="flex min-h-0 flex-col items-start">
          <span
            className={cn(
              'flex h-10 w-10 flex-none items-center justify-center rounded-md border transition-colors',
              isComingSoon
                ? 'border-slate-200 bg-white text-slate-400 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-500'
                : isActive
                ? 'border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/30 dark:bg-fti-blue-300/10 dark:text-fti-blue-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 group-hover:text-fti-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-300 dark:group-hover:text-fti-blue-200'
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="mt-3 min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</span>
          </span>
        </span>
        <span
          className={cn(
            'mt-4 text-xs font-semibold uppercase text-slate-400 transition-colors dark:text-slate-500',
            isActive && 'text-fti-blue-700 dark:text-fti-blue-200'
          )}
        >
          {isActive ? 'Sedang dibuka' : isComingSoon ? 'Segera tersedia' : 'Buka'}
        </span>
      </button>
    );
  };

  const renderLetterCategoryGrid = (category: LetterCategoryId) => {
    const cards = availableServiceCards.filter((item) => item.category === category);

    if (cards.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
          Belum ada layanan surat pada kategori ini.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {cards.map(renderServiceCard)}
      </div>
    );
  };

  const renderActiveService = () => {
    const handleReturnToMenu = () => setActiveServiceId(null);

    switch (activeServiceId) {
      case 'aktif':
        return <ActiveStudentForm onReturnToMenu={handleReturnToMenu} />;
      case 'observasi':
        return <ObservationForm readOnly={isMahasiswa} onReturnToMenu={handleReturnToMenu} />;
      case 'penelitian':
        return <ResearchLetterForm onCompleted={() => setLetterArchiveRefreshKey((prev) => prev + 1)} onReturnToMenu={handleReturnToMenu} />;
      case 'wawancara-ta':
        return <ResearchLetterForm variant="interview" onCompleted={() => setLetterArchiveRefreshKey((prev) => prev + 1)} onReturnToMenu={handleReturnToMenu} />;
      case 'perizinan-ta':
        return <ResearchLetterForm variant="permission" onCompleted={() => setLetterArchiveRefreshKey((prev) => prev + 1)} onReturnToMenu={handleReturnToMenu} />;
      case 'konseling':
        return <CounselingForm onReturnToMenu={handleReturnToMenu} />;
      case 'rekomendasi':
        return <SuRekForm onReturnToMenu={handleReturnToMenu} />;
      case 'arsip-surat':
        return isTUAdmin ? <LetterArchivePanel refreshKey={letterArchiveRefreshKey} /> : null;
      case 'panel-admin':
        return isTUAdmin ? <AdminPanel onSettingsSaved={fetchLetterBackgrounds} /> : null;
      default:
        return null;
    }
  };
  const SelectedServiceIcon = selectedService?.icon || PhFileText;
  const isServiceMenuOpen = !selectedService;
  const handleLetterCategoryChange = (value: string) => {
    setActiveLetterCategory(value as LetterCategoryId);
    setActiveServiceId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Layanan Surat"
        description="Layanan pengajuan Surat Keterangan Aktif Kuliah, Surat Pengantar Konseling, Surat Observasi, Surat Penelitian, Surat Wawancara, dan Surat Rekomendasi."
        className="print:hidden"
      />

      {/* Konten Utama berdasarkan Role */}
      <div className="pt-2 print:p-0">
        <Tabs value={activeMainTab} onValueChange={handleMainTabChange} className="flex w-full flex-col">
          {isTUAdmin && <PageTabs items={adminMainTabs} className="mb-4 print:hidden" />}

          <TabsContent value="surat" className="print:m-0 focus:outline-none">
            {isServiceMenuOpen ? (
              <div className="space-y-5 print:hidden">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase text-fti-blue-700 dark:text-fti-blue-200">
                    Layanan Surat
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Surat</h2>
                </div>

                <Tabs value={activeLetterCategory} onValueChange={handleLetterCategoryChange} className="gap-4">
                  {availableLetterCategoryTabs.length > 1 && (
                    <PageTabs items={availableLetterCategoryTabs} />
                  )}

                  <TabsContent value="tata-usaha" className="focus:outline-none">
                    {renderLetterCategoryGrid('tata-usaha')}
                  </TabsContent>

                  <TabsContent value="tugas-akhir" className="focus:outline-none">
                    {renderLetterCategoryGrid('tugas-akhir')}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between print:hidden">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-fti-blue-100 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/20 dark:bg-fti-blue-300/10 dark:text-fti-blue-200">
                      <SelectedServiceIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-fti-blue-700 dark:text-fti-blue-200">
                        Formulir Surat
                      </p>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedService.title}</h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveServiceId(null)}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-fti-blue-200 hover:text-fti-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fti-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-200 dark:hover:border-fti-blue-300/30 dark:hover:text-fti-blue-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke menu surat
                  </button>
                </div>

                <div className="print:mt-0">
                  {renderActiveService()}
                </div>
              </>
            )}
          </TabsContent>

          {isTUAdmin && (
            <>
              <TabsContent value="permohonan" className="print:m-0 focus:outline-none">
                <AdminPanel mode="requests" />
              </TabsContent>
              <TabsContent value="arsip" className="print:m-0 focus:outline-none">
                <LetterArchivePanel refreshKey={letterArchiveRefreshKey} />
              </TabsContent>
              <TabsContent value="arsip-ta" className="print:m-0 focus:outline-none">
                <FinalTaskArchivePanel refreshKey={letterArchiveRefreshKey} />
              </TabsContent>
              <TabsContent value="konfigurasi" className="print:m-0 focus:outline-none">
                <AdminPanel mode="settings" onSettingsSaved={fetchLetterBackgrounds} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default HalamanTU;
