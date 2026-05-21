import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, QrCode, Loader2, AlertCircle, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  closeOnSuccess?: boolean;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan QR Code",
  closeOnSuccess = false
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasCamPermission, setHasCamPermission] = useState(false);
  const [cameraOptions, setCameraOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Menyimpan callback terbaru ke dalam ref agar tidak memicu re-render
  const callbacksRef = useRef({ onScanSuccess, onClose, closeOnSuccess });
  useEffect(() => {
    callbacksRef.current = { onScanSuccess, onClose, closeOnSuccess };
  }, [onScanSuccess, onClose, closeOnSuccess]);

  const cleanupScanner = useCallback(async (scanner?: Html5Qrcode | null) => {
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (e) {
      console.warn('Scanner stop cleanup:', e);
    }

    try {
      scanner.clear();
    } catch (e) {
      console.warn('Scanner clear cleanup:', e);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    await cleanupScanner(scanner);
    setIsScanning(false);
    setError('');
    setHasCamPermission(false);
  }, [cleanupScanner]);

  // Close handler - FORCE camera stop
  const handleClose = useCallback(async () => {
    await stopScanner();
    callbacksRef.current.onClose();
  }, [stopScanner]);

  const getPreferredCameraId = useCallback((cameras: Array<{ id: string; label: string }>) => {
    if (!cameras.length) return '';

    const rearCamera = cameras.find((camera) =>
      /back|rear|environment|world|traseira|belakang/i.test(camera.label)
    );
    return rearCamera?.id || cameras[0].id;
  }, []);

  const buildCameraCandidates = useCallback((
    cameras: Array<{ id: string; label: string }>,
    preferredCameraId?: string
  ) => {
    const candidates: Array<string | MediaTrackConstraints> = [];
    const seen = new Set<string>();

    const addStringCandidate = (cameraId?: string) => {
      if (!cameraId || seen.has(cameraId)) return;
      seen.add(cameraId);
      candidates.push(cameraId);
    };

    addStringCandidate(preferredCameraId);
    cameras.forEach((camera) => addStringCandidate(camera.id));

    candidates.push(
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'environment' },
      { facingMode: 'user' }
    );

    return candidates;
  }, []);

  const getScannerErrorMessage = useCallback((err: any) => {
    const errorName = err?.name || '';
    const errorMessage = err?.message || '';
    const combined = `${errorName} ${errorMessage}`.toLowerCase();

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'Kamera hanya bisa dipakai lewat HTTPS atau localhost.';
    }

    if (errorName === 'NotAllowedError' || combined.includes('permission') || combined.includes('denied')) {
      return 'Akses kamera ditolak. Izinkan kamera di browser lalu coba lagi.';
    }

    if (errorName === 'NotFoundError' || combined.includes('no cameras found')) {
      return 'Kamera tidak ditemukan di perangkat ini.';
    }

    if (errorName === 'NotReadableError' || combined.includes('could not start video source')) {
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.';
    }

    if (errorName === 'OverconstrainedError' || combined.includes('constraint')) {
      return 'Konfigurasi kamera tidak cocok dengan perangkat ini. Silakan coba kamera lain.';
    }

    return errorMessage || 'Scanner kamera gagal dijalankan.';
  }, []);

  const startScanner = useCallback(async (preferredCameraOverride?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser ini tidak mendukung akses kamera.');
      setIsScanning(false);
      setHasCamPermission(false);
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError('Kamera hanya bisa dipakai lewat HTTPS atau localhost.');
      setIsScanning(false);
      setHasCamPermission(false);
      return;
    }

    if (scannerRef.current) {
      await stopScanner();
    }

    try {
      setError('');
      setIsScanning(true);
      setHasCamPermission(false);

      const container = document.getElementById('scanner-container');
      if (!container) {
        throw new Error('Container scanner belum siap.');
      }

      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) {
        throw new Error('No cameras found');
      }

      setCameraOptions(cameras);

      const preferredCameraId = preferredCameraOverride || selectedCameraId || getPreferredCameraId(cameras);
      if (preferredCameraId && preferredCameraId !== selectedCameraId) {
        setSelectedCameraId(preferredCameraId);
      }

      const scanConfig = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(180, Math.min(280, Math.floor(minEdge * 0.7)));
          return { width: boxSize, height: boxSize };
        },
        disableFlip: false,
      };

      const cameraCandidates = buildCameraCandidates(cameras, preferredCameraId);
      let lastStartError: any = null;

      for (const cameraCandidate of cameraCandidates) {
        const html5QrCode = new Html5Qrcode('scanner-container');
        scannerRef.current = html5QrCode;

        try {
          await html5QrCode.start(
            cameraCandidate,
            scanConfig,
            (decodedText: string) => {
              callbacksRef.current.onScanSuccess(decodedText);
              if (callbacksRef.current.closeOnSuccess) {
                handleClose();
              }
            },
            () => {
              // QR belum terdeteksi, lanjutkan scanning.
            }
          );

          if (typeof cameraCandidate === 'string') {
            setSelectedCameraId(cameraCandidate);
          }

          setHasCamPermission(true);
          return;
        } catch (candidateError: any) {
          lastStartError = candidateError;
          scannerRef.current = null;
          await cleanupScanner(html5QrCode);
        }
      }

      throw lastStartError || new Error('Gagal menjalankan kamera pada perangkat ini.');
    } catch (err: any) {
      setError(getScannerErrorMessage(err));
      console.error('Scanner init error:', err);
      scannerRef.current = null;
      setHasCamPermission(false);
      setIsScanning(false);
    }
  }, [buildCameraCandidates, cleanupScanner, getPreferredCameraId, getScannerErrorMessage, handleClose, selectedCameraId, stopScanner]);

  const handleCameraChange = async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    await startScanner(cameraId);
  };


  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      // Delay to ensure modal mounted
      const timer = setTimeout(startScanner, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      setCameraOptions([]);
      setSelectedCameraId('');
    }
  }, [isOpen, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="mobile-modal-shell fixed inset-0 z-1000 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="mobile-modal-panel bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Arahkan kamera ke QR code
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            aria-label="Close scanner"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="mobile-modal-body relative flex items-center justify-center p-4 sm:p-6 bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800">
          
          <div 
            id="scanner-container" 
            className="w-full max-w-md aspect-square rounded-xl shadow-2xl bg-gray-900 overflow-hidden"
          />

          {/* Scan overlay */}
          {!error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="w-64 h-64 border-4 border-blue-400/50 rounded-2xl p-4 bg-white/30 dark:bg-black/30 backdrop-blur-sm shadow-2xl animate-pulse">
                <div className="w-full h-full border-4 border-blue-500 rounded-xl bg-linear-to-b from-blue-400/20 to-transparent" />
              </div>
              <p className="absolute bottom-12 text-center text-white text-lg font-semibold drop-shadow-2xl">
                Scan QR Code
              </p>
              <p className="absolute bottom-6 text-white/90 text-sm font-medium drop-shadow-lg text-center max-w-xs">
                Arahkan kamera ke QR code di area biru
              </p>
            </div>
          )}

          {/* Error state */}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 rounded-xl">
              <div className="text-center space-y-4 p-8 max-w-sm">
                <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Scanner Error</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      void startScanner();
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all text-sm"
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all text-sm"
                  >
                    Input Manual
                  </button>
                </div>
              </div>
            </div>
          ) : !hasCamPermission && !isScanning ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-xl backdrop-blur-sm">
              <div className="text-center space-y-3 p-8">
                <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto" />
                <p className="text-white text-lg font-semibold drop-shadow-lg">Memulai Scanner</p>
                <p className="text-white/80 text-sm drop-shadow">Menunggu akses kamera...</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mobile-modal-actions p-4 border-t border-gray-200 dark:border-gray-700 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900/50 flex items-center gap-3">
          {cameraOptions.length > 1 && (
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              <Camera className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="max-w-[180px] bg-transparent text-sm text-gray-700 outline-none dark:text-gray-200"
              >
                {cameraOptions.map((camera, index) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || `Kamera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleClose}
            className="px-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors ml-auto"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
