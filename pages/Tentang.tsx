import React, { useState } from 'react';
import {
  Buildings,
  Code,
  Envelope,
  GithubLogo,
  Info,
  LinkedinLogo,
  MapPin,
  Phone,
  SealCheck,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import confetti from 'canvas-confetti';

import PageCard from '../components/PageCard';
import PageHeader from '../components/PageHeader';
import { APP_FULL_NAME, APP_NAME, APP_VERSION } from '../config';
import ftiLogo from "../src/assets/FTI.svg";
import nocLogo from "../src/assets/NOC.svg";
import ukswLogo from "../src/assets/UKSW.svg";

const responsibilities = [
  'Mengelola peminjaman ruangan dan peralatan',
  'Memastikan peralatan laboratorium siap pakai',
  'Memberikan dukungan teknis untuk praktikum dan acara fakultas',
  'Mengelola inventaris serta spesifikasi software laboratorium',
];

const features = [
  {
    title: 'Peminjaman Ruangan',
    description: 'Pengajuan ruang, status verifikasi, dan bukti persetujuan dalam satu alur.',
    icon: MapPin,
  },
  {
    title: 'Manajemen Inventaris',
    description: 'Aset, unit, spesifikasi, dan kondisi barang tercatat lebih terstruktur.',
    icon: SealCheck,
  },
  {
    title: 'Jadwal Operasional',
    description: 'Jadwal ruang, kuliah, dan acara dapat dibaca tanpa berpindah konteks.',
    icon: Buildings,
  },
];

const developers = [
  {
    initials: 'FFA',
    name: 'Firmandez Febrian Afandy',
    role: 'Full Stack Developer',
    cohort: 'Laboran Mahasiswa Angkatan 2022',
    description: `Bertanggung jawab penuh dalam pengembangan sistem ${APP_NAME} dari awal hingga akhir.`,
    github: 'https://github.com/Firmandez',
    linkedin: 'https://linkedin.com/in/firmandezfebrian',
    email: 'mailto:firmandez10@gmail.com',
  },
  {
    initials: 'NCP',
    name: 'Nauval Caesaro Premana',
    role: 'DevOps',
    cohort: 'Laboran Mahasiswa Angkatan 2021',
    description: 'Membantu hosting, deployment, dan optimasi web server.',
    github: 'https://github.com/caesaro',
    linkedin: 'https://linkedin.com/in/nauvalcaesaropremana',
    email: 'mailto:nauvalpremana@gmail.com',
  },
];

const Tentang: React.FC = () => {
  const [nocClicks, setNocClicks] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showEasterEggModal, setShowEasterEggModal] = useState(false);

  const handleNocClick = () => {
    const newClicks = nocClicks + 1;
    setNocClicks(newClicks);

    if (newClicks === 5) {
      setIsSpinning(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 9999
      });

      setTimeout(() => {
        setShowEasterEggModal(true);
      }, 300);

      setTimeout(() => {
        setIsSpinning(false);
        setNocClicks(0);
      }, 3000);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Tentang CORE.FTI"
        description={`${APP_FULL_NAME} adalah ruang kerja sarana dan prasarana FTI UKSW untuk peminjaman, inventaris, layanan administrasi, dan jadwal operasional.`}
      />

      <PageCard padding="lg" className="overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <Info className="h-4 w-4" weight="duotone" />
              Ringkasan Sistem
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">{APP_NAME}</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <p>
                <span className="font-bold text-slate-900 dark:text-white">{APP_NAME}</span> membantu mahasiswa, dosen, laboran, dan unit tata usaha mengelola aktivitas sarpras FTI UKSW secara lebih tertib.
              </p>
              <p>
                Sistem ini menghubungkan pemesanan ruangan, ketersediaan fasilitas, inventaris, layanan administrasi, dan pelacakan status agar pekerjaan operasional tidak tersebar di banyak tempat.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex items-center justify-center gap-4">
              <a href="https://www.uksw.edu" target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-200 bg-white p-2 transition-transform hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900" title="Kunjungi Website UKSW">
                <img src={ukswLogo} alt="UKSW Logo" className="h-10 w-auto object-contain" />
              </a>
              <a href="https://fti.uksw.edu" target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-200 bg-white p-2 transition-transform hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900" title="Kunjungi Website FTI UKSW">
                <img src={ftiLogo} alt="FTI Logo" className="h-10 w-auto object-contain" />
              </a>
              <button
                type="button"
                onClick={handleNocClick}
                className={`rounded-md border border-slate-200 bg-white p-2 outline-none transition-transform hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 ${isSpinning ? 'animate-spin' : ''}`}
                title="Tim NOC"
              >
                <img src={nocLogo} alt="NOC Logo" className="h-10 w-10 object-contain" />
              </button>
            </div>
            <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Versi Sistem</p>
              <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{APP_VERSION}</p>
              <span className="mt-3 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300">
                <span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />
                Sistem Aktif
              </span>
            </div>
          </div>
        </div>
      </PageCard>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <PageCard key={feature.title} className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-slate-900 dark:bg-slate-100" />
              <div className="pl-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <Icon className="h-5 w-5" weight="duotone" />
                </div>
                <h3 className="mt-4 font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{feature.description}</p>
              </div>
            </PageCard>
          );
        })}
      </div>

      <PageCard padding="lg">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <UsersThree className="h-5 w-5" weight="duotone" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">Laboran FTI UKSW Sarpras</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Tim laboran dan admin mengelola fasilitas, peralatan, dukungan teknis, serta administrasi sarpras agar kegiatan akademik dan operasional berjalan tertib.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" weight="bold" /> Gedung FTI UKSW, Ruang 227</span>
              <span className="inline-flex items-center gap-2"><Envelope className="h-4 w-4" weight="bold" /> fti.laboran@adm.uksw.edu</span>
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" weight="bold" /> (0298) 321212</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {responsibilities.map((item, index) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-950 text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                  {index + 1}
                </span>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </PageCard>

      <PageCard padding="lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Code className="h-5 w-5" weight="duotone" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">Pengembang</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tim internal yang membangun dan menjaga sistem.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {developers.map((developer) => (
            <div key={developer.name} className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-950 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                  {developer.initials}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-950 dark:text-white">{developer.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{developer.role}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{developer.cohort}</p>
                </div>
              </div>
              <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">{developer.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={developer.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <GithubLogo className="mr-1.5 h-4 w-4" weight="bold" /> GitHub
                </a>
                <a href={developer.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <LinkedinLogo className="mr-1.5 h-4 w-4" weight="bold" /> LinkedIn
                </a>
                <a href={developer.email} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Envelope className="mr-1.5 h-4 w-4" weight="bold" /> Email
                </a>
              </div>
            </div>
          ))}
        </div>
      </PageCard>

      {showEasterEggModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setShowEasterEggModal(false)}
              className="absolute right-4 top-4 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Tutup modal"
            >
              <X className="h-5 w-5" weight="bold" />
            </button>
            <h3 className="text-xl font-bold text-slate-950 dark:text-white">DOR!</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Kamu baru aja nemuin Easter Egg.
            </p>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/70 dark:bg-blue-950/35">
              <p className="text-sm font-semibold italic text-blue-800 dark:text-blue-300">
                "Segabut itu ya ngeklik logo NOC sampai 5 kali?"
              </p>
            </div>
            <button
              onClick={() => setShowEasterEggModal(false)}
              className="mt-6 w-full rounded-lg bg-slate-950 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tentang;
