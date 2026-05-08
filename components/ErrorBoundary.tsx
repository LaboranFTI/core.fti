import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
    // Update state agar render berikutnya menampilkan UI fallback
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Anda bisa menambahkan service logging di sini (seperti Sentry/Datadog)
    console.error('Terjadi kesalahan pada aplikasi:', error, errorInfo);
    
    // Mengirim informasi error ke backend
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
          endpoint: window.location.pathname // Halaman tempat crash terjadi
        }
      });
    } catch (logErr) {
      console.error('Gagal mengirim log error ke server:', logErr);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-6 font-sans">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Terjadi Kesalahan</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Maaf, aplikasi mengalami gangguan yang tidak terduga saat mencoba merender halaman ini.
            </p>
            {this.state.error && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-left overflow-auto max-h-32 border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-mono text-red-500 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Muat Ulang Halaman
            </button>
          </div>
          <p className="mt-8 text-sm text-gray-400 dark:text-gray-600">CORE.FTI &copy; {new Date().getFullYear()}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;