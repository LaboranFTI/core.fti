import React, { useEffect, useRef } from 'react';
import { clearCacheAndReload } from '../router/lazyWithReload';
import { ShowToast } from './useToastMessages';

export const useVersionChecker = (isAuthenticated: boolean, showToast: ShowToast) => {
  const lastEtagRef = useRef('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkVersion = async () => {
      try {
        const response = await fetch('/', { method: 'HEAD', cache: 'no-cache' });
        const currentEtag = response.headers.get('etag') || response.headers.get('last-modified');

        if (lastEtagRef.current && currentEtag && lastEtagRef.current !== currentEtag) {
          showToast(
            <div>
              <p className="mb-2">Versi baru aplikasi tersedia. Harap muat ulang halaman.</p>
              <button
                onClick={clearCacheAndReload}
                className="bg-black/10 hover:bg-black/20 text-current px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
              >
                Refresh Sekarang
              </button>
            </div>,
            'warning',
            true
          );
        }

        if (currentEtag) {
          lastEtagRef.current = currentEtag;
        }
      } catch {
        // Version checks are best-effort and should not interrupt the app.
      }
    };

    checkVersion();
    const versionInterval = setInterval(checkVersion, 15 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(versionInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, showToast]);
};
