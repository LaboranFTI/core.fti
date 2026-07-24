import React, { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Role, Notification } from '../../types';
import AppShell from '../../components/AppShell';
import LoadingScreen from '../../components/LoadingScreen';
import ProtectedRoute from '../../components/ProtectedRoute';
import {
  Acara,
  Dashboard,
  Inventaris,
  JadwalKuliah,
  JadwalRuang,
  LabGuard,
  LayananTU,
  LecturerManagement,
  Login,
  ManajemenLaboran,
  ManajemenPKL,
  ManajemenSpesifikasi,
  ManajemenUser,
  NotFound,
  PageLoader,
  PeminjamanBarang,
  PemesananSaya,
  PerpindahanBarang,
  PesananRuang,
  Profile,
  PublicLetterValidation,
  Ruangan,
  Settings,
  StudyProgramManagement,
  Tentang,
} from './lazyPages';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ShowToast = (message: string | React.ReactNode, type?: ToastType, sticky?: boolean) => void;
type AddNotification = (title: string, message: string, type: ToastType) => void;

interface Announcement {
  active: boolean;
  message: string;
  type: string;
}

interface AppRoutesProps {
  isAuthenticated: boolean;
  currentRole: Role;
  currentPage: string;
  userName: string;
  userEmail: string;
  isDarkMode: boolean;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  isMaintenanceMode: boolean;
  isMobileTopBarVisible: boolean;
  hasSidebarNavigation: boolean;
  pageLabel: string;
  announcement: Announcement | null;
  notifications: Notification[];
  userId: string;
  onLogin: (role: Role, userNameFromLogin?: string, rememberMe?: boolean, emailFromLogin?: string) => void;
  onCloseSidebar: () => void;
  onToggleSidebar: () => void;
  onToggleSidebarCollapse: () => void;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onMarkNotificationAsRead: (id: string) => void;
  onMarkAllNotificationsAsRead: () => void;
  onClearAllNotifications: () => void;
  onNavigate: (page: string) => void;
  onMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  getDefaultRouteForRole: (role: Role | string) => string;
  showToast: ShowToast;
  addNotification: AddNotification;
}

const supervisorRole = 'Supervisor' as Role;
const broadAppRoles = [
  Role.MAHASISWA,
  Role.ADMIN,
  Role.LABORAN,
  Role.LEMBAGA_KEMAHASISWAAN,
  Role.DOSEN,
  supervisorRole,
  Role.ADMIN_TU,
];
const adminOperationalRoles = [Role.ADMIN, Role.LABORAN, supervisorRole];
const profileRoles = broadAppRoles;

