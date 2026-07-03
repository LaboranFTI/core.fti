import { lazyWithReload } from './lazyWithReload';

export const Dashboard = lazyWithReload(() => import('../../pages/Dashboard'));
export const Ruangan = lazyWithReload(() => import('../../pages/Ruangan'));
export const JadwalRuang = lazyWithReload(() => import('../../pages/JadwalRuang'));
export const PeminjamanBarang = lazyWithReload(() => import('../../pages/PeminjamanBarang'));
export const Acara = lazyWithReload(() => import('../../pages/Acara'));
export const ManajemenLaboran = lazyWithReload(() => import('../../pages/ManajemenLaboran'));
export const ManajemenPKL = lazyWithReload(() => import('../../pages/ManajemenPKL'));
export const Inventaris = lazyWithReload(() => import('../../pages/Inventaris'));
export const PerpindahanBarang = lazyWithReload(() => import('../../pages/PerpindahanBarang'));
export const ManajemenUser = lazyWithReload(() => import('../../pages/ManajemenUser'));
export const PesananRuang = lazyWithReload(() => import('../../pages/PesananRuang'));
export const PemesananSaya = lazyWithReload(() => import('../../pages/PemesananSaya'));
export const Profile = lazyWithReload(() => import('../../pages/Profile'));
export const Settings = lazyWithReload(() => import('../../pages/Settings'));
export const Login = lazyWithReload(() => import('../../pages/Login'));
export const Maintenance = lazyWithReload(() => import('../../pages/Maintenance'));
export const JadwalKuliah = lazyWithReload(() => import('../../pages/JadwalKuliah'));
export const ManajemenSpesifikasi = lazyWithReload(() => import('../../pages/ManajemenSpesifikasi'));
export const Tentang = lazyWithReload(() => import('../../pages/Tentang'));
export const NotFound = lazyWithReload(() => import('../../pages/NotFound'));
export const LabGuard = lazyWithReload(() => import('../../pages/LabGuard'));
export const LayananTU = lazyWithReload(() => import('../../pages_tu/LayananTU'));
export const PublicLetterValidation = lazyWithReload(() => import('../../pages_tu/PublicLetterValidation'));
export const MobileUpload = lazyWithReload(() =>
  import('../../pages_tu/components/MobileUpload').then((module) => ({ default: module.MobileUpload }))
);
export const LecturerManagement = lazyWithReload(() => import('../../pages/ManajemenDosen'));
export const StudyProgramManagement = lazyWithReload(() => import('../../pages/ManajemenProgramStudi'));

export const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);
