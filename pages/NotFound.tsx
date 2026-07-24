import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, House, MagnifyingGlass } from '@phosphor-icons/react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-6 py-12 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <section className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-0 md:grid-cols-[1fr_220px]">
          <div className="border-b border-slate-200 p-8 dark:border-slate-800 md:border-b-0 md:border-r">
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <MagnifyingGlass size={22} weight="duotone" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Navigasi
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">Halaman Tidak Ditemukan</h1>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              URL yang dibuka tidak terdaftar di CORE.FTI. Periksa kembali alamat halaman atau kembali ke dashboard
              operasional.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <House size={18} weight="bold" />
                Ke Halaman Utama
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft size={18} weight="bold" />
                Kembali
              </button>
            </div>
          </div>

          <aside className="flex flex-col justify-between bg-slate-100 p-8 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Kode
            </p>
            <p className="mt-8 font-brand text-7xl font-semibold leading-none text-slate-950 dark:text-white">404</p>
            <div className="mt-8 h-1.5 w-20 rounded-full bg-amber-500" />
          </aside>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
