import React from 'react';
import { LetterLayout, ObservationData } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface LetterPreviewProps {
  data: ObservationData;
  backgroundImageBase64?: string;
  layout?: LetterLayout;
  showLayoutGuide?: boolean;
}

const getObservationNumberPlaceholder = () => {
  const now = new Date();
  return `AUTO/FTI/S.Obs/${format(now, 'MM/yyyy')}`;
};

export const LetterPreview = React.forwardRef<HTMLDivElement, LetterPreviewProps>(({
  data,
  backgroundImageBase64,
  layout,
  showLayoutGuide = true
}, ref) => {
  const today = format(new Date(), 'dd MMMM yyyy', { locale: id });
  const observationNumber = getObservationNumberPlaceholder();
  const pageLayout = layout || { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 };

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white font-serif text-[11pt] leading-[1.6] text-black shadow-lg"
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
          <table className="w-full max-w-[90mm] border-collapse">
            <tbody>
              <tr>
                <td className="w-[18mm] py-[0.7mm] align-top font-bold">Perihal</td>
                <td className="w-[4mm] py-[0.7mm] align-top">:</td>
                <td className="py-[0.7mm] align-top">Pengantar Observasi</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-[0.8mm]">
            <p className="font-bold">Kepada Yth:</p>
            <p>{data.recipientName || '[Nama Penerima / Jabatan]'}</p>
            <p>{data.companyName || '[Nama Perusahaan / Instansi]'}</p>
            <p>{data.companyAddress || '[Alamat Instansi]'}</p>
          </div>
        </div>

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
            Bersama dengan surat ini kami memberitahukan bahwa mahasiswa Fakultas Teknologi Informasi
            Program Studi S1 Teknik Informatika Universitas Kristen Satya Wacana berikut ini:
          </p>

          <table className="mb-[2mm] ml-[12mm] w-[calc(100%-12mm)] border-collapse text-left text-[10.5pt]">
            <tbody>
              {data.students.length > 0 ? data.students.map((student, index) => (
                <tr key={index}>
                  <td className="py-[0.8mm] font-bold align-top">{student.name || '-'}</td>
                  <td className="py-[0.8mm] font-bold align-top">{student.nim || '-'}</td>
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

        <div className="mt-[16mm] grid grid-cols-2 gap-[16mm] px-[6mm]">
          <div className="text-center">
            <p>Mengetahui,</p>
            <div className="h-[24mm]" />
            <p className="font-bold underline underline-offset-4">{data.headOfProgramName || '[Nama Kaprodi]'}</p>
            <p>Kaprodi S1 Teknik Informatika</p>
          </div>
          <div className="text-center">
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
