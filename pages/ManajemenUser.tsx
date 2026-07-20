import React, { useState, useEffect, useMemo } from 'react';
import { AppUser as BaseAppUser } from '../types';
import {
  ArrowsClockwise,
  Check,
  CircleNotch,
  Copy,
  EnvelopeSimple,
  Funnel as Filter,
  Key,
  PencilSimple,
  Plus,
  Trash,
  UserCheck,
  UserMinus,
  Users,
  X,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import { TableSkeleton } from '../components/Skeleton';
import ConfirmModal from '../components/ConfirmModal';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import PageHeader from '../components/PageHeader';
import PageCard from '../components/PageCard';

// Extend AppUser type locally to include phone
type AppUser = BaseAppUser & { phone?: string };
type ResetTokenDialogState = {
  isOpen: boolean;
  title: string;
  description: string;
  token: string;
  expiresAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  emailSent: boolean;
};
type ResetDeliveryDialogState = {
  isOpen: boolean;
  user: AppUser | null;
  sendEmail: boolean;
};
type UserSourceTab = 'internal' | 'sso';
type UserRoleFilter = 'All' | 'Mahasiswa' | 'Lembaga Kemahasiswaan' | 'Dosen' | 'Laboran' | 'Supervisor' | 'Admin TU' | 'User TU';
type UserStatusFilter = 'All' | 'Aktif' | 'Non-Aktif' | 'Reset';

const sourceTabs: Array<{ value: UserSourceTab; label: string; description: string }> = [
  { value: 'internal', label: 'Internal', description: 'Akun lokal sistem' },
  { value: 'sso', label: 'SSO', description: 'Akun terhubung UKSW' },
];

const roleFilterOptions: UserRoleFilter[] = [
  'All',
  'Mahasiswa',
  'Lembaga Kemahasiswaan',
  'Dosen',
  'Laboran',
  'Supervisor',
  'Admin TU',
  'User TU',
];

const statusFilterOptions: UserStatusFilter[] = ['All', 'Aktif', 'Non-Aktif', 'Reset'];

const fieldClassName =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-700/70';

const labelClassName = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400';

const getStatusBadgeClass = (status?: string) => {
  if (status === 'Aktif') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (status === 'Reset') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
};

const getUserInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) || 'US').toUpperCase();
};

