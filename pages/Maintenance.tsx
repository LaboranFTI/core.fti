import React from 'react';
import { ArrowClockwise, Wrench } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

const Maintenance: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <section className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-100 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            CORE.FTI Maintenance
          </p>
        </div>

        <div className="grid gap-0 md:grid-cols-[120px_1fr]">
          <button
            type="button"
            onDoubleClick={() => navigate('/login')}
            title="Sistem Sedang Dalam Perbaikan"
            className="flex min-h-32 items-center justify-center border-b border-slate-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:border-slate-800 dark:bg-amber-500/10 dark:text-amber-200 md:border-b-0 md:border-r"
          >
            <Wrench size={36} weight="duotone" />
          </button>

          <div className="p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Sistem Sedang Dalam Perbaikan</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Pemeliharaan rutin sedang berjalan untuk menjaga stabilitas layanan. Silakan coba akses kembali setelah
              proses selesai.
            </p>

            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Status akses publik sementara dibatasi. Tim admin tetap dapat memeriksa jalur masuk internal bila
              diperlukan.
            </div>

            <Button onClick={() => window.location.reload()} variant="primary" className="mt-8 w-full justify-center">
              <ArrowClockwise size={18} weight="bold" className="mr-2" />
              Coba Lagi
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Maintenance;
