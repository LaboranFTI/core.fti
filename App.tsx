import React, { Suspense } from 'react';
import Toast from './components/Toast';
import LoadingScreen from './components/LoadingScreen';
import { GoogleAuthProvider } from './src/context/GoogleAuthContext';
import { BrowserRouter as Router, useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import AppRoutes from './src/router/AppRoutes';
import { getNavigationLabel, getNavigationItemById } from './lib/navigation';
import { Maintenance, MobileUpload, PublicLetterValidation } from './src/router/lazyPages';
const PublicValidationHome = React.lazy(() => import('./pages_tu/PublicValidationHome'));
import { useAuthSession } from './src/app/useAuthSession';
import { useNotifications } from './src/app/useNotifications';
import { useShellState } from './src/app/useShellState';
import { useSystemStatus } from './src/app/useSystemStatus';
import { useThemeMode } from './src/app/useThemeMode';
import { useToastMessages } from './src/app/useToastMessages';
import { useVersionChecker } from './src/app/useVersionChecker';
import { canBypassMaintenance, getDefaultRouteForRole, isRoleMatch } from './src/app/roles';
import { getStorageItem } from './src/app/storage';
import { Role } from './types';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, showToast, removeToast } = useToastMessages();
  const { isLoading, setIsLoading, isMaintenanceMode, announcement } = useSystemStatus();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isMobileTopBarVisible,
    handleMainScroll
  } = useShellState();
  const {
    isAuthenticated,
    currentRole,
    userName,
    userEmail,
    handleLogin,
    handleLogout
  } = useAuthSession({ navigate, setIsLoading, showToast });
  const {
    notifications,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications
  } = useNotifications(isAuthenticated, showToast);

  useVersionChecker(isAuthenticated, showToast);

  const currentPage = location.pathname.substring(1) || getDefaultRouteForRole(currentRole).replace('/', '');
  const hasSidebarNavigation = !isRoleMatch(currentRole, Role.USER_TU);
  const pageLabel = getNavigationLabel(currentPage);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const queryParams = new URLSearchParams(location.search);
  const uploadSessionId = queryParams.get('uploadSession');
  if (uploadSessionId) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <MobileUpload sessionId={uploadSessionId} />
      </Suspense>
    );
  }

  const isPublicLetterValidationRoute = location.pathname.startsWith('/tu/validasi-surat/');
  if (isMaintenanceMode && !canBypassMaintenance(currentRole) && !isPublicLetterValidationRoute && location.pathname !== '/login') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Maintenance />
      </Suspense>
    );
  }

  const handleNavigate = (page: string) => {
    const navItem = getNavigationItemById(page);
    if (navItem?.url) {
      window.open(navItem.url, '_blank', 'noopener,noreferrer');
    } else if (page.startsWith('http://') || page.startsWith('https://')) {
      window.open(page, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`/${page}`);
    }
  };

  return (
    <div>
      <AppRoutes
        isAuthenticated={isAuthenticated}
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
        userId={getStorageItem('userId') || ''}
        onLogin={handleLogin}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleSidebarCollapse={toggleSidebarCollapse}
        onToggleDarkMode={toggleDarkMode}
        onLogout={handleLogout}
        onMarkNotificationAsRead={markNotificationAsRead}
        onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
        onClearAllNotifications={clearAllNotifications}
        onNavigate={handleNavigate}
        onMainScroll={handleMainScroll}
        getDefaultRouteForRole={getDefaultRouteForRole}
        showToast={showToast}
        addNotification={addNotification}
      />

      <Toast toasts={toasts} removeToast={removeToast} isDarkMode={isDarkMode} />
    </div>
  );
};

const App: React.FC = () => {
  let validationDomain = '';
  const validationUrl = import.meta.env.VITE_PUBLIC_VALIDATION_URL;
  if (validationUrl) {
    try {
      validationDomain = new URL(validationUrl).hostname;
    } catch (e) {
      console.error('Invalid VITE_PUBLIC_VALIDATION_URL:', e);
    }
  }
  
  // Hanya kunci route jika domain validasi disetel dan diakses via domain tersebut,
  // ATAU jika diakses melalui port 5001 di localhost untuk keperluan testing.
  const isValidationDomain = 
    (validationDomain && window.location.hostname === validationDomain) ||
    (window.location.hostname === 'localhost' && window.location.port === '5001') ||
    (window.location.hostname === '127.0.0.1' && window.location.port === '5001');

  if (isValidationDomain) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/tu/validasi-surat/:token" element={<PublicLetterValidation />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/" element={<PublicValidationHome />} />
          </Routes>
        </Suspense>
      </Router>
    );
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GoogleAuthProvider>
        <AppContent />
      </GoogleAuthProvider>
    </Router>
  );
};

export default App;
