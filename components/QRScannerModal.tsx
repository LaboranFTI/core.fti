import { WarningCircle as AlertCircle, Camera, SpinnerGap as Loader2, QrCode, X } from '@phosphor-icons/react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const selectedCameraIdRef = useRef(selectedCameraId);
  const startScannerRef = useRef<(preferredCameraOverride?: string) => Promise<void>>();
  const stopScannerRef = useRef<() => Promise<void>>();

  // Menyimpan callback terbaru ke dalam ref agar tidak memicu re-render
  const callbacksRef = useRef({ onScanSuccess, onClose, closeOnSuccess });
  useEffect(() => {
    callbacksRef.current = { onScanSuccess, onClose, closeOnSuccess };
  }, [onScanSuccess, onClose, closeOnSuccess]);

  useEffect(() => {
    selectedCameraIdRef.current = selectedCameraId;
  }, [selectedCameraId]);

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

  const syncScannerPresentation = useCallback(() => {
    const container = document.getElementById('scanner-container');
    if (!container) return;

    Array.from(container.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      child.style.width = '100%';
      child.style.height = '100%';
    });

    const shadedRegion = container.querySelector('#qr-shaded-region');
    if (shadedRegion instanceof HTMLElement) {
      shadedRegion.style.display = 'none';
    }

    const mediaElements = container.querySelectorAll('video, canvas');
    mediaElements.forEach((element) => {
      const mediaElement = element as HTMLElement;
      mediaElement.style.width = '100%';
      mediaElement.style.height = '100%';
      mediaElement.style.objectFit = 'cover';
      mediaElement.style.borderRadius = 'inherit';
    });
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

      const preferredCameraId = preferredCameraOverride || selectedCameraIdRef.current || getPreferredCameraId(cameras);
      if (preferredCameraId && preferredCameraId !== selectedCameraIdRef.current) {
        setSelectedCameraId(preferredCameraId);
      }

      const scanConfig = {
        fps: 10,
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
          window.requestAnimationFrame(syncScannerPresentation);
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
  }, [buildCameraCandidates, cleanupScanner, getPreferredCameraId, getScannerErrorMessage, handleClose, stopScanner, syncScannerPresentation]);

  // Sync function refs agar lifecycle effect tidak perlu re-trigger
  useEffect(() => {
    startScannerRef.current = startScanner;
  }, [startScanner]);
  useEffect(() => {
    stopScannerRef.current = stopScanner;
  }, [stopScanner]);

  const handleCameraChange = async (cameraId: string) => {
    setSelectedCameraId(cameraId);
    await startScanner(cameraId);
  };

  // Lifecycle — hanya depend pada isOpen, fungsi diakses via ref
  useEffect(() => {
    if (isOpen) {
      // Delay to ensure modal mounted
      const timer = setTimeout(() => startScannerRef.current?.(), 300);
      return () => clearTimeout(timer);
    } else {
      stopScannerRef.current?.();
      setCameraOptions([]);
      setSelectedCameraId('');
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScannerRef.current?.();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="mobile-modal-shell fixed inset-0 z-1000 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4">
      <div className="mobile-modal-panel bg-white  rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-white/60 ">
        
        {/* Header */}
        <div className="relative overflow-hidden border-b border-slate-200/80  bg-linear-to-r from-slate-50 via-white to-blue-50/70   ">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-linear-to-l from-blue-100/60 to-transparent  " />
          <div className="relative flex items-start justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 via-sky-500 to-cyan-400 text-white shadow-lg shadow-blue-500/25">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="mb-2 font-bold text-xl text-gray-900 ">{title}</h3>
                <p className="text-sm leading-6 text-gray-600 ">
                  Posisikan QR code di dalam bingkai. Scanner akan membaca otomatis saat kode terlihat jelas.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 p-2.5 text-slate-400 transition-all hover:border-slate-300 hover:bg-white hover:text-slate-700      "
              aria-label="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scanner Area */}
        <div className="mobile-modal-body overflow-y-auto bg-linear-to-b from-slate-100 via-slate-50 to-white p-4 sm:p-6   ">
          <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.55)]  ">
              <div className="relative overflow-hidden rounded-[22px] border border-slate-200/70 bg-slate-950 shadow-inner ">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-linear-to-b from-slate-950/70 via-slate-950/20 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-linear-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                <div 
                  id="scanner-container" 
                  className="aspect-square w-full overflow-hidden bg-slate-950 [&>div]:h-full [&>div]:w-full [&_canvas]:h-full [&_canvas]:w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
                />

                {/* Scan overlay */}
                {!error && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6">
                    <div className="relative h-64 w-64 max-w-[78%] max-h-[78%] rounded-[28px] border border-white/35 bg-white/10 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-[2px]">
                      <div className="absolute left-0 top-0 h-12 w-12 rounded-tl-[28px] border-l-4 border-t-4 border-cyan-300" />
                      <div className="absolute right-0 top-0 h-12 w-12 rounded-tr-[28px] border-r-4 border-t-4 border-cyan-300" />
                      <div className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-[28px] border-b-4 border-l-4 border-cyan-300" />
                      <div className="absolute bottom-0 right-0 h-12 w-12 rounded-br-[28px] border-b-4 border-r-4 border-cyan-300" />
                      <div className="h-full w-full rounded-[20px] border border-cyan-300/70 bg-linear-to-b from-cyan-300/15 via-transparent to-blue-500/10" />
                      <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-linear-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.85)]" />
                    </div>
                    <div className="mt-6 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-center backdrop-blur-sm">
                      <p className="text-sm font-semibold text-white sm:text-base">
                        Tempatkan QR code di dalam area bingkai
                      </p>
                      <p className="mt-1 text-xs text-white/75 sm:text-sm">
                        Hindari pantulan cahaya dan jaga kamera tetap stabil agar lebih cepat terbaca.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error state */}
            {error ? (
              <div className="rounded-3xl border border-red-200/80 bg-white p-5 shadow-sm  ">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-500  ">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-900 ">Scanner Error</h4>
                    <p className="mt-1 text-sm leading-6 text-gray-600 ">{error}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => {
                      void startScanner();
                    }}
                    className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-blue-500/35"
                  >
                    Coba Lagi
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200    "
                  >
                    Input Manual
                  </button>
                </div>
              </div>
            ) : !hasCamPermission && !isScanning ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm  ">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600  ">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-slate-900 ">Memulai Scanner</h4>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-600 ">
                    Menunggu akses kamera dari browser dan menyiapkan tampilan scanner di modal ini.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="mobile-modal-actions border-t border-slate-200/80 bg-white/95 p-4  ">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {cameraOptions.length > 1 && (
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3  ">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm  ">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 ">
                  Pilih Kamera
                </p>
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm font-medium text-slate-700 outline-none "
              >
                {cameraOptions.map((camera, index) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || `Kamera ${index + 1}`}
                  </option>
                ))}
              </select>
              </div>
            </div>
          )}
          <button
            onClick={handleClose}
              className="sm:ml-auto rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200    "
          >
            Batal
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
