import React, { useEffect, useState } from 'react';
import {
  Bell,
  CaretDown,
  Check,
  Checks,
  List,
  Moon,
  SignOut,
  SpinnerGap,
  SunDim,
  Trash,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { Notification } from '../types';
import { APP_NAME } from '../config';
import nocLogo from "../src/assets/NOC.svg";

interface TopBarProps {
  onToggleSidebar: () => void;
  showSidebarToggle: boolean;
  isVisible?: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  pageLabel: string;
  userName: string;
  userEmail: string;
  onLogout: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAllNotifications: () => void;
  onNavigate: (page: string) => void;
  isMaintenanceMode?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ 
  onToggleSidebar, showSidebarToggle, isVisible = true, isDarkMode, toggleDarkMode, pageLabel, userName, userEmail, onLogout, notifications, onMarkAsRead, onMarkAllAsRead, onClearAllNotifications, onNavigate, isMaintenanceMode
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [visibleNotifCount, setVisibleNotifCount] = useState(10);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  const filteredNotifications = notifications.filter(n => {
    if (notifFilter === 'unread') return !n.isRead;
    return true;
  });

  // Reset infinite scroll saat filter berubah atau dropdown dibuka
  useEffect(() => {
    if (isNotifOpen) {
      setVisibleNotifCount(10);
    }
  }, [isNotifOpen, notifFilter]);

  // Handler untuk Infinite Scroll
  const handleNotifScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Jika scroll sudah mendekati bawah (threshold 10px)
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      if (visibleNotifCount < filteredNotifications.length) {
        setVisibleNotifCount(prev => prev + 5);
      }
    }
  };

  return (
    <header className={`mobile-safe-x fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-100 bg-white/90 px-3 shadow-sm shadow-fti-blue-900/5 backdrop-blur-md transition-transform duration-200 print:hidden dark:border-slate-800/60 dark:bg-slate-900/90 dark:shadow-none md:sticky md:h-18 md:px-6 ${
      isVisible ? "translate-y-0" : "-translate-y-full md:translate-y-0"
    }`}>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
        {showSidebarToggle && (
          <button
            onClick={onToggleSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 bg-white/50 text-slate-500 shadow-sm transition-colors hover:border-slate-200 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-white md:hidden"
            aria-label="Toggle Sidebar"
          >
            <List className="h-4.5 w-4.5" weight="bold" />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-fti-blue-100 bg-white/60 shadow-sm shadow-fti-blue-900/5 backdrop-blur-sm dark:border-fti-blue-300/20 dark:bg-slate-950/50 md:size-12 md:rounded-xl">
            <img
              src={nocLogo}
              alt="NOC Logo"
              className="size-7 object-contain md:size-9"
            />
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-black text-slate-900 dark:text-white min-[380px]:text-base md:text-lg lg:text-xl"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {APP_NAME}
            </p>
            <p className="truncate text-[0.62rem] font-medium text-slate-500 dark:text-slate-400 md:hidden">
              {pageLabel}
            </p>
            <p
              className="hidden truncate text-[0.68rem] font-bold uppercase text-slate-500 dark:text-slate-400 md:block"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Sarana dan Prasarana
            </p>
          </div>
        </div>


      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">

        {isMaintenanceMode && (
          <div className="hidden items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300 sm:flex" title="Maintenance Mode Sedang Aktif">
            <WarningCircle className="mr-1.5 h-3.5 w-3.5" weight="duotone" />
            Maintenance
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-fti-blue-100 hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:border-fti-blue-300/20 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" weight={unreadCount > 0 ? 'duotone' : 'regular'} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-slate-950"></span>
              )}
            </button>

            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)}></div>
                <div className="fixed inset-x-3 top-16 z-20 max-h-[calc(100dvh-5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[24rem] sm:max-w-sm">
                  <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-950 dark:text-white">Notifikasi</p>
                        {unreadCount > 0 && <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">{unreadCount}</span>}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button onClick={onMarkAllAsRead} className="flex items-center text-xs font-semibold text-fti-blue-700 transition-colors hover:text-fti-blue-900 dark:text-fti-blue-300 dark:hover:text-fti-blue-200" title="Tandai semua sudah dibaca">
                            <Checks className="mr-1 h-3.5 w-3.5" weight="bold" /> Read All
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button onClick={onClearAllNotifications} className="flex items-center text-xs font-semibold text-slate-500 transition-colors hover:text-red-700 dark:text-slate-400 dark:hover:text-red-300" title="Hapus semua notifikasi">
                            <Trash className="mr-1 h-3.5 w-3.5" weight="bold" /> Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                      <button onClick={() => setNotifFilter('all')} className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${notifFilter === 'all' ? 'bg-white text-fti-blue-700 shadow-sm dark:bg-slate-700 dark:text-fti-blue-200' : 'text-slate-500 hover:text-fti-blue-700 dark:hover:text-fti-blue-200'}`}>
                        Semua
                      </button>
                      <button onClick={() => setNotifFilter('unread')} className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${notifFilter === 'unread' ? 'bg-white text-fti-blue-700 shadow-sm dark:bg-slate-700 dark:text-fti-blue-200' : 'text-slate-500 hover:text-fti-blue-700 dark:hover:text-fti-blue-200'}`}>
                        Belum Dibaca
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[min(24rem,calc(100dvh-13rem))] overflow-y-auto" onScroll={handleNotifScroll}>
                    {filteredNotifications.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">Tidak ada notifikasi {notifFilter === 'unread' ? 'baru' : ''}.</p>
                    ) : (
                      filteredNotifications.slice(0, visibleNotifCount).map(notif => (
                        <div key={notif.id} className={`border-b border-slate-100 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 ${!notif.isRead ? 'bg-fti-blue-50/70 dark:bg-fti-blue-500/10' : ''}`}>
                           <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{notif.title}</p>
                               <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{notif.message}</p>
                               <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{notif.timestamp}</p>
                             </div>
                             {!notif.isRead && (
                               <button onClick={() => onMarkAsRead(notif.id)} className="ml-2 text-fti-blue-600 hover:text-fti-blue-900 dark:text-fti-blue-300 dark:hover:text-fti-blue-200" title="Tandai sudah dibaca">
                                 <Check className="h-4 w-4" weight="bold" />
                               </button>
                             )}
                           </div>
                        </div>
                      ))
                    )}
                    {visibleNotifCount < filteredNotifications.length && (
                      <div className="flex items-center justify-center border-t border-slate-100 py-3 text-center text-slate-400 dark:border-slate-800">
                        <SpinnerGap className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
        </div>

        <button
          onClick={toggleDarkMode}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:bg-fti-blue-50 hover:text-fti-blue-700 dark:text-slate-400 dark:hover:bg-fti-blue-500/10 dark:hover:text-fti-blue-200"
          aria-label="Toggle Dark Mode"
        >
          {isDarkMode ? <SunDim className="h-5 w-5 text-amber-400" weight="duotone" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-full border border-slate-100 bg-white/60 p-1 pr-3 shadow-sm shadow-fti-blue-900/5 transition-all hover:border-fti-blue-100 hover:bg-fti-blue-50/80 dark:border-slate-800/80 dark:bg-slate-900/50 dark:hover:border-fti-blue-300/20 dark:hover:bg-fti-blue-500/10"
            aria-label="User Menu"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fti-blue-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-fti-blue-200/70 dark:bg-fti-blue-300 dark:text-fti-ink dark:ring-fti-blue-300/30">
              {userInitials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="max-w-[7.5rem] truncate text-xs font-bold text-slate-700 dark:text-slate-200">{userName}</p>
            </div>
            <CaretDown className={`hidden h-3 w-3 text-slate-400 transition-transform duration-200 sm:block ${isProfileOpen ? 'rotate-180' : ''}`} weight="bold" />
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
              <div className="fixed inset-x-3 top-16 z-20 overflow-hidden rounded-lg border border-slate-100 bg-white/95 py-1 shadow-lg shadow-slate-950/5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-64">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800/50 dark:bg-slate-900/40">
                  <p className="text-xs font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Sesi Pengguna</p>
                  <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{userName}</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{userEmail}</p>
                </div>
                <button
                   onClick={() => {
                     onNavigate('profil');
                     setIsProfileOpen(false);
                   }}
                   className="flex w-full items-center px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50/80 dark:text-slate-350 dark:hover:bg-slate-900/50 transition-colors"
                >
                   <UserCircle className="mr-2 h-4 w-4 text-slate-400" weight="duotone" /> Profile
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setIsProfileOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-xs font-semibold text-red-650 hover:bg-red-50/50 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors"
                >
                   <SignOut className="mr-2 h-4 w-4" weight="duotone" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
