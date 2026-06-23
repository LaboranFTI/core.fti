import React from 'react';
import { Megaphone } from 'lucide-react';

import { APP_FULL_NAME } from '../config';
import { Notification, Role } from '../types';
import MobileBottomNav from './MobileBottomNav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
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
  announcement: { active: boolean; message: string; type: string } | null;
  notifications: Notification[];
  onCloseSidebar: () => void;
  onToggleSidebar: () => void;
  onToggleSidebarCollapse: () => void;
  toggleDarkMode: () => void;
  onLogout: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAllNotifications: () => void;
  onNavigate: (page: string) => void;
  onMainScroll: (event: React.UIEvent<HTMLElement>) => void;
  children: React.ReactNode;
}

const getAnnouncementClasses = (type: string) => {
  if (type === 'info') {
    return 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  }

  if (type === 'warning') {
    return 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }

  return 'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300';
};

const AppShell: React.FC<AppShellProps> = ({
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
  onCloseSidebar,
  onToggleSidebar,
  onToggleSidebarCollapse,
  toggleDarkMode,
  onLogout,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAllNotifications,
  onNavigate,
  onMainScroll,
  children,
}) => {
  return (
    <div className={`min-h-dvh ${isDarkMode ? 'dark' : ''} bg-gray-50 font-sans transition-colors duration-200 dark:bg-slate-900 print:bg-white`}>
      <TopBar
        onToggleSidebar={onToggleSidebar}
        showSidebarToggle={hasSidebarNavigation}
        isVisible={isMobileTopBarVisible}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        pageLabel={pageLabel}
        userName={userName}
        userEmail={userEmail}
        onLogout={onLogout}
        notifications={notifications}
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
        onClearAllNotifications={onClearAllNotifications}
        onNavigate={onNavigate}
        isMaintenanceMode={isMaintenanceMode}
      />

      <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden pt-14 md:h-[calc(100dvh-4.5rem)] md:pt-0 print:block print:h-auto print:overflow-visible">
        {isSidebarOpen && hasSidebarNavigation && (
          <div
            className="fixed inset-x-0 bottom-0 top-14 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden print:hidden"
            onClick={onCloseSidebar}
          />
        )}

        {hasSidebarNavigation && (
          <Sidebar
            currentRole={currentRole}
            currentPage={currentPage}
            onNavigate={(page) => {
              onNavigate(page);
              onCloseSidebar();
            }}
            isOpen={isSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={onToggleSidebarCollapse}
            onClose={onCloseSidebar}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
          <main
            onScroll={onMainScroll}
            className="flex flex-1 overflow-y-auto overflow-x-hidden print:block print:h-auto print:overflow-visible"
          >
            <div className="mx-auto flex w-full max-w-400 flex-1 flex-col px-3 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] pt-3 sm:px-5 md:px-8 md:pb-10 md:pt-6 lg:px-10 print:max-w-none print:px-0 print:pb-0 print:pt-0">
              {announcement?.active && announcement.message && (
                <div className={`mb-4 flex items-start gap-3 rounded-lg border px-3 py-3 shadow-sm md:mb-6 md:px-4 ${getAnnouncementClasses(announcement.type)}`}>
                  <div className="mt-0.5 rounded-md bg-white/70 p-2 dark:bg-black/10">
                    <Megaphone className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Pemberitahuan Sistem</p>
                    <p className="mt-1 text-sm leading-6">{announcement.message}</p>
                  </div>
                </div>
              )}

              <div className="flex-1 animate-fade-in-up transition-all duration-300">
                {children}
              </div>

              <footer className="mt-10 border-t border-gray-200 pt-6 pb-4 md:pb-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400 print:hidden">
                {APP_FULL_NAME} &copy; {new Date().getFullYear()} Sarana dan Prasarana FTI UKSW. All rights reserved.
              </footer>
            </div>
          </main>

          <MobileBottomNav
            currentRole={currentRole}
            currentPage={currentPage}
            onNavigate={(page) => {
              onNavigate(page);
              onCloseSidebar();
            }}
            onOpenMenu={onToggleSidebar}
            showMenuButton={hasSidebarNavigation}
          />
        </div>
      </div>
    </div>
  );
};

export default AppShell;
