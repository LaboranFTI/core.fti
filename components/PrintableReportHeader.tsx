import React from 'react';

import { cn } from '../lib/utils';

interface PrintableReportHeaderProps {
  title: string;
  logoSrc: string;
  className?: string;
}

const PrintableReportHeader: React.FC<PrintableReportHeaderProps> = ({
  title,
  logoSrc,
  className,
}) => {
  const printedAt = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        'hidden print:block mb-8 border-b-2 border-black pb-4',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img src={logoSrc} alt="Logo FTI" className="h-24 w-24 object-contain" />
          <div>
            <h1 className="text-2xl font-bold uppercase">Fakultas Teknologi Informasi</h1>
            <h2 className="text-xl">Universitas Kristen Satya Wacana</h2>
            <p className="text-sm">
              Jl. Dr. O. Notohamidjojo No.1 - 10, Blotongan, Kec. Sidorejo, Kota Salatiga, Jawa Tengah 50715
            </p>
          </div>
        </div>
        <div className="text-right">
          <h3 className="text-xl font-bold uppercase">{title}</h3>
          <p className="text-sm">Dicetak: {printedAt}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintableReportHeader;
