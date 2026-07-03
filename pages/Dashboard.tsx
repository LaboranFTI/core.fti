import React, { useMemo, useState, useEffect } from 'react';
import { Role, BookingStatus, Booking, Room } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  ArrowRight,
  Buildings,
  CalendarCheck,
  ChartBar,
  ChartPieSlice,
  CheckCircle,
  ClipboardText,
  Clock,
  FileText,
  Folders,
  Package,
  ShieldCheck,
  UserCircle,
  UsersThree,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import { Skeleton } from '../components/Skeleton';
import { formatDateID } from '../src/utils/formatters';

interface DashboardProps {
  role: Role;
  onNavigate?: (page: string) => void;
}

type Tone = 'slate' | 'blue' | 'amber' | 'emerald' | 'red';

const toneClasses: Record<Tone, { panel: string; icon: string; accent: string; bar: string }> = {
  slate: {
    panel: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
    icon: 'text-slate-700 dark:text-slate-200',
    accent: 'bg-slate-900 dark:bg-slate-100',
    bar: '#334155',
  },
  blue: {
    panel: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-200',
    icon: 'text-sky-700 dark:text-sky-300',
    accent: 'bg-sky-600',
    bar: '#0369a1',
  },
  amber: {
    panel: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200',
    icon: 'text-amber-700 dark:text-amber-300',
    accent: 'bg-amber-500',
    bar: '#d97706',
  },
  emerald: {
    panel: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200',
    icon: 'text-emerald-700 dark:text-emerald-300',
    accent: 'bg-emerald-600',
    bar: '#059669',
  },
  red: {
    panel: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200',
    icon: 'text-red-700 dark:text-red-300',
    accent: 'bg-red-600',
    bar: '#dc2626',
  },
};

const formatNumber = (value: number | undefined) => (value ?? 0).toLocaleString('id-ID');

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ElementType;
  tone: Tone;
  onClick?: () => void;
  subtext?: string;
}> = ({ title, value, icon: Icon, tone, onClick, subtext }) => {
  const toneClass = toneClasses[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-34 w-full flex-col justify-between overflow-hidden rounded-lg border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] dark:bg-slate-900 ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:hover:border-slate-500' : 'cursor-default'
      } border-slate-200 dark:border-slate-700`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${toneClass.accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className={`flex size-11 items-center justify-center rounded-lg border ${toneClass.panel}`}>
          <Icon className={`h-5 w-5 ${toneClass.icon}`} weight="duotone" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>{subtext || 'Klik untuk membuka detail'}</span>
        {onClick ? <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" weight="bold" /> : null}
      </div>
    </button>
  );
};

const WorkAction: React.FC<{
  title: string;
  icon: React.ElementType;
  tone: Tone;
  onClick: () => void;
  description: string;
}> = ({ title, icon: Icon, tone, onClick, description }) => {
  const toneClass = toneClasses[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-28 w-full items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow] hover:border-slate-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${toneClass.panel}`}>
        <Icon className={`h-5 w-5 ${toneClass.icon}`} weight="duotone" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-950 dark:text-white">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-400">{description}</span>
      </span>
      <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" weight="bold" />
    </button>
  );
};

const SectionHeader: React.FC<{ title: string; description?: string; icon: React.ElementType; action?: React.ReactNode }> = ({
  title,
  description,
  icon: Icon,
  action,
}) => (
  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Icon className="h-4 w-4" weight="duotone" />
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
    </div>
    {action}
  </div>
);

const StatusPill: React.FC<{ status: BookingStatus | string }> = ({ status }) => {
  const isPending = status === BookingStatus.PENDING;
  const isApproved = status === BookingStatus.APPROVED;
  const classes = isPending
    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200'
    : isApproved
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200'
      : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200';

  return <span className={`inline-flex w-fit rounded-md border px-2 py-1 text-xs font-bold ${classes}`}>{status}</span>;
};

const BookingIcon: React.FC<{ status: BookingStatus | string }> = ({ status }) => {
  if (status === BookingStatus.PENDING) return <Clock className="h-4 w-4 text-amber-700 dark:text-amber-300" weight="duotone" />;
  if (status === BookingStatus.APPROVED) return <CheckCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-300" weight="duotone" />;
  return <XCircle className="h-4 w-4 text-red-700 dark:text-red-300" weight="duotone" />;
};

