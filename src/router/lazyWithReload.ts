import { lazy, type ComponentType } from 'react';

export const clearCacheAndReload = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
    }
  }

  window.location.reload();
};

export const lazyWithReload = (componentImport: () => Promise<{ default: ComponentType<any> }>) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error('Versi baru mendeteksi perubahan file:', error);
      if (window.confirm('Versi baru aplikasi tersedia. Halaman perlu dimuat ulang. Lanjutkan?')) {
        clearCacheAndReload();
      }
      return Promise.reject(error);
    }
  });
};
