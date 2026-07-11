import { useCallback, useEffect, useState } from 'react';
import { Notification } from '../../types';
import { api } from '../../services/api';
import { ShowToast, ToastType } from './useToastMessages';

export const useNotifications = (isAuthenticated: boolean, showToast: ShowToast) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let notificationInterval: NodeJS.Timeout;

    const fetchNotifications = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await api('/api/notifications');
        if (response.ok) {
          setNotifications(await response.json());
        }
      } catch {
        // Silent fail for notifications.
      }
    };

    if (isAuthenticated) {
      fetchNotifications();
      notificationInterval = setInterval(fetchNotifications, 10000);
    }

    return () => {
      if (notificationInterval) clearInterval(notificationInterval);
    };
  }, [isAuthenticated]);

  const addNotification = useCallback((title: string, message: string, type: ToastType) => {
    setNotifications((prev) => [
      {
        id: Date.now().toString(),
        title,
        message,
        type,
        timestamp: 'Baru saja',
        isRead: false
      },
      ...prev
    ]);
  }, []);

  const markNotificationAsRead = useCallback(async (id: string) => {
    try {
      const response = await api(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      setNotifications((prev) => prev.map((notification) => (
        notification.id === id ? { ...notification, isRead: true } : notification
      )));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      const response = await api('/api/notifications/read-all', { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
    } catch (error) {
      console.error('Gagal mark all read', error);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      const response = await api('/api/notifications', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear notifications');
      setNotifications([]);
      showToast('Semua notifikasi berhasil dihapus.', 'success');
    } catch (error) {
      console.error('Gagal hapus notifikasi', error);
    }
  }, [showToast]);

  return {
    notifications,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications
  };
};