const AppRoutes: React.FC<AppRoutesProps> = ({
  isAuthenticated,
  currentRole,
  currentPage,
  userName,
  userEmail,
  isDarkMode,
  isSidebarOpen,
  isSidebarCollapsed,
  isMaintenanceMode,
  isMobileTopBarVisible,
  hasSidebarNavigation,
  pageLabel,
  announcement,
  notifications,
  userId,
  onLogin,
  onCloseSidebar,
  onToggleSidebar,
  onToggleSidebarCollapse,
  onToggleDarkMode,
  onLogout,
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onClearAllNotifications,
  onNavigate,
  onMainScroll,
  getDefaultRouteForRole,
  showToast,
  addNotification,
}) => (
  <Routes>
    <Route path="/tu/validasi-surat/:token" element={
      <Suspense fallback={<LoadingScreen />}>
        <PublicLetterValidation />
      </Suspense>
    } />

    <Route path="/login" element={
      !isAuthenticated ? (
        <Suspense fallback={<LoadingScreen />}>
          <Login
            onLogin={onLogin}
            showToast={showToast}
            isDarkMode={isDarkMode}
            toggleDarkMode={onToggleDarkMode}
          />
        </Suspense>
      ) : (
        <Navigate to={getDefaultRouteForRole(currentRole)} replace />
      )
    } />

    <Route element={
      isAuthenticated ? (
        <AppShell
          currentRole={currentRole}
          currentPage={currentPage}
          userName={userName}
          userEmail={userEmail}
          isDarkMode={isDarkMode}
          isSidebarOpen={isSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          isMaintenanceMode={isMaintenanceMode}
          isMobileTopBarVisible={isMobileTopBarVisible}
          hasSidebarNavigation={hasSidebarNavigation}
          pageLabel={pageLabel}
          announcement={announcement}
          notifications={notifications}
          onCloseSidebar={onCloseSidebar}
          onToggleSidebar={onToggleSidebar}
          onToggleSidebarCollapse={onToggleSidebarCollapse}
          toggleDarkMode={onToggleDarkMode}
          onLogout={onLogout}
          onMarkAsRead={onMarkNotificationAsRead}
          onMarkAllAsRead={onMarkAllNotificationsAsRead}
          onClearAllNotifications={onClearAllNotifications}
          onNavigate={onNavigate}
          onMainScroll={onMainScroll}
        >
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </AppShell>
      ) : (
        <Navigate to="/login" replace />
      )
    }>
      <Route path="/" element={<Navigate to={getDefaultRouteForRole(currentRole)} replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, supervisorRole, Role.ADMIN_TU]} onNavigate={onNavigate}>
          <Dashboard role={currentRole} onNavigate={onNavigate} />
        </ProtectedRoute>
      } />
      <Route path="/jadwal-ruang" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={broadAppRoles} onNavigate={onNavigate}>
          <JadwalRuang role={currentRole} showToast={showToast} isDarkMode={isDarkMode} />
        </ProtectedRoute>
      } />
      <Route path="/ruangan" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={broadAppRoles} onNavigate={onNavigate}>
          <Ruangan role={currentRole} isDarkMode={isDarkMode} onNavigate={onNavigate} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/acara" element={<Acara showToast={showToast} isDarkMode={isDarkMode} />} />
      <Route path="/peminjaman-barang" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={adminOperationalRoles} onNavigate={onNavigate}>
          <PeminjamanBarang showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/manajemen-laboran" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={adminOperationalRoles} onNavigate={onNavigate}>
          <ManajemenLaboran onNavigate={onNavigate} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/manajemen-pkl" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={adminOperationalRoles} onNavigate={onNavigate}>
          <ManajemenPKL showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/inventaris" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.MAHASISWA, Role.ADMIN, Role.LABORAN, Role.LEMBAGA_KEMAHASISWAAN, Role.DOSEN, supervisorRole]} onNavigate={onNavigate}>
          <Inventaris role={currentRole} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/perpindahan-barang" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={adminOperationalRoles} onNavigate={onNavigate}>
          <PerpindahanBarang role={currentRole} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/manajemen-user" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN]} onNavigate={onNavigate}>
          <ManajemenUser showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/manajemen-dosen" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.ADMIN_TU, Role.LABORAN, supervisorRole]} onNavigate={onNavigate}>
          <LecturerManagement showToast={showToast} role={currentRole} />
        </ProtectedRoute>
      } />
      <Route path="/manajemen-program-studi" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.ADMIN_TU]} onNavigate={onNavigate}>
          <StudyProgramManagement showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/pemesanan-saya" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.LEMBAGA_KEMAHASISWAAN, Role.ADMIN_TU]} onNavigate={onNavigate}>
          <PemesananSaya userId={userId} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/pesanan-ruang" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={adminOperationalRoles} onNavigate={onNavigate}>
          <PesananRuang role={currentRole} addNotification={addNotification} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/labguard" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.SUPERVISOR]} onNavigate={onNavigate}>
          <LabGuard />
        </ProtectedRoute>
      } />
      <Route path="/profil" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={profileRoles} onNavigate={onNavigate}>
          <Profile role={currentRole} showToast={showToast} onNavigate={onNavigate} />
        </ProtectedRoute>
      } />
      <Route path="/pengaturan" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN]} onNavigate={onNavigate}>
          <Settings showToast={showToast} onNavigate={onNavigate} />
        </ProtectedRoute>
      } />
      <Route path="/jadwal-kuliah" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.DOSEN, supervisorRole]} onNavigate={onNavigate}>
          <JadwalKuliah role={currentRole} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/manajemen-spesifikasi" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={adminOperationalRoles} onNavigate={onNavigate}>
          <ManajemenSpesifikasi role={currentRole} isDarkMode={isDarkMode} showToast={showToast} />
        </ProtectedRoute>
      } />
      <Route path="/tentang" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={profileRoles} onNavigate={onNavigate}>
          <Tentang />
        </ProtectedRoute>
      } />
      <Route path="/layanan-tu" element={
        <ProtectedRoute currentRole={currentRole} allowedRoles={[Role.ADMIN, Role.LABORAN, Role.DOSEN, supervisorRole, Role.USER_TU, Role.ADMIN_TU]} onNavigate={onNavigate}>
          <LayananTU role={currentRole} />
        </ProtectedRoute>
      } />
    </Route>

    <Route path="*" element={
      <Suspense fallback={<PageLoader />}>
        <NotFound />
      </Suspense>
    } />
  </Routes>
);

export default AppRoutes;
