import React, { useState, useEffect, useRef } from 'react';
import { Role } from '../types';
import {
  Bell,
  Building,
  Calendar,
  Camera,
  Clock,
  CreditCard,
  Envelope as Mail,
  FloppyDisk as Save,
  Key as KeyRound,
  Lock,
  Package,
  Phone,
  Pulse as Activity,
  ShieldCheck as Shield,
  User,
  X,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import Cropper from 'react-easy-crop';
import PageCard from '../components/PageCard';

// Helper untuk membuat image object
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

// Helper untuk crop image menggunakan canvas
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg');
}

interface ProfileProps {
  role: Role;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (page: string) => void;
}

interface UserStats {
  status: string;
  lastLogin: string;
  memberSince: string;
  passwordChanged: string;
  totalBookings: number;
  totalLoans: number;
  unreadNotifications: number;
}

const SELF_SERVICE_PROFILE_ROLES: Role[] = [
  Role.MAHASISWA,
  Role.ADMIN,
  Role.LABORAN,
  Role.LEMBAGA_KEMAHASISWAAN,
  Role.DOSEN,
  Role.SUPERVISOR,
  Role.USER_TU,
  Role.ADMIN_TU,
];

const Profile: React.FC<ProfileProps> = ({ role, showToast, onNavigate }) => {
  const isMahasiswa = role.toString().toUpperCase() === Role.MAHASISWA.toString().toUpperCase();
  const hasRoleAccess = SELF_SERVICE_PROFILE_ROLES.some(
    (allowedRole) => allowedRole.toString().toUpperCase() === role.toString().toUpperCase()
  );
  const canEditProfile = hasRoleAccess;
  const canChangePassword = hasRoleAccess;
  const canViewBookingHistory =
    role.toString().toUpperCase() === Role.LEMBAGA_KEMAHASISWAAN.toString().toUpperCase() ||
    role.toString().toUpperCase() === Role.ADMIN_TU.toString().toUpperCase();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    id: '',
    name: '',
    email: '',
    username: '',
    nim: '',
    phone: '',
    avatar: '',
    status: 'Aktif',
    lastLogin: '',
    memberSince: ''
  });
  const [stats, setStats] = useState<UserStats>({
    status: 'Aktif',
    lastLogin: '-',
    memberSince: '-',
    passwordChanged: 'Belum pernah diubah',
    totalBookings: 0,
    totalLoans: 0,
    unreadNotifications: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Crop State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
      if (!userId) return;

      try {
        const res = await api(`/api/users/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setUserData({
            id: data.id,
            name: data.name,
            email: data.email,
            username: data.username,
            nim: data.identifier,
            phone: data.phone,
            avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=0D8ABC&color=fff`,
            status: data.status || 'Aktif',
            lastLogin: data.lastLogin || '-',
            memberSince: data.memberSince || '-'
          });
        }
      } catch (e) {
        console.error("Gagal mengambil profil", e);
      }
    };

    const fetchAccountInfo = async () => {
      const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
      if (!userId) return;

      setIsLoadingStats(true);
      try {
        const res = await api(`/api/users/${userId}/account-info`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            status: data.status || 'Aktif',
            lastLogin: data.lastLogin || 'Belum pernah login',
            memberSince: data.memberSince || '-',
            passwordChanged: data.passwordChanged || 'Belum pernah diubah',
            totalBookings: data.totalBookings || 0,
            totalLoans: data.totalLoans || 0,
            unreadNotifications: data.unreadNotifications || 0
          });
        }
      } catch (e) {
        console.error("Gagal mengambil info akun", e);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchProfile();
    fetchAccountInfo();
  }, []);

  // Password Change State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (tempImage && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(tempImage, croppedAreaPixels);
        setUserData(prev => ({ ...prev, avatar: croppedImage }));
        setIsCropModalOpen(false);
        setTempImage(null);
      } catch (e) {
        console.error(e);
        showToast("Gagal memproses gambar.", "error");
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Limit 2MB
        showToast("Ukuran file maksimal 2MB", "warning");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
        setIsCropModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (/\s/.test(userData.username)) {
      showToast("Username tidak boleh mengandung spasi.", "warning");
      return;
    }

    try {
      const res = await api(`/api/users/${userData.id}`, {
        method: 'PUT',
        data: {
          name: userData.name,
          email: userData.email,
          username: userData.username,
          identifier: userData.nim,
          phone: userData.phone,
          avatar: userData.avatar
        }
      });
      if (res.ok) {
        if (sessionStorage.getItem('userName')) {
          sessionStorage.setItem('userName', userData.name);
        }
        if (localStorage.getItem('userName')) {
          localStorage.setItem('userName', userData.name);
        }
        setIsEditing(false);
        showToast("Profil berhasil diperbarui!", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menyimpan profil.", "error");
      }
    } catch (e) {
      showToast("Gagal menyimpan profil.", "error");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      showToast("Mohon lengkapi semua field password.", "warning");
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      showToast("Password baru dan konfirmasi tidak cocok!", "error");
      return;
    }

    try {
      const res = await api(`/api/users/${userData.id}/change-password`, {
        method: 'PUT',
        data: {
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showToast("Password berhasil diubah!", "success");
        setIsChangePasswordOpen(false);
        setPasswordForm({ current: '', new: '', confirm: '' });
        
        // Update tanggal "Ubah Sandi" pada statistik tampilan secara realtime
        setStats(prev => ({
          ...prev,
          passwordChanged: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        }));
      } else {
        showToast(data.error || "Gagal mengubah password.", "error");
      }
    } catch (error) {
      showToast("Terjadi kesalahan saat mengubah password.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header / Cover */}
      <PageCard padding="none" className="relative overflow-hidden">
        <div className="h-32 border-b border-slate-200 bg-slate-950 dark:border-slate-700 dark:bg-slate-100"></div>
        <div className="px-5 pb-6 sm:px-6">
          <div className="relative mb-4 -mt-14 flex flex-col sm:flex-row sm:items-end">
            <div className="relative group" onClick={() => isEditing && fileInputRef.current?.click()}>
              <img src={userData.avatar} alt="Profile" className={`h-28 w-28 rounded-lg border-4 border-white bg-white object-cover shadow-lg dark:border-slate-900 ${isEditing ? 'cursor-pointer ring-2 ring-slate-700 ring-offset-2 dark:ring-slate-200 dark:ring-offset-slate-900' : ''}`} />
              {isEditing && (
                <div className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-8 w-8 text-white" weight="duotone" />
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>
            <div className="mb-1 mt-4 flex-1 sm:ml-5 sm:mt-0">
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Profil Akun
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{userData.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900">@{userData.username || '-'}</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-300">
                  <Shield className="h-4 w-4" weight="duotone" /> {role}
                </span>
              </p>
            </div>
            <div className="mb-2 ml-auto mt-4 w-full sm:mt-0 sm:w-auto">
              {!isEditing ? (
                canEditProfile ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white sm:w-auto"
                  >
                    Edit Profil
                  </button>
                ) : null
              ) : (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </div>
      </PageCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-2 space-y-6">
          <PageCard padding="lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informasi Pribadi</h2>
              {isEditing && (
                <button 
                  onClick={handleSave}
                  className="flex items-center rounded-lg bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Save className="mr-2 h-4 w-4" weight="duotone" /> Simpan Perubahan
                </button>
              )}
            </div>
            
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" weight="bold" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.name}
                      onChange={e => setUserData({...userData, name: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" weight="bold" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.username || ''}
                      onChange={e => setUserData({...userData, username: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{role === Role.LEMBAGA_KEMAHASISWAAN || role === Role.MAHASISWA ? 'NIM' : 'NIDN/NIP'}</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" weight="bold" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.nim}
                      onChange={e => setUserData({...userData, nim: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email UKSW</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" weight="bold" />
                    <input 
                      type="email" 
                      disabled={!isEditing}
                      value={userData.email}
                      onChange={e => setUserData({...userData, email: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nomor Telepon/WA</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" weight="bold" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.phone}
                      onChange={e => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                          setUserData({...userData, phone: val});
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            </form>
          </PageCard>

          {/* Dynamic Account Info (Dipindah ke kolom kiri agar layout seimbang) */}
          <PageCard padding="lg">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Informasi & Statistik Akun</h2>
            {isLoadingStats ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Akun */}
                <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex items-center mb-2">
                    <div className="mr-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300">
                      <Activity className="h-5 w-5" weight="duotone" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status Akun</p>
                  </div>
                  <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-800">
                    {stats.status}
                  </span>
                </div>
                
                {/* Terakhir Login */}
                <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex items-center mb-2">
                    <div className="mr-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-300">
                      <Clock className="h-5 w-5" weight="duotone" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Login Terakhir</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stats.lastLogin}</p>
                </div>
                
                {/* Terakhir Password Diubah */}
                <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex items-center mb-2">
                    <div className="mr-3 rounded-md border border-red-200 bg-red-50 p-2 text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
                      <KeyRound className="h-5 w-5" weight="duotone" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ubah Sandi</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stats.passwordChanged}</p>
                </div>
                
                {/* Anggota Sejak */}
                <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex items-center mb-2">
                    <div className="mr-3 rounded-md border border-slate-200 bg-white p-2 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <Calendar className="h-5 w-5" weight="duotone" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Anggota Sejak</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stats.memberSince}</p>
                </div>

                {/* Total Peminjaman Ruang */}
                <div className="col-span-1 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/35 sm:col-span-2 lg:col-span-2">
                  <div className="flex items-center">
                    <div className="mr-3 rounded-md border border-amber-200 bg-white/70 p-2 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300">
                      <Building className="h-6 w-6" weight="duotone" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase mb-0.5">Peminjaman Ruang</p>
                      <p className="text-xl font-bold text-orange-900 dark:text-orange-100">{stats.totalBookings} <span className="text-sm font-normal opacity-80">kali</span></p>
                    </div>
                  </div>
                </div>
                
                {/* Total Peminjaman Barang */}
                <div className="col-span-1 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/35 sm:col-span-2 lg:col-span-2">
                  <div className="flex items-center">
                    <div className="mr-3 rounded-md border border-emerald-200 bg-white/70 p-2 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <Package className="h-6 w-6" weight="duotone" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-0.5">Peminjaman Barang</p>
                      <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{stats.totalLoans} <span className="text-sm font-normal opacity-80">item</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </PageCard>
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-6">
          <PageCard padding="lg">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Keamanan Akun</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center">
                  <Lock className="mr-3 h-5 w-5 text-slate-400" weight="duotone" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Password</p>
                    <p className="text-xs text-gray-500">Ubah password Anda</p>
                  </div>
                </div>
                {canChangePassword ? (
                  <button 
                    onClick={() => setIsChangePasswordOpen(true)}
                    className="text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  >
                    Ubah
                  </button>
                ) : (
                  <span className="text-xs font-medium text-gray-400">Read only</span>
                )}
              </div>
            </div>
          </PageCard>

          {/* Quick Actions */}
          <PageCard padding="lg">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Aksi Cepat</h2>
            <div className="space-y-3">
              {!isMahasiswa && (
                <button 
                  onClick={() => onNavigate?.('dashboard')}
                  className="group flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:hover:bg-slate-900"
                >
                  <Bell className="mr-3 h-5 w-5 text-slate-500" weight="duotone" />
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">Notifikasi</span>
                  {stats.unreadNotifications > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{stats.unreadNotifications}</span>
                  )}
                </button>
              )}
              {canViewBookingHistory && (
                <button 
                  onClick={() => onNavigate?.('pemesanan-saya')}
                  className="group flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:hover:bg-slate-900"
                >
                  <Calendar className="mr-3 h-5 w-5 text-slate-500" weight="duotone" />
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">Riwayat Peminjaman</span>
                </button>
              )}
              <button 
                onClick={() => onNavigate?.('ruangan')}
                className="group flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:hover:bg-slate-900"
              >
                <Building className="mr-3 h-5 w-5 text-slate-500" weight="duotone" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">Ruangan Favorit</span>
              </button>
            </div>
          </PageCard>
        </div>
      </div>

      {/* Change Password Modal */}
      {canChangePassword && isChangePasswordOpen && (
        <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="mobile-modal-panel flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 animate-fade-in-up dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <h3 className="flex items-center font-bold text-slate-950 dark:text-white">
                <KeyRound className="mr-2 h-5 w-5 text-slate-600 dark:text-slate-300" weight="duotone" />
                Ubah Password
              </h3>
              <button 
                onClick={() => setIsChangePasswordOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="mobile-modal-body p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Saat Ini</label>
                <input 
                  type="password" required 
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Baru</label>
                <input 
                  type="password" required 
                  value={passwordForm.new}
                  onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konfirmasi Password Baru</label>
                <input 
                  type="password" required 
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 focus:ring-3 focus:ring-slate-400/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-slate-300"
                />
              </div>
              <div className="mobile-modal-actions pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {isCropModalOpen && tempImage && (
        <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
           <div className="mobile-modal-panel flex h-125 w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                 <h3 className="font-bold text-slate-950 dark:text-white">Sesuaikan Foto Profil</h3>
                 <button onClick={() => { setIsCropModalOpen(false); setTempImage(null); }} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Tutup modal">
                    <X className="h-5 w-5" weight="bold" />
                 </button>
              </div>
              <div className="relative flex-1 bg-black">
                 <Cropper
                    image={tempImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                 />
              </div>
              <div className="space-y-4 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                 <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Zoom</span>
                    <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                 </div>
                 <div className="mobile-modal-actions flex justify-end gap-3">
                    <button onClick={() => { setIsCropModalOpen(false); setTempImage(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                       Batal
                    </button>
                    <button onClick={handleCropSave} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                       Simpan Foto
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
