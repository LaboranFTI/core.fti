import React from 'react';
import nocLogo from '../src/assets/noc.png';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-50 px-6 transition-colors duration-500 dark:bg-slate-950">
      <section className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-100 px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Memuat Sistem
          </p>
        </div>

        <div className="p-7 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-fti-blue-600 border-t-transparent dark:border-fti-blue-300 dark:border-t-transparent" />
              <img src={nocLogo} alt="NOC Logo" className="h-14 w-14 object-contain" />
            </div>
          </div>

          <h2 className="mt-6 font-brand text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            CORE.FTI
          </h2>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Sarana dan Prasarana
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Menyiapkan data operasional Fakultas Teknologi Informasi.
          </p>

          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-fti-blue-600 dark:bg-fti-blue-300" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default LoadingScreen;
