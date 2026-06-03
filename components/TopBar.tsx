import React, { useEffect, useState } from 'react';
import { Menu, Moon, Sun, Bell, LogOut, User, ChevronDown, Check, CheckCheck, Loader2, Trash2, AlertTriangle } from 'lucide-react';
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
    <header className={`mobile-safe-x fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white/92 px-3 backdrop-blur-xl transition-transform duration-200 print:hidden dark:border-gray-800 dark:bg-gray-900/92 md:sticky md:h-18 md:px-6 ${
      isVisible ? "translate-y-0" : "-translate-y-full md:translate-y-0"
    }`}>
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        {showSidebarToggle && (
          <button 
            onClick={onToggleSidebar} 
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-3 rounded-2xl px-1 py-1">
          <img
            src={nocLogo}
            alt="NOC Logo"
            className="h-9 w-9 shrink-0 object-contain md:h-10 md:w-10"
          />
          <div className="min-w-0">
            <p className="font-brand truncate text-sm font-bold leading-none text-gray-900 dark:text-white md:text-base">
              {APP_NAME}
            </p>
            <p className="truncate text-[0.68rem] font-medium text-gray-500 dark:text-gray-400 md:hidden">
              {pageLabel}
            </p>
            <p className="hidden truncate text-[0.68rem] font-medium uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 md:block">
              Sarana dan Prasarana
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">

        {isMaintenanceMode && (
          <div className="hidden items-center rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-600 animate-pulse dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 sm:flex" title="Maintenance Mode Sedang Aktif">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Maintenance
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
              )}
            </button>

            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)}></div>
                <div className="absolute right-0 z-20 mt-2 w-[calc(100vw-1.25rem)] max-w-sm overflow-hidden rounded-3xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Notifikasi</p>
                        {unreadCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{unreadCount}</span>}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button onClick={onMarkAllAsRead} className="text-xs flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" title="Tandai semua sudah dibaca">
                            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Read All
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button onClick={onClearAllNotifications} className="text-xs flex items-center text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors" title="Hapus semua notifikasi">
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <button onClick={() => setNotifFilter('all')} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${notifFilter === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        Semua
                      </button>
                      <button onClick={() => setNotifFilter('unread')} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${notifFilter === 'unread' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        Belum Dibaca
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto" onScroll={handleNotifScroll}>
                    {filteredNotifications.length === 0 ? (
                      <p className="text-center py-8 text-gray-500 text-sm">Tidak ada notifikasi {notifFilter === 'unread' ? 'baru' : ''}.</p>
                    ) : (
                      filteredNotifications.slice(0, visibleNotifCount).map(notif => (
                        <div key={notif.id} className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 ${!notif.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                           <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{notif.title}</p>
                               <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notif.message}</p>
                               <p className="text-[10px] text-gray-400 mt-1">{notif.timestamp}</p>
                             </div>
                             {!notif.isRead && (
                               <button onClick={() => onMarkAsRead(notif.id)} className="text-blue-500 hover:text-blue-700 ml-2" title="Tandai sudah dibaca">
                                 <Check className="w-4 h-4" />
                               </button>
                             )}
                           </div>
                        </div>
                      ))
                    )}
                    {visibleNotifCount < filteredNotifications.length && (
                      <div className="py-3 text-center flex justify-center items-center text-gray-400 border-t border-gray-100 dark:border-gray-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
        </div>

        <button 
          onClick={toggleDarkMode} 
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Toggle Dark Mode"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex min-h-11 items-center space-x-2 rounded-2xl px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="User Menu"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D8ABC&color=fff`} alt="Profile" />
            </div>
            <div className="hidden sm:block text-left">
               <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{userName}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-900 dark:text-white font-medium">Signed in as</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                <button 
                   onClick={() => {
                   onNavigate('profil');
                       setIsProfileOpen(false);
                   }}
                   className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                >
                   <User className="w-4 h-4 mr-2" /> Profile
                </button>
                <button 
                  onClick={() => {
                      onLogout();
                      setIsProfileOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                >
                   <LogOut className="w-4 h-4 mr-2" /> Sign out
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
