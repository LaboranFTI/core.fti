import QRCode from 'react-qr-code';
import ftiLogo from '../../src/assets/FTI_nobg.svg';

interface ValidationQrCodeProps {
  value: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export function ValidationQrCode({
  value,
  size = 92,
  className = '',
  ariaLabel = 'QR Code Validasi Surat'
}: ValidationQrCodeProps) {
  const logoSize = Math.max(24, Math.round(size * 0.28));
  const logoPadding = Math.max(4, Math.round(size * 0.04));

  return (
    <div
      className={`relative inline-flex items-center justify-center bg-white ${className}`}
      style={{ width: size, height: size }}
      aria-label={ariaLabel}
    >
      <QRCode value={value} size={size} level="H" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-white"
        style={{
          width: logoSize + logoPadding * 2,
          height: logoSize + logoPadding * 2,
          padding: logoPadding
        }}
      >
        <img
          src={ftiLogo}
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
