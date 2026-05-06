import React, { useMemo, useState, useEffect } from 'react';
import { Role, BookingStatus, Booking, Loan, Room, AppUser, Equipment } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Users, Calendar, AlertCircle, CheckCircle, Clock, 
  TrendingUp, Activity, ArrowRight, Package, FileText, 
  Shield, AlertTriangle, ChevronRight, Box, XCircle, Megaphone, Info
} from 'lucide-react';
import { api } from '../services/api';
import { Skeleton } from '../components/Skeleton';
import { formatDateID } from '../src/utils/formatters';

interface DashboardProps {
  role: Role;
  onNavigate?: (page: string) => void;
}

const getColorClasses = (color: string) => {
  if (color.includes('blue')) return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' };
  if (color.includes('green')) return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
  if (color.includes('yellow')) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' };
  if (color.includes('red')) return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' };
  if (color.includes('purple')) return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' };
  if (color.includes('orange')) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' };
  return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' };
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string; onClick?: () => void; subtext?: string }> = ({ title, value, icon: Icon, color, onClick, subtext }) => {
  const { bg, text } = getColorClasses(color);
  return (
    <div onClick={onClick} className={`rounded-[1.5rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${onClick ? 'group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
        </div>
        <div className={`rounded-2xl p-3 ${bg} ${onClick ? 'transition-transform group-hover:scale-110' : ''}`}>
          <Icon className={`w-6 h-6 ${text}`} />
        </div>
      </div>
      {subtext && (
        <div className="mt-4 flex items-center text-xs text-gray-500 dark:text-gray-400">
          {subtext}
        </div>
      )}
    </div>
  );
};

const QuickActionCard: React.FC<{ title: string; icon: React.ElementType; color: string; onClick: () => void; description: string }> = ({ title, icon: Icon, color, onClick, description }) => {
    const { bg, text } = getColorClasses(color);
    return (
        <button onClick={onClick} className="group flex h-full w-full flex-col items-start rounded-[1.35rem] border border-gray-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className={`mb-3 rounded-2xl p-3 ${bg} transition-transform group-hover:scale-110`}>
                <Icon className={`w-6 h-6 ${text}`} />
            </div>
            <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </button>
    );
};

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-8 w-40 rounded-full" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 h-32">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 h-80">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-full opacity-50" />
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 h-80">
         <Skeleton className="h-6 w-32 mb-4" />
         <Skeleton className="h-48 w-48 mx-auto rounded-full opacity-50" />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ role, onNavigate }) => {
  const isLembagaKemahasiswaan = role.toString().toUpperCase() === Role.LEMBAGA_KEMAHASISWAAN.toString().toUpperCase();
  const isDosen = role.toString().toUpperCase() === Role.DOSEN.toString().toUpperCase();
  const isSelfServiceRole = isLembagaKemahasiswaan || isDosen;
  
  // Get logged in user ID from storage (set after successful login)
  const LOGGED_IN_USER_ID = sessionStorage.getItem('userId') || localStorage.getItem('userId') || '';
  const userName = sessionStorage.getItem('userName') || localStorage.getItem('userName') || 'Pengguna';

  // Data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState({
    activeLoans: 0,
    totalUsers: 0,
    equipment: { total: 0, damaged: 0, good: 0, minor: 0, major: 0 },
    bookings: { total: 0, pending: 0, approved: 0, rejected: 0 },
    roomStats: [] as any[]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (isSelfServiceRole) {
          // OPTIMASI: User biasa HANYA memanggil data agregasi khusus miliknya
          const [resSummary] = await Promise.all([
            api('/api/dashboard/user-summary', { signal })
          ]);
          if (resSummary.ok) {
            const data = await resSummary.json();
            setDashboardSummary(prev => ({ ...prev, bookings: data.bookings }));
            setRecentBookings(data.recentBookings || []);
          }
        } else {
          // Admin dan Laboran HANYA memanggil data agregasi (sangat ringan)
          const [resSummary] = await Promise.all([
            api('/api/dashboard/summary', { signal })
          ]);
          if (resSummary.ok) {
            const data = await resSummary.json();
            setDashboardSummary(data);
            setRecentBookings(data.recentBookings || []);
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Gagal mengambil data dashboard:", error);
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [isSelfServiceRole]);

  // Calculate Statistics Dynamically
  const stats = useMemo(() => {
    // OPTIMASI: Hentikan kalkulasi berat jika role adalah User
    if (isSelfServiceRole) {
      return { 
        totalBookings: 0, pendingBookings: 0, activeLoans: 0, availableRooms: 0, totalUsers: 0, damagedEquipment: 0, totalEquipment: 0,
        myTotal: dashboardSummary.bookings.total,
        myPending: dashboardSummary.bookings.pending,
        myApproved: dashboardSummary.bookings.approved,
        myRejected: dashboardSummary.bookings.rejected
      };
    }

    const totalBookings = dashboardSummary.bookings.total;
    const pendingBookings = dashboardSummary.bookings.pending;
    const activeLoans = dashboardSummary.activeLoans;
    const availableRooms = 0; // (Dihapus karena tidak dipakai pada UI)
    
    const totalUsers = dashboardSummary.totalUsers;
    const damagedEquipment = dashboardSummary.equipment.damaged;
    const totalEquipment = dashboardSummary.equipment.total;

    return { totalBookings, pendingBookings, activeLoans, availableRooms, totalUsers, damagedEquipment, totalEquipment };
  }, [isSelfServiceRole, dashboardSummary]);

  // Calculate Chart Data
  const barData = useMemo(() => {
      if (isSelfServiceRole) return []; // OPTIMASI: Role self-service tidak render chart ini
      return dashboardSummary.roomStats;
  }, [dashboardSummary.roomStats, isSelfServiceRole]);

  const pieData = useMemo(() => {
      if (isSelfServiceRole) return []; // OPTIMASI: Role self-service tidak render chart ini
      const { approved, pending, rejected } = dashboardSummary.bookings;

      return [
          { name: 'Disetujui', value: approved, color: '#22c55e' },
          { name: 'Pending', value: pending, color: '#f59e0b' },
          { name: 'Ditolak', value: rejected, color: '#ef4444' },
      ];
  }, [dashboardSummary.bookings, isSelfServiceRole]);

  const equipmentConditionData = useMemo(() => {
      if (isSelfServiceRole) return []; // OPTIMASI: Role self-service tidak render chart ini
      return [
          { name: 'Baik', value: dashboardSummary.equipment.good, color: '#22c55e' },
          { name: 'Rusak Ringan', value: dashboardSummary.equipment.minor, color: '#f59e0b' },
          { name: 'Rusak Berat', value: dashboardSummary.equipment.major, color: '#ef4444' },
      ];
  }, [dashboardSummary, isSelfServiceRole]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const pageHeader = (
    <div className="flex flex-col gap-4 rounded-[1.75rem] border border-gray-200/80 bg-white/85 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/70 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          {isSelfServiceRole ? 'Dashboard' : 'Dashboard Admin'}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          {isSelfServiceRole ? `Halo, ${userName}!` : `Halo, ${userName}!`}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400 sm:text-base">
          {isSelfServiceRole
            ? 'Semua aktivitas penting Anda ditampilkan lebih ringkas, sehingga status pengajuan dan akses layanan lebih mudah dipantau.'
            : `Ringkasan aktivitas layanan untuk ${role}, mulai dari pengajuan ruangan hingga kesehatan inventaris.`}
        </p>
      </div>
      <div className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
        {isSelfServiceRole ? '' : 'Hari ini: '}{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );

  // --- RENDER FOR USER (MAHASISWA/DOSEN) ---
  if (isSelfServiceRole) {
    return (
      <div className="space-y-6">
        {pageHeader}

        {/* User Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard 
                title="Total Pengajuan" 
value={stats.myTotal?.toString() || '0'}
                icon={FileText} 
                color="bg-blue-500" 
            onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')}
            />
            <StatCard 
                title="Menunggu" 
value={stats.myPending?.toString() || '0'}
                icon={Clock} 
                color="bg-yellow-500" 
            onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')}
            />
            <StatCard 
                title="Disetujui" 
value={stats.myApproved?.toString() || '0'}
                icon={CheckCircle} 
                color="bg-green-500" 
            onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')}
            />
             <StatCard 
                title="Ditolak" 
value={stats.myRejected?.toString() || '0'}
                icon={XCircle} 
                color="bg-red-500" 
            onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')}
            />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
            {/* Recent Activity (My Bookings) */}
            <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{isDosen ? 'Jadwal Terbaru' : 'Riwayat Pengajuan Terakhir'}</h3>
                <button onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
                        {isDosen ? 'Lihat Jadwal' : 'Lihat Semua'} <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {recentBookings.map((booking) => (
                        <div key={booking.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center space-x-4">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${booking.status === BookingStatus.PENDING ? 'bg-yellow-100 text-yellow-600' : booking.status === BookingStatus.APPROVED ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {booking.status === BookingStatus.PENDING ? <Clock className="w-5 h-5" /> : booking.status === BookingStatus.APPROVED ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.purpose}</p>
                                    <p className="text-xs text-gray-500">{formatDateID(booking.date)} • {booking.startTime}</p>
                                </div>
                            </div>
                            <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${booking.status === BookingStatus.PENDING ? 'bg-yellow-100 text-yellow-800' : booking.status === BookingStatus.APPROVED ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {booking.status}
                            </span>
                        </div>
                    ))}
                    {dashboardSummary.bookings.total === 0 && (
                        <div className="p-8 flex flex-col items-center justify-center text-center">
                            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">{isDosen ? 'Belum ada data jadwal yang dapat ditampilkan di dashboard.' : 'Belum ada riwayat pengajuan.'}</p>
                            <button 
                              onClick={() => onNavigate?.('ruangan')} 
                              className="px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                {isDosen ? 'Lihat Jadwal Kuliah' : 'Buat Pengajuan Sekarang'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
                <h3 className="px-1 text-lg font-bold text-gray-900 dark:text-white">Akses Cepat</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <QuickActionCard title="Cari Ruangan" icon={Calendar} color="bg-blue-500" onClick={() => onNavigate?.('ruangan')} description="Lihat daftar ruangan dan fasilitas." />
                <QuickActionCard title="Cek Jadwal Lab" icon={Clock} color="bg-purple-500" onClick={() => onNavigate?.('jadwal-ruang')} description="Lihat ketersediaan ruangan." />
                <QuickActionCard title={isDosen ? "Jadwal Kuliah" : "Status Pemesanan"} icon={isDosen ? Calendar : FileText} color="bg-green-500" onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} description={isDosen ? "Lihat jadwal perkuliahan Anda." : "Pantau status pengajuan Anda."} />
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- RENDER FOR ADMIN / LABORAN ---
  return (
    <div className="space-y-6">
      {pageHeader}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard 
            title="Menunggu Verifikasi" 
            value={stats.pendingBookings.toString()} 
            icon={Clock} 
            color="bg-yellow-500" 
            subtext={`${stats.totalBookings} Total Pengajuan`}
        onClick={() => onNavigate?.('pesanan-ruang')}
        />
        <StatCard 
            title="Peminjaman Barang" 
            value={stats.activeLoans.toString()} 
            icon={Package} 
            color="bg-blue-500" 
            subtext="Sedang dipinjam"
        onClick={() => onNavigate?.('peminjaman-barang')}
        />
        <StatCard 
            title="Kondisi Inventaris" 
            value={stats.damagedEquipment.toString()} 
            icon={AlertTriangle} 
            color={stats.damagedEquipment > 0 ? "bg-red-500" : "bg-green-500"} 
            subtext="Barang Rusak / Bermasalah"
        onClick={() => onNavigate?.('inventaris')}
        />
        <StatCard 
            title="Total User" 
            value={stats.totalUsers.toString()} 
            icon={Users} 
            color="bg-purple-500" 
            subtext="Mahasiswa & Dosen"
        onClick={() => onNavigate?.('manajemen-user')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        
        {/* Left Column: Charts */}
        <div className="flex flex-col rounded-[1.5rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Statistik Penggunaan Ruangan</h3>
          <div className="flex-1 min-h-75">
        {dashboardSummary.roomStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar 
                    dataKey="bookings" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40} 
                    onClick={() => onNavigate?.('pesanan-ruang')}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                <Activity className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Belum ada data penggunaan ruangan</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Status & Quick Actions */}
        <div className="space-y-6">
            {/* Booking Status Pie */}
            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Status Pengajuan</h3>
              <div className="h-48 flex items-center justify-center">
            {dashboardSummary.bookings.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                    onClick={() => onNavigate?.('pesanan-ruang')}
                    style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-400 dark:text-gray-500">
                    <p className="text-sm">Belum ada data pengajuan</p>
                  </div>
                )}
              </div>
            </div>

            {/* Equipment Condition Pie */}
            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Kesehatan Inventaris</h3>
              <div className="h-48 flex items-center justify-center">
                {dashboardSummary.equipment.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={equipmentConditionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                    onClick={() => onNavigate?.('inventaris')}
                    style={{ cursor: 'pointer' }}
                      >
                        {equipmentConditionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-400 dark:text-gray-500">
                    <p className="text-sm">Belum ada data inventaris</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Bottom Section: Recent & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          {/* Recent Bookings List */}
          <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pengajuan Terbaru</h3>
              <button onClick={() => onNavigate?.('pesanan-ruang')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
                      Lihat Semua <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentBookings.length > 0 ? recentBookings.map((booking) => (
                      <div key={booking.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center space-x-4">
                              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${booking.status === BookingStatus.PENDING ? 'bg-yellow-100 text-yellow-600' : booking.status === BookingStatus.APPROVED ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                  {booking.status === BookingStatus.PENDING ? <Clock className="w-5 h-5" /> : booking.status === BookingStatus.APPROVED ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.purpose}</p>
                                  <p className="text-xs text-gray-500">{booking.userName} • {formatDateID(booking.date)}</p>
                              </div>
                          </div>
                          <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${booking.status === BookingStatus.PENDING ? 'bg-yellow-100 text-yellow-800' : booking.status === BookingStatus.APPROVED ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {booking.status}
                          </span>
                      </div>
                  )) : (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">Belum ada pengajuan terbaru.</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid content-start grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <QuickActionCard title="Verifikasi Jadwal" icon={CheckCircle} color="bg-green-500" onClick={() => onNavigate?.('pesanan-ruang')} description="Setujui atau tolak pengajuan ruangan." />
          <QuickActionCard title="Input Peminjaman" icon={Box} color="bg-blue-500" onClick={() => onNavigate?.('peminjaman-barang')} description="Catat peminjaman barang baru." />
          <QuickActionCard title="Tambah User" icon={Users} color="bg-purple-500" onClick={() => onNavigate?.('manajemen-user')} description="Registrasi pengguna baru." />
          <QuickActionCard title="Laporan Inventaris" icon={FileText} color="bg-orange-500" onClick={() => onNavigate?.('inventaris')} description="Cek stok dan kondisi aset." />
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
