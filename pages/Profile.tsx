import React, { useState, useEffect, useRef } from 'react';
import { Role } from '../types';
import { User, Mail, Phone, Shield, Save, Lock, Building, CreditCard, X, KeyRound, Camera, Calendar, Clock, Activity, Bell, Package } from 'lucide-react';
import { api } from '../services/api';
import Cropper from 'react-easy-crop';

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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header / Cover */}
      <div className="relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="h-40 bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-90"></div>
        <div className="px-6 pb-6">
          <div className="relative flex flex-col sm:flex-row sm:items-end -mt-16 mb-4">
            <div className="relative group" onClick={() => isEditing && fileInputRef.current?.click()}>
              <img src={userData.avatar} alt="Profile" className={`w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg bg-white object-cover ${isEditing ? 'cursor-pointer ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : ''}`} />
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8 text-white" />
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
            <div className="mt-4 sm:mt-0 sm:ml-5 mb-1 flex-1">
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{userData.name}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center">
                <span className="mr-2 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">@{userData.username || '-'}</span>
                <Shield className="w-4 h-4 mr-1 text-blue-500" /> {role}
              </p>
            </div>
            <div className="mt-4 sm:mt-0 ml-auto mb-2 w-full sm:w-auto">
              {!isEditing ? (
                canEditProfile ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                  >
                    Edit Profil
                  </button>
                ) : null
              ) : (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informasi Pribadi</h2>
              {isEditing && (
                <button 
                  onClick={handleSave}
                  className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" /> Simpan Perubahan
                </button>
              )}
            </div>
            
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.name}
                      onChange={e => setUserData({...userData, name: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.username || ''}
                      onChange={e => setUserData({...userData, username: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{role === Role.LEMBAGA_KEMAHASISWAAN || role === Role.MAHASISWA ? 'NIM' : 'NIDN/NIP'}</label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      disabled={!isEditing}
                      value={userData.nim}
                      onChange={e => setUserData({...userData, nim: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email UKSW</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="email" 
                      disabled={!isEditing}
                      value={userData.email}
                      onChange={e => setUserData({...userData, email: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nomor Telepon/WA</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Dynamic Account Info (Dipindah ke kolom kiri agar layout seimbang) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Informasi & Statistik Akun</h2>
            {isLoadingStats ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Akun */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-600/50 flex flex-col justify-center">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-3">
                      <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status Akun</p>
                  </div>
                  <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-800">
                    {stats.status}
                  </span>
                </div>
                
                {/* Terakhir Login */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-600/50 flex flex-col justify-center">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Login Terakhir</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stats.lastLogin}</p>
                </div>
                
                {/* Terakhir Password Diubah */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-600/50 flex flex-col justify-center">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3">
                      <KeyRound className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ubah Sandi</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stats.passwordChanged}</p>
                </div>
                
                {/* Anggota Sejak */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-600/50 flex flex-col justify-center">
                  <div className="flex items-center mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-3">
                      <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Anggota Sejak</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{stats.memberSince}</p>
                </div>

                {/* Total Peminjaman Ruang */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800/50 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg mr-3">
                      <Building className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase mb-0.5">Peminjaman Ruang</p>
                      <p className="text-xl font-bold text-orange-900 dark:text-orange-100">{stats.totalBookings} <span className="text-sm font-normal opacity-80">kali</span></p>
                    </div>
                  </div>
                </div>
                
                {/* Total Peminjaman Barang */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg mr-3">
                      <Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-0.5">Peminjaman Barang</p>
                      <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{stats.totalLoans} <span className="text-sm font-normal opacity-80">item</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Keamanan Akun</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center">
                  <Lock className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Password</p>
                    <p className="text-xs text-gray-500">Ubah password Anda</p>
                  </div>
                </div>
                {canChangePassword ? (
                  <button 
                    onClick={() => setIsChangePasswordOpen(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ubah
                  </button>
                ) : (
                  <span className="text-xs font-medium text-gray-400">Read only</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Aksi Cepat</h2>
            <div className="space-y-3">
              {!isMahasiswa && (
                <button 
                  onClick={() => onNavigate?.('dashboard')}
                  className="w-full flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-all hover:scale-[1.02] group"
                >
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-300 group-hover:text-blue-700 dark:group-hover:text-blue-200">Notifikasi</span>
                  {stats.unreadNotifications > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{stats.unreadNotifications}</span>
                  )}
                </button>
              )}
              {canViewBookingHistory && (
                <button 
                  onClick={() => onNavigate?.('pemesanan-saya')}
                  className="w-full flex items-center p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition-all hover:scale-[1.02] group"
                >
                  <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-3" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-300 group-hover:text-purple-700 dark:group-hover:text-purple-200">Riwayat Peminjaman</span>
                </button>
              )}
              <button 
                onClick={() => onNavigate?.('ruangan')}
                className="w-full flex items-center p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-xl transition-all hover:scale-[1.02] group"
              >
                <Building className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
                <span className="text-sm font-medium text-green-900 dark:text-green-300 group-hover:text-green-700 dark:group-hover:text-green-200">Ruangan Favorit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {canChangePassword && isChangePasswordOpen && (
        <div className="mobile-modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                <KeyRound className="w-5 h-5 mr-2 text-blue-600" />
                Ubah Password
              </h3>
              <button 
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="mobile-modal-body p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Saat Ini</label>
                <input 
                  type="password" required 
                  value={passwordForm.current}
                  onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Baru</label>
                <input 
                  type="password" required 
                  value={passwordForm.new}
                  onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konfirmasi Password Baru</label>
                <input 
                  type="password" required 
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mobile-modal-actions pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all"
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
           <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col h-125">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                 <h3 className="font-bold text-gray-900 dark:text-white">Sesuaikan Foto Profil</h3>
                 <button onClick={() => { setIsCropModalOpen(false); setTempImage(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="w-5 h-5" />
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
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 space-y-4">
                 <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Zoom</span>
                    <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                 </div>
                 <div className="mobile-modal-actions flex justify-end gap-3">
                    <button onClick={() => { setIsCropModalOpen(false); setTempImage(null); }} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                       Batal
                    </button>
                    <button onClick={handleCropSave} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg">
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
