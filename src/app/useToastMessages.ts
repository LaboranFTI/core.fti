import React, { useCallback, useState } from 'react';
import { ToastMessage } from '../../types';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ShowToast = (message: string | React.ReactNode, type?: ToastType, sticky?: boolean) => void;

export const useToastMessages = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast: ShowToast = useCallback((message, type = 'info', sticky = false) => {
    setToasts((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(),
        message,
        type,
        sticky
      }
    ]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    removeToast
  };
};
