import React from 'react';
import nocLogo from '../src/assets/noc.png';

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return false;

  const saved = window.localStorage.getItem('isDarkMode');
  if (saved !== null) return saved === 'true';

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const LoadingScreen: React.FC = () => {
  const isInitiallyDark = getInitialDarkMode();

  return (
    <div className={`fixed inset-0 z-50 flex min-h-dvh items-center justify-center px-6 transition-colors duration-300 ${
      isInitiallyDark
        ? 'bg-slate-950 text-slate-100'
        : 'bg-slate-50 text-slate-950'
    } dark:bg-slate-950 dark:text-slate-100`}>
      <section
        className="flex min-w-0 flex-col items-center"
        role="status"
        aria-live="polite"
        aria-label="Memuat CORE.FTI"
      >
        <div className="relative flex size-24 items-center justify-center sm:size-28">
          <div className="absolute inset-0 rounded-full border border-slate-200 dark:border-slate-800" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[var(--brand-blue)] border-t-[var(--brand-blue)]" />
          <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:size-18">
            <img src={nocLogo} alt="CORE.FTI" className="size-11 object-contain sm:size-12" />
          </div>
        </div>

        <h1 className="mt-5 font-brand text-xl font-semibold tracking-wide sm:text-2xl">
          CORE.FTI
        </h1>

        <div className="mt-5 h-1 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--brand-blue)]" />
        </div>
      </section>
    </div>
  );
};

export default LoadingScreen;
