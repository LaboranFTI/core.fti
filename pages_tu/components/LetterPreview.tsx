import React from 'react';
import { LetterLayout, ObservationData } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface LetterPreviewProps {
  data: ObservationData;
  backgroundImageBase64?: string;
  layout?: LetterLayout;
  showLayoutGuide?: boolean;
  letterNumber?: string;
  signatureBase64?: string;
  stampBase64?: string;
}

const getObservationNumberPlaceholder = () => {
  const now = new Date();
  return `AUTO/FTI-OBS/${format(now, 'MM/yyyy')}`;
};

// Konversi jenjang program ke singkatan untuk penulisan di surat
const shortLevel = (level?: string): string => {
  if (!level) return 'S1';
  const map: Record<string, string> = {
    'Diploma Tiga': 'D3',
    'Sarjana': 'S1',
    'Magister': 'S2',
    'Doktor': 'S3',
  };
  return map[level] || level;
};

export const LetterPreview = React.forwardRef<HTMLDivElement, LetterPreviewProps>(({
  data,
  backgroundImageBase64,
  layout,
  showLayoutGuide = true,
  letterNumber,
  signatureBase64,
  stampBase64
}, ref) => {
  const today = format(new Date(), 'dd MMMM yyyy', { locale: id });
  const observationNumber = letterNumber || getObservationNumberPlaceholder();
  const pageLayout = layout || { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 };

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white text-[11pt] leading-normal text-black shadow-lg"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {backgroundImageBase64 ? (
        <img
          src={backgroundImageBase64}
          alt="Background Surat Observasi"
          className="absolute inset-0 h-full w-full object-fill"
        />
      ) : null}

      {showLayoutGuide ? (
        <div
          className="pointer-events-none absolute border border-dashed border-sky-400/40 print:hidden"
          style={{
            top: `${pageLayout.marginTopMm}mm`,
            right: `${pageLayout.marginRightMm}mm`,
            bottom: `${pageLayout.marginBottomMm}mm`,
            left: `${pageLayout.marginLeftMm}mm`
          }}
        />
      ) : null}

      <div
        className="relative z-10"
        style={{
          paddingTop: `${pageLayout.marginTopMm}mm`,
          paddingRight: `${pageLayout.marginRightMm}mm`,
          paddingBottom: `${pageLayout.marginBottomMm}mm`,
          paddingLeft: `${pageLayout.marginLeftMm}mm`
        }}
      >
        <div className="mb-[4mm] grid grid-cols-[1fr_78mm] gap-[10mm] text-[10.5pt]">
          <div className="w-full max-w-[90mm]">
            <p className="font-bold">Perihal:</p>
            <p>Pengantar Observasi</p>
          </div>

          <div className="space-y-[0.8mm]">
            <p>Kepada Yth:</p>
            <p className="font-bold">{data.recipientName || '[Nama Penerima / Jabatan]'}</p>
            <p className="font-bold">{data.companyName || '[Nama Perusahaan / Instansi]'}</p>
            <p>{data.companyAddress || '[Alamat Instansi]'}</p>
          </div>
        </div>

        <hr className="mb-[4mm] border-0 border-t border-black" />

        <table className="mb-[7mm] w-full border-collapse text-[10.5pt]">
          <tbody>
            <tr>
              <td className="w-[35%] py-[0.7mm] align-top font-bold">Acuan Kami</td>
              <td className="w-[20%] py-[0.7mm] align-top font-bold">Acuan Anda</td>
              <td className="w-[25%] py-[0.7mm] align-top font-bold">Tanggal</td>
              <td className="w-[20%] py-[0.7mm] align-top font-bold">Lamp.</td>
            </tr>
            <tr>
              <td className="py-[0.7mm] align-top">{observationNumber}</td>
              <td className="py-[0.7mm] align-top">-</td>
              <td className="py-[0.7mm] align-top">{today}</td>
              <td className="py-[0.7mm] align-top">-</td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-[5mm] text-justify">
          <p>Dengan Hormat,</p>
          <p>
            Bersama dengan surat ini kami memberitahukan bahwa mahasiswa Fakultas Teknologi Informasi{' '}
            Program Studi {shortLevel(data.studyProgramLevel)} {data.studyProgramName || 'Teknik Informatika'} Universitas Kristen Satya Wacana berikut ini:
          </p>

          <table className="mb-[6mm] ml-[12mm] w-[calc(100%-12mm)] border-collapse text-left text-[10.5pt]">
            <tbody>
              {data.students.length > 0 ? data.students.map((student, index) => (
                <tr key={index}>
                  <td className="py-[0.8mm] align-top">{student.name || '-'}</td>
                  <td className="py-[0.8mm] align-top">{student.nim || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={2} className="italic text-gray-500 py-[0.8mm]">Data mahasiswa belum ditambahkan</td>
                </tr>
              )}
            </tbody>
          </table>

          <p>
            Bahwa sebagai salah satu syarat untuk memenuhi sebagian tugas dari mata kuliah{' '}
            <span className="font-bold">{data.courseName || '[Nama Mata Kuliah]'}</span>, yang diwajibkan oleh Fakultas,
            maka melalui surat ini kami mohon kesediaan Bapak/Ibu memberikan izin untuk dapat melakukan observasi dan
            wawancara di <span className="font-bold">{data.companyName || '[Nama Perusahaan / Instansi]'}</span>.
          </p>

          <p>
            Demikian surat ini kami sampaikan. Atas perhatian dan izin yang diberikan diucapkan terima kasih.
            Kiranya kerja sama ini dapat berlanjut di masa yang akan datang.
          </p>
        </div>

        <div className="mt-[16mm] flex justify-between">
          <div className="text-center w-[48%]">
            <p>Mengetahui,</p>
            <div className="relative h-[24mm]">
            </div>
            <p className="font-bold underline underline-offset-4">{data.headOfProgramName || '[Nama Kaprodi]'}</p>
            <p>Kaprodi {shortLevel(data.studyProgramLevel)} {data.studyProgramName || 'Teknik Informatika'}</p>
          </div>
          <div className="text-center w-[48%]">
            <p>Salam,</p>
            <div className="h-[24mm]" />
            <p className="font-bold underline underline-offset-4">{data.lecturerName || '[Nama Dosen Pengampu]'}</p>
            <p>Pengampu Mata Kuliah</p>
          </div>
        </div>
      </div>
    </div>
  );
});

LetterPreview.displayName = 'LetterPreview';