interface UserManagementProps {
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ showToast }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRoleFilter>('All');
  const [filterStatus, setFilterStatus] = useState<UserStatusFilter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UserSourceTab>('internal');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formData, setFormData] = useState<Partial<AppUser>>({
    name: '', email: '', username: '', role: 'Mahasiswa', identifier: '', phone: '', status: 'Aktif'
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'warning' | 'info', targetId: '', actionType: ''
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const [resetDeliveryDialog, setResetDeliveryDialog] = useState<ResetDeliveryDialogState>({
    isOpen: false,
    user: null,
    sendEmail: true,
  });
  const [resetTokenDialog, setResetTokenDialog] = useState<ResetTokenDialogState>({
    isOpen: false,
    title: '',
    description: '',
    token: '',
    expiresAt: '',
    userId: '',
    userName: '',
    userEmail: '',
    emailSent: false,
  });
  const [hasCopiedResetToken, setHasCopiedResetToken] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  const openResetTokenDialog = (
    title: string,
    description: string,
    token: string,
    expiresAt: string,
    user?: Pick<AppUser, 'id' | 'name' | 'email'>,
    emailSent = false
  ) => {
    setHasCopiedResetToken(false);
    setResetTokenDialog({
      isOpen: true,
      title,
      description,
      token,
      expiresAt,
      userId: user?.id || '',
      userName: user?.name || '',
      userEmail: user?.email || '',
      emailSent,
    });
  };

  const closeResetTokenDialog = () => {
    setResetTokenDialog(prev => ({ ...prev, isOpen: false }));
    setHasCopiedResetToken(false);
  };

  const copyResetToken = async () => {
    try {
      await navigator.clipboard.writeText(resetTokenDialog.token);
      setHasCopiedResetToken(true);
      showToast('Token reset berhasil disalin.', 'success');
    } catch (error) {
      showToast('Gagal menyalin token reset.', 'error');
    }
  };

  const sendResetTokenEmail = async () => {
    if (!resetTokenDialog.userId || !resetTokenDialog.token) {
      showToast('Data token reset tidak lengkap.', 'error');
      return;
    }

    setIsSendingResetEmail(true);
    try {
      const response = await api(`/api/users/${resetTokenDialog.userId}/reset-password/send-email`, {
        method: 'POST',
        data: { resetToken: resetTokenDialog.token },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengirim email token reset.');
      }

      setResetTokenDialog(prev => ({ ...prev, emailSent: true }));
      showToast(data.message || 'Token reset berhasil dikirim ke email user.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mengirim email token reset.', 'error');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Mengambil data dari backend server dengan filter tipe user
      const response = await api(`/api/users?type=${activeTab}`);
      if (response.ok) {
        const data = await response.json();
        // Filter agar user dengan role ADMIN tidak muncul di list (Hanya bisa dimanipulasi di DB)
        const nonAdminUsers = data.filter((u: AppUser) => u.role !== 'Admin');
        setUsers(nonAdminUsers);
      } else {
        console.error("Gagal mengambil data users");
      }
    } catch (error) {
      console.error("Error koneksi ke server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (user.identifier || '').includes(searchTerm) ||
                            (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === 'All' || user.role === filterRole;
      const matchesStatus = filterStatus === 'All' || user.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(user => user.status === 'Aktif').length,
      reset: users.filter(user => user.status === 'Reset').length,
      inactive: users.filter(user => user.status === 'Non-Aktif').length,
    };
  }, [users]);

  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    paginatedData: currentUsers,
    totalPages,
  } = usePagination(filteredUsers, 10);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus, itemsPerPage, activeTab]);

  const handleOpenModal = (user?: AppUser) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', username: '', role: 'Mahasiswa', identifier: '', phone: '', status: 'Aktif' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedFormData = {
      ...formData,
      name: formData.name?.trim() || '',
      email: formData.email?.trim() || '',
      username: formData.username?.trim() || '',
      identifier: formData.identifier?.trim() || '',
      phone: formData.phone?.trim() || '',
    };

    try {
      if (editingUser) {
        // Update
        const res = await api(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          data: normalizedFormData
        });
        if (res.ok) {
          await res.json();
          fetchUsers();
          showToast("Data user berhasil diperbarui.", "success");
        } else {
          const data = await res.json();
          showToast(data.error || "Gagal menyimpan data user.", "error");
          return;
        }
      } else {
        // Create
        const res = await api('/api/users', {
          method: 'POST',
          data: normalizedFormData
        });
        if (res.ok) {
          const data = await res.json();
          fetchUsers();
          showToast("User baru berhasil ditambahkan.", "success");
          if (data.resetToken) {
            openResetTokenDialog(
              'Token Setup Password',
              'Bagikan token ini ke user agar mereka bisa membuat password pertama kali.',
              data.resetToken,
              data.resetTokenExpiresAt,
              {
                id: data.id || '',
                name: normalizedFormData.name,
                email: normalizedFormData.email,
              }
            );
          }
        } else {
          const data = await res.json();
          showToast(data.error || "Gagal menyimpan data user.", "error");
          return;
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      showToast("Gagal menyimpan data user.", "error");
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus User',
      message: 'Apakah Anda yakin ingin menghapus user ini? Data tidak dapat dikembalikan.',
      type: 'danger',
      targetId: id,
      actionType: 'delete'
    });
  };

  const toggleStatus = async (user: AppUser) => {
      const newStatus = user.status === 'Non-Aktif' ? 'Aktif' : 'Non-Aktif';
      
      try {
        const response = await api(`/api/users/${user.id}/status`, {
          method: 'PUT',
          data: { status: newStatus }
        });

        if (response.ok) {
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
          showToast(`Status user berhasil diubah menjadi ${newStatus}.`, "success");
        } else {
          const data = await response.json();
          showToast(data.error || "Gagal mengubah status user.", "error");
        }
      } catch (error) {
        console.error("Error updating status:", error);
        showToast("Gagal mengubah status user.", "error");
      }
  };

  const handleResetPasswordClick = (user: AppUser) => {
    setResetDeliveryDialog({
      isOpen: true,
      user,
      sendEmail: true,
    });
  };

  const executeResetPassword = async () => {
    const targetUser = resetDeliveryDialog.user;
    if (!targetUser) return;

    setIsConfirming(true);
    try {
      const response = await api(`/api/users/${targetUser.id}/reset-password`, {
        method: 'PUT',
        data: { sendEmail: resetDeliveryDialog.sendEmail },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mereset password.");
      }

      if (data.emailSent) {
        showToast("Token reset password berhasil diterbitkan dan dikirim ke email user.", "success");
      } else if (data.emailError) {
        showToast(data.emailError, "warning");
      } else {
        showToast("Token reset password berhasil diterbitkan.", "success");
      }

      openResetTokenDialog(
        'Token Reset Password',
        'Bagikan token ini ke user agar mereka bisa membuat password baru saat login berikutnya.',
        data.resetToken,
        data.resetTokenExpiresAt,
        targetUser,
        Boolean(data.emailSent)
      );
      fetchUsers();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Terjadi kesalahan saat memproses permintaan.", "error");
    } finally {
      setIsConfirming(false);
      setResetDeliveryDialog({ isOpen: false, user: null, sendEmail: true });
    }
  };

  const executeConfirmAction = async () => {
    setIsConfirming(true);
    try {
      if (confirmModal.actionType === 'delete') {
        const response = await api(`/api/users/${confirmModal.targetId}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Gagal menghapus user.");
        }
        showToast("User berhasil dihapus.", "success");
        fetchUsers();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Terjadi kesalahan saat memproses permintaan.", "error");
    } finally {
      setIsConfirming(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen User"
        description="Kelola data mahasiswa, dosen, dan pengguna sistem lainnya"
        actions={
          <Button onClick={() => handleOpenModal()} variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-2" /> Tambah User
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PageCard className="border-l-4 border-l-slate-900 dark:border-l-slate-200">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total User</p>
          <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{userStats.total}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Seluruh akun {activeTab.toUpperCase()}</p>
        </PageCard>
        <PageCard className="border-l-4 border-l-emerald-500 dark:border-l-emerald-500">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Aktif</p>
          <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{userStats.active}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Status aktif</p>
        </PageCard>
        <PageCard className="border-l-4 border-l-amber-500 dark:border-l-amber-500">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Reset</p>
          <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{userStats.reset}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Menunggu password baru</p>
        </PageCard>
        <PageCard className="border-l-4 border-l-slate-300 dark:border-l-slate-600">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Non-Aktif</p>
          <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{userStats.inactive}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Akun dibatasi akses</p>
        </PageCard>
      </div>

      <PageCard padding="none" className="overflow-hidden">
        {/* Toolbar & Tabs */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col gap-4 print:hidden">
          <div className="grid gap-3 lg:grid-cols-[auto_1fr] items-center">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
              {sourceTabs.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`min-w-[132px] rounded-md px-3 py-2 text-left transition ${
                    activeTab === tab.value
                      ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="block text-sm font-bold">{tab.label}</span>
                  <span className="block text-[11px] leading-4">{tab.description}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
              <div className="min-w-0 flex-1 xl:max-w-md">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Cari nama, NIM, username, atau email..."
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={fetchUsers}
                  disabled={isLoading}
                  variant="outline"
                  size="icon-sm"
                  title="Refresh Data"
                >
                  {isLoading ? <CircleNotch className="w-4 h-4 animate-spin" /> : <ArrowsClockwise className="w-4 h-4" />}
                </Button>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as UserRoleFilter)}
                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none dark:text-slate-200"
                  >
                    {roleFilterOptions.map(option => (
                      <option key={option} value={option}>{option === 'All' ? 'Semua Role' : option}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as UserStatusFilter)}
                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none dark:text-slate-200"
                  >
                    {statusFilterOptions.map(option => (
                      <option key={option} value={option}>{option === 'All' ? 'Semua Status' : option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Direktori Pengguna</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{filteredUsers.length} akun cocok dengan filter saat ini.</p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              Sumber: {activeTab.toUpperCase()}
            </p>
          </div>
        </div>
          <Table className="min-w-[920px] text-left text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6">USER INFO</TableHead>
                <TableHead className="px-6">ROLE & KONTAK</TableHead>
                <TableHead className="px-6">STATUS</TableHead>
                <TableHead className="px-6">LAST LOGIN</TableHead>
                <TableHead className="px-6 text-right">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentUsers.length > 0 ? currentUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {getUserInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-950 dark:text-white">{user.name}</div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            @{user.username || '-'}
                          </span>
                          <span className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            {user.identifier || 'ID belum diisi'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{user.role}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{user.phone || 'Kontak belum diisi'}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold ${getStatusBadgeClass(user.status)}`}>
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {user.lastLogin || '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        onClick={() => toggleStatus(user)}
                        variant="outline"
                        size="icon-xs"
                        aria-label={user.status === 'Non-Aktif' ? `Aktifkan ${user.name}` : `Nonaktifkan ${user.name}`}
                        className={user.status === 'Non-Aktif' ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-300' : 'text-amber-600 hover:text-amber-700 dark:text-amber-300'}
                        title={user.status === 'Non-Aktif' ? 'Aktifkan' : 'Non-aktifkan'}
                      >
                        {user.status === 'Non-Aktif' ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                      </Button>
                      <Button type="button" onClick={() => handleResetPasswordClick(user)} variant="outline" size="icon-xs" aria-label={`Reset password ${user.name}`} className="text-amber-600 hover:text-amber-700 dark:text-amber-300" title="Reset Password">
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button type="button" onClick={() => handleOpenModal(user)} variant="outline" size="icon-xs" aria-label={`Edit ${user.name}`} title="Edit">
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button type="button" onClick={() => handleDeleteClick(user.id)} variant="outline" size="icon-xs" aria-label={`Hapus ${user.name}`} className="text-red-600 hover:text-red-700 dark:text-red-300" title="Hapus">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-14 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <Users className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">Tidak ada user yang ditemukan.</p>
                      <p className="mt-1 text-sm">Coba longgarkan kata kunci atau filter yang dipilih.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

        <div className="border-t border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </PageCard>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
           <div className="flex max-h-[90vh] w-full max-w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-fade-in-up dark:border-slate-700 dark:bg-slate-900 sm:max-w-lg">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                 <div>
                   <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    {editingUser ? 'Edit User' : 'Tambah User Baru'}
                   </h3>
                   <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pastikan identitas dan role sesuai dengan direktori kampus.</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <form onSubmit={handleSave} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                 <div>
                    <label className={labelClassName}>Nama Lengkap</label>
                    <input 
                        type="text" required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className={fieldClassName}
                        placeholder="Nama User"
                    />
                 </div>
                 <div>
                    <label className={labelClassName}>Username</label>
                    <input 
                        type="text" required 
                        value={formData.username || ''} 
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        className={fieldClassName}
                        placeholder="Username unik"
                    />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className={labelClassName}>Role</label>
                        <select 
                            value={formData.role}
                            onChange={e => setFormData({...formData, role: e.target.value as any})}
                            className={fieldClassName}
                        >
                            <option value="Mahasiswa">Mahasiswa</option>
                            <option value="Lembaga Kemahasiswaan">Lembaga Kemahasiswaan</option>
                            <option value="Dosen">Dosen</option>
                            <option value="Laboran">Laboran</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="Admin TU">Admin TU</option>
                            <option value="User TU">User TU</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClassName}>Identifier (NIM/NIDN) <span className="font-normal normal-case tracking-normal text-slate-400">(Opsional)</span></label>
                        <input 
                            type="text" 
                            value={formData.identifier} 
                            onChange={e => setFormData({...formData, identifier: e.target.value})}
                            className={`${fieldClassName} font-mono`}
                            placeholder="672019xxx"
                        />
                    </div>
                 </div>
                 <div>
                    <label className={labelClassName}>Email UKSW</label>
                    <input 
                        type="email" required
                        value={formData.email || ''} 
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className={fieldClassName}
                        placeholder="nama@student.uksw.edu"
                    />
                 </div>
                 <div>
                    <label className={labelClassName}>No. Telepon / WA <span className="font-normal normal-case tracking-normal text-slate-400">(Opsional)</span></label>
                    <input 
                        type="text" 
                        value={formData.phone || ''} 
                        onChange={e => {
                           const val = e.target.value;
                           if (/^\d*$/.test(val)) {
                              setFormData({...formData, phone: val});
                           }
                        }}
                        className={fieldClassName}
                        placeholder="08xxxxxxxx"
                    />
                 </div>
                 <div>
                    <label className={labelClassName}>Status Akun</label>
                    <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className={fieldClassName}
                    >
                        <option value="Aktif">Aktif</option>
                        <option value="Non-Aktif">Non-Aktif</option>
                        <option value="Reset">Reset</option>
                    </select>
                 </div>

                 <div className="mt-2 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline" size="sm">
                       Batal
                    </Button>
                    <Button type="submit" variant="primary" size="sm">
                       <Check className="w-4 h-4 mr-2" /> Simpan
                    </Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {resetDeliveryDialog.isOpen && resetDeliveryDialog.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-fade-in-up dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Terbitkan Token Reset</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  User akan diminta membuat password baru saat login berikutnya.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetDeliveryDialog({ isOpen: false, user: null, sendEmail: true })}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Akun Tujuan</p>
                <p className="mt-2 font-bold text-slate-950 dark:text-white">{resetDeliveryDialog.user.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{resetDeliveryDialog.user.email}</p>
              </div>

              <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={resetDeliveryDialog.sendEmail}
                  onChange={(event) => setResetDeliveryDialog(prev => ({ ...prev, sendEmail: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-900"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">Kirim token ke email user</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">
                    Token tetap akan ditampilkan ke admin setelah diterbitkan, sehingga bisa disalin manual bila diperlukan.
                  </span>
                </span>
              </label>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Token lama akan diganti. Setelah reset, password user dikosongkan sampai user membuat password baru dengan token ini.
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetDeliveryDialog({ isOpen: false, user: null, sendEmail: true })}
                  disabled={isConfirming}
                >
                  Batal
                </Button>
                <Button type="button" variant="primary" onClick={executeResetPassword} disabled={isConfirming}>
                  {isConfirming ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                  Terbitkan Token
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeConfirmAction}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.actionType === 'delete' ? 'Ya, Hapus' : 'Ya, Reset'}
        isLoading={isConfirming}
      />

      {resetTokenDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-fade-in-up dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">{resetTokenDialog.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{resetTokenDialog.description}</p>
              </div>
              <button
                onClick={closeResetTokenDialog}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              {resetTokenDialog.userEmail && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Dikirim Untuk</p>
                  <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{resetTokenDialog.userName || '-'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{resetTokenDialog.userEmail}</p>
                  <div className={`mt-3 inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${
                    resetTokenDialog.emailSent
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {resetTokenDialog.emailSent ? 'Email terkirim' : 'Email belum dikirim'}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Token</p>
                <div className="mt-2 break-all rounded-md border border-slate-200 bg-white px-3 py-3 font-mono text-sm font-semibold text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {resetTokenDialog.token}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Berlaku Sampai</p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                  {new Date(resetTokenDialog.expiresAt).toLocaleString('id-ID')}
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeResetTokenDialog}>
                  Tutup
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={sendResetTokenEmail}
                  disabled={isSendingResetEmail || !resetTokenDialog.userId}
                >
                  {isSendingResetEmail ? <CircleNotch className="w-4 h-4 mr-2 animate-spin" /> : <EnvelopeSimple className="w-4 h-4 mr-2" />}
                  {resetTokenDialog.emailSent ? 'Kirim Ulang Email' : 'Kirim Email'}
                </Button>
                <Button type="button" variant={hasCopiedResetToken ? 'secondary' : 'primary'} onClick={copyResetToken}>
                  <Copy className="w-4 h-4 mr-2" />
                  {hasCopiedResetToken ? 'Token Tersalin' : 'Copy Token'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
