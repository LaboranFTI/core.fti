import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ArrowClockwise, WarningDiamond } from '@phosphor-icons/react';
import { api } from '../services/api';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Terjadi kesalahan pada aplikasi:', error, errorInfo);
    this.logErrorToBackend(error, errorInfo);
  }

  private async logErrorToBackend(error: Error, errorInfo: ErrorInfo) {
    try {
      await api('/api/error-logs', {
        method: 'POST',
        data: {
          errorType: error.name || 'React Crash',
          errorMessage: error.message,
          errorStack: `${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`,
          browserInfo: navigator.userAgent,
          endpoint: window.location.pathname
        }
      });
    } catch (logErr) {
      console.error('Gagal mengirim log error ke server:', logErr);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
          <section className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-red-200 bg-red-50 px-6 py-4 dark:border-red-500/20 dark:bg-red-500/10">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <WarningDiamond size={22} weight="duotone" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-700 dark:text-red-200">
                    Aplikasi Berhenti
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight">Terjadi Kesalahan</h1>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                CORE.FTI mengalami gangguan tidak terduga saat merender halaman ini. Detail error sudah dicoba dikirim
                ke log sistem.
              </p>

              {this.state.error && (
                <pre className="mt-6 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-left text-xs leading-5 text-red-100 dark:border-slate-800">
                  {this.state.error.toString()}
                </pre>
              )}

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <ArrowClockwise size={18} weight="bold" />
                Muat Ulang Halaman
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
