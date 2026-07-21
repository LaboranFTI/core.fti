import {
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
  Student as PhStudent,
  MagnifyingGlass as PhMagnifyingGlass,
  House as PhHouse,
  CaretRight as PhCaretRight,
  XCircle as PhXCircle
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
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
import { cn } from '../lib/utils';

interface HalamanTUProps {
  role: Role;
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [letterArchiveRefreshKey, setLetterArchiveRefreshKey] = useState(0);
  
  const [parentGrid] = useAutoAnimate();
  const [parentList] = useAutoAnimate();

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

  const availableServiceCards = useMemo(() => {
    return letterServiceCards.filter((item) => {
      if (item.adminOnly && !isTUAdmin) return false;
      return true;
    });
  }, [isTUAdmin, isMahasiswa]);

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


  useEffect(() => {
    if (!activeServiceId) {
      return;
    }

    if (!isTUAdmin && (activeServiceId === 'arsip-surat' || activeServiceId === 'panel-admin')) {
      setActiveServiceId(null);
    }
  }, [activeServiceId, isTUAdmin]);



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
    { value: 'arsip', label: 'Kelola Surat TU', icon: PhArchive },
    { value: 'arsip-ta', label: 'Kelola Surat TA', icon: PhGraduationCap },
    { value: 'konfigurasi', label: 'Pengaturan', icon: PhGearSix }
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
              'flex h-12 w-12 flex-none items-center justify-center rounded-xl border transition-colors',
              isComingSoon
                ? 'border-slate-200 bg-white text-slate-400 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-500'
                : isActive
                ? 'border-fti-blue-200 bg-fti-blue-50 text-fti-blue-700 dark:border-fti-blue-300/30 dark:bg-fti-blue-300/10 dark:text-fti-blue-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 group-hover:bg-fti-blue-50 group-hover:border-fti-blue-200 group-hover:text-fti-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-300 dark:group-hover:bg-fti-blue-500/10 dark:group-hover:border-fti-blue-300/30 dark:group-hover:text-fti-blue-200'
            )}
          >
            <Icon className="h-6 w-6" />
          </span>
          <span className="mt-4 min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white transition-colors group-hover:text-fti-blue-700 dark:group-hover:text-fti-blue-200">{item.title}</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</span>
          </span>
        </span>
        <span
          className={cn(
            'mt-5 text-xs font-semibold uppercase text-slate-400 transition-colors dark:text-slate-500',
            isActive && 'text-fti-blue-700 dark:text-fti-blue-200',
            !isComingSoon && !isActive && 'group-hover:text-fti-blue-600 dark:group-hover:text-fti-blue-300'
          )}
        >
          {isActive ? 'Sedang dibuka' : isComingSoon ? 'Segera tersedia' : 'Buka Formulir'}
        </span>
      </button>
    );
  };

  const renderLetterCategoryGrid = (category?: LetterCategoryId) => {
    let cards = availableServiceCards;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      cards = cards.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query)
      );
    } else if (category) {
      cards = cards.filter((item) => item.category === category);
    }

    if (cards.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <PhFileMagnifyingGlass className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-200">Tidak ada surat ditemukan</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {searchQuery ? `Tidak ada hasil untuk pencarian "${searchQuery}"` : 'Belum ada layanan surat pada kategori ini.'}
          </p>
        </div>
      );
    }

    return (
      <div ref={parentGrid} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
        return isTUAdmin ? <AdminPanel /> : null;
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
            <div ref={parentList}>
            {isServiceMenuOpen ? (
              <div className="space-y-6 print:hidden">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-fti-blue-700 dark:text-fti-blue-200">
                      Layanan Surat
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pilih Surat</h2>
                  </div>
                  
                  <div className="relative w-full sm:max-w-xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <PhMagnifyingGlass className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      aria-label="Cari layanan surat"
                      placeholder="Cari surat..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full rounded-lg border-0 py-2 pl-9 pr-10 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-fti-blue-600 dark:bg-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500 dark:focus:ring-fti-blue-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <PhXCircle className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div ref={parentGrid}>
                {searchQuery.trim() ? (
                  <div className="pt-2">
                    <h3 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">Hasil Pencarian</h3>
                    {renderLetterCategoryGrid()}
                  </div>
                ) : (
                  <Tabs value={activeLetterCategory} onValueChange={handleLetterCategoryChange} className="gap-5">
                    {availableLetterCategoryTabs.length > 1 && (
                      <PageTabs items={availableLetterCategoryTabs} />
                    )}

                    <div className="mt-5">
                      <TabsContent value="tata-usaha" className="focus:outline-none">
                        {renderLetterCategoryGrid('tata-usaha')}
                      </TabsContent>

                      <TabsContent value="tugas-akhir" className="focus:outline-none">
                        {renderLetterCategoryGrid('tugas-akhir')}
                      </TabsContent>
                    </div>
                  </Tabs>
                )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Breadcrumb Navigation Header */}
                <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-slate-200/60 bg-slate-50/80 px-5 py-2.5 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-800/60 print:hidden">
                  <button
                    onClick={() => setActiveServiceId(null)}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-fti-blue-600 dark:text-slate-400 dark:hover:text-fti-blue-400"
                  >
                    <PhHouse className="h-4 w-4" />
                    Layanan Surat
                  </button>
                  <PhCaretRight className="h-3.5 w-3.5 text-slate-400/70 dark:text-slate-500" />
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <SelectedServiceIcon className="h-4 w-4 text-fti-blue-600 dark:text-fti-blue-400" />
                    {selectedService.title}
                  </span>
                </div>

                <div className="print:mt-0">
                  {renderActiveService()}
                </div>
              </div>
            )}
            </div>
          </TabsContent>

          {isTUAdmin && (
            <>
              <TabsContent value="arsip" className="print:m-0 focus:outline-none">
                <LetterArchivePanel refreshKey={letterArchiveRefreshKey} />
              </TabsContent>
              <TabsContent value="arsip-ta" className="print:m-0 focus:outline-none">
                <FinalTaskArchivePanel refreshKey={letterArchiveRefreshKey} />
              </TabsContent>
              <TabsContent value="konfigurasi" className="print:m-0 focus:outline-none">
                <AdminPanel />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default HalamanTU;
