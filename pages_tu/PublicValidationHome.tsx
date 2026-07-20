import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScannerModal from '../components/QRScannerModal';
import { QrCode, ShieldCheck, FileMagnifyingGlass } from '@phosphor-icons/react';
import nocLogo from '../src/assets/NOC.svg';
import ukswLogo from '../src/assets/UKSW.png';
import ftiLogo from '../src/assets/FTI.png';

const PublicValidationHome: React.FC = () => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const navigate = useNavigate();

  const handleScanSuccess = (decodedText: string) => {
    try {
      const url = new URL(decodedText);
      if (url.pathname.includes('/tu/validasi-surat/')) {
        navigate(url.pathname);
      } else {
        alert('QR Code tidak dikenali sebagai surat FTI yang valid.');
      }
    } catch (e) {
      alert('QR Code tidak valid.');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-between bg-slate-50 p-6 text-center font-sans ">
      
      {/* Top Header - Logos */}
      <div className="w-full max-w-5xl flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <img src={ukswLogo} alt="UKSW" className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm" />
          <div className="h-8 w-px bg-slate-300 "></div>
          <img src={ftiLogo} alt="FTI" className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm" />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold tracking-widest text-slate-700 ">CORE.FTI</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 ">Sistem Arsip Terpadu</p>
          </div>
          <img src={nocLogo} alt="NOC" className="h-8 sm:h-10 w-auto object-contain opacity-90" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-lg">
        <div className="relative mb-8">
          <div className="absolute -inset-4 rounded-full bg-blue-100/50  blur-xl"></div>
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 shadow-sm    border border-blue-200/50 ">
            <ShieldCheck className="h-12 w-12" weight="duotone" />
          </div>
        </div>
        
        <h1 className="mb-4 text-3xl sm:text-4xl font-extrabold text-slate-900  tracking-tight">
          Validasi Dokumen
        </h1>
        <p className="mb-10 text-base text-slate-500  leading-relaxed px-4">
          Sistem Arsip & Validasi FTI UKSW. Silakan pindai QR Code pada surat atau dokumen fisik untuk memverifikasi keasliannya.
        </p>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="group relative flex w-full max-w-sm items-center justify-center gap-3 overflow-hidden rounded-2xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-[0_8px_30px_rgb(37,99,235,0.25)] transition-all hover:bg-blue-700 hover:shadow-[0_8px_40px_rgb(37,99,235,0.4)] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]"></div>
          <QrCode className="h-6 w-6 relative z-10" />
          <span className="relative z-10">Scan QR Code Surat</span>
        </button>

      </div>

      {/* Footer */}
      <div className="pb-4 pt-8 text-xs font-medium text-slate-400 ">
        &copy; {new Date().getFullYear()} Sarpras FTI UKSW. All rights reserved.
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title="Scan QR Surat"
        closeOnSuccess={true}
      />
    </div>
  );
};

export default PublicValidationHome;