const EmptyState: React.FC<{ text: string; action?: React.ReactNode }> = ({ text, action }) => (
  <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
    <ClipboardText className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" weight="duotone" />
    <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-5">
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-6 h-4 w-32" />
        </div>
      ))}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ role, onNavigate }) => {
  const isLembagaKemahasiswaan = role.toString().toUpperCase() === Role.LEMBAGA_KEMAHASISWAAN.toString().toUpperCase();
  const isDosen = role.toString().toUpperCase() === Role.DOSEN.toString().toUpperCase();
  const isSelfServiceRole = isLembagaKemahasiswaan || isDosen;

  const userName = sessionStorage.getItem('userName') || localStorage.getItem('userName') || 'Pengguna';

  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState({
    activeLoans: 0,
    totalUsers: 0,
    equipment: { total: 0, damaged: 0, good: 0, minor: 0, major: 0 },
    bookings: { total: 0, pending: 0, approved: 0, rejected: 0 },
    roomStats: [] as any[],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const endpoint = isSelfServiceRole ? '/api/dashboard/user-summary' : '/api/dashboard/summary';
        const resSummary = await api(endpoint, { signal });
        if (resSummary.ok) {
          const data = await resSummary.json();
          if (isSelfServiceRole) {
            setDashboardSummary(prev => ({ ...prev, bookings: data.bookings }));
          } else {
            setDashboardSummary(data);
          }
          setRecentBookings(data.recentBookings || []);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Gagal mengambil data dashboard:', error);
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

  const stats = useMemo(() => {
    if (isSelfServiceRole) {
      return {
        totalBookings: 0,
        pendingBookings: 0,
        activeLoans: 0,
        totalUsers: 0,
        damagedEquipment: 0,
        totalEquipment: 0,
        myTotal: dashboardSummary.bookings.total,
        myPending: dashboardSummary.bookings.pending,
        myApproved: dashboardSummary.bookings.approved,
        myRejected: dashboardSummary.bookings.rejected,
      };
    }

    return {
      totalBookings: dashboardSummary.bookings.total,
      pendingBookings: dashboardSummary.bookings.pending,
      activeLoans: dashboardSummary.activeLoans,
      totalUsers: dashboardSummary.totalUsers,
      damagedEquipment: dashboardSummary.equipment.damaged,
      totalEquipment: dashboardSummary.equipment.total,
    };
  }, [isSelfServiceRole, dashboardSummary]);

  const barData = useMemo(() => (isSelfServiceRole ? [] : dashboardSummary.roomStats), [dashboardSummary.roomStats, isSelfServiceRole]);

  const pieData = useMemo(() => {
    if (isSelfServiceRole) return [];
    const { approved, pending, rejected } = dashboardSummary.bookings;
    return [
      { name: 'Disetujui', value: approved, color: '#059669' },
      { name: 'Menunggu', value: pending, color: '#d97706' },
      { name: 'Ditolak', value: rejected, color: '#dc2626' },
    ];
  }, [dashboardSummary.bookings, isSelfServiceRole]);

  const equipmentConditionData = useMemo(() => {
    if (isSelfServiceRole) return [];
    return [
      { name: 'Baik', value: dashboardSummary.equipment.good, color: '#059669' },
      { name: 'Rusak Ringan', value: dashboardSummary.equipment.minor, color: '#d97706' },
      { name: 'Rusak Berat', value: dashboardSummary.equipment.major, color: '#dc2626' },
    ];
  }, [dashboardSummary, isSelfServiceRole]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const pageHeader = (
    <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            <Buildings className="h-4 w-4" weight="duotone" />
            {isSelfServiceRole ? 'Dashboard Personal' : 'Dashboard Operasional'}
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            CORE.FTI
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">Halo, {userName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
            {isSelfServiceRole
              ? 'Status pengajuan, jadwal, dan akses layanan Anda.'
              : `Pengajuan ruangan, peminjaman, inventaris, dan pengguna aktif untuk peran ${role}.`}
          </p>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70 lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Tanggal Kerja</p>
          <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{today}</p>
        </div>
      </div>
    </section>
  );

  if (isSelfServiceRole) {
    return (
      <div className="space-y-5">
        {pageHeader}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Pengajuan" value={formatNumber(stats.myTotal)} icon={FileText} tone="blue" onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} />
          <StatCard title="Menunggu" value={formatNumber(stats.myPending)} icon={Clock} tone="amber" onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} />
          <StatCard title="Disetujui" value={formatNumber(stats.myApproved)} icon={CheckCircle} tone="emerald" onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} />
          <StatCard title="Ditolak" value={formatNumber(stats.myRejected)} icon={XCircle} tone="red" onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <SectionHeader
              title={isDosen ? 'Jadwal Terbaru' : 'Riwayat Pengajuan Terakhir'}
              description="Pengajuan dan jadwal terbaru."
              icon={CalendarCheck}
              action={
                <button onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  {isDosen ? 'Lihat Jadwal' : 'Lihat Semua'}
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </button>
              }
            />
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentBookings.length > 0 ? recentBookings.map((booking) => (
                <div key={booking.id} className="grid gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                      <BookingIcon status={booking.status} />
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-bold text-slate-950 dark:text-white">{booking.purpose}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateID(booking.date)} - {booking.startTime}</p>
                    </div>
                  </div>
                  <StatusPill status={booking.status} />
                </div>
              )) : (
                <EmptyState
                  text={isDosen ? 'Belum ada data jadwal yang dapat ditampilkan di dashboard.' : 'Belum ada riwayat pengajuan.'}
                  action={
                    <button onClick={() => onNavigate?.('ruangan')} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                      {isDosen ? 'Lihat Jadwal Kuliah' : 'Buat Pengajuan'}
                    </button>
                  }
                />
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="px-1 text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Akses Cepat</h2>
            <WorkAction title="Cari Ruangan" icon={Buildings} tone="blue" onClick={() => onNavigate?.('ruangan')} description="Telusuri daftar ruangan, kapasitas, dan fasilitas." />
            <WorkAction title="Cek Jadwal Lab" icon={CalendarCheck} tone="slate" onClick={() => onNavigate?.('jadwal-ruang')} description="Periksa ketersediaan ruangan sebelum pengajuan." />
            <WorkAction title={isDosen ? 'Jadwal Kuliah' : 'Status Pemesanan'} icon={isDosen ? CalendarCheck : ClipboardText} tone="emerald" onClick={() => onNavigate?.(isDosen ? 'jadwal-kuliah' : 'pemesanan-saya')} description={isDosen ? 'Lihat jadwal perkuliahan Anda.' : 'Lihat status pengajuan ruangan.'} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {pageHeader}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Menunggu Verifikasi" value={formatNumber(stats.pendingBookings)} icon={Clock} tone="amber" subtext={`${formatNumber(stats.totalBookings)} total pengajuan`} onClick={() => onNavigate?.('pesanan-ruang')} />
        <StatCard title="Peminjaman Barang" value={formatNumber(stats.activeLoans)} icon={Package} tone="blue" subtext="Sedang dipinjam" onClick={() => onNavigate?.('peminjaman-barang')} />
        <StatCard title="Kondisi Inventaris" value={formatNumber(stats.damagedEquipment)} icon={WarningCircle} tone={stats.damagedEquipment > 0 ? 'red' : 'emerald'} subtext={`${formatNumber(stats.totalEquipment)} total barang`} onClick={() => onNavigate?.('inventaris')} />
        <StatCard title="Total User" value={formatNumber(stats.totalUsers)} icon={UsersThree} tone="slate" subtext="Mahasiswa, dosen, dan staf" onClick={() => onNavigate?.('manajemen-user')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <SectionHeader title="Statistik Penggunaan Ruangan" description="Ruangan dengan aktivitas pemesanan terbanyak." icon={ChartBar} />
          <div className="h-80 p-5">
            {dashboardSummary.roomStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="bookings" fill="#334155" radius={[6, 6, 0, 0]} barSize={36} onClick={() => onNavigate?.('pesanan-ruang')} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="Belum ada data penggunaan ruangan." />
            )}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <SectionHeader title="Status Pengajuan" icon={ChartPieSlice} />
            <div className="h-56 p-4">
              {dashboardSummary.bookings.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value" onClick={() => onNavigate?.('pesanan-ruang')} style={{ cursor: 'pointer' }}>
                      {pieData.map((entry, index) => <Cell key={`booking-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Belum ada data pengajuan." />
              )}
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200 dark:border-slate-700">
              {pieData.map(item => (
                <div key={item.name} className="p-3 text-center">
                  <span className="mx-auto block h-1.5 w-8 rounded-sm" style={{ background: item.color }} />
                  <span className="mt-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <SectionHeader title="Kesehatan Inventaris" icon={ShieldCheck} />
            <div className="h-56 p-4">
              {dashboardSummary.equipment.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={equipmentConditionData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value" onClick={() => onNavigate?.('inventaris')} style={{ cursor: 'pointer' }}>
                      {equipmentConditionData.map((entry, index) => <Cell key={`equipment-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Belum ada data inventaris." />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <SectionHeader
            title="Pengajuan Terbaru"
            description="Daftar permintaan yang terakhir masuk."
            icon={Folders}
            action={
              <button onClick={() => onNavigate?.('pesanan-ruang')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                Lihat Semua
                <ArrowRight className="h-4 w-4" weight="bold" />
              </button>
            }
          />
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentBookings.length > 0 ? recentBookings.map((booking) => (
              <div key={booking.id} className="grid gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                    <BookingIcon status={booking.status} />
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-bold text-slate-950 dark:text-white">{booking.purpose}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{booking.userName} - {formatDateID(booking.date)}</p>
                  </div>
                </div>
                <StatusPill status={booking.status} />
              </div>
            )) : (
              <EmptyState text="Belum ada pengajuan terbaru." />
            )}
          </div>
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <h2 className="px-1 text-sm font-bold uppercase text-slate-500 dark:text-slate-400 sm:col-span-2 xl:col-span-1">Antrian Kerja</h2>
          <WorkAction title="Verifikasi Jadwal" icon={CheckCircle} tone="emerald" onClick={() => onNavigate?.('pesanan-ruang')} description="Setujui atau tolak pengajuan ruangan." />
          <WorkAction title="Input Peminjaman" icon={Package} tone="blue" onClick={() => onNavigate?.('peminjaman-barang')} description="Catat peminjaman barang baru." />
          <WorkAction title="Tambah User" icon={UserCircle} tone="slate" onClick={() => onNavigate?.('manajemen-user')} description="Registrasi pengguna baru." />
          <WorkAction title="Laporan Inventaris" icon={ClipboardText} tone="amber" onClick={() => onNavigate?.('inventaris')} description="Cek stok dan kondisi aset." />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
