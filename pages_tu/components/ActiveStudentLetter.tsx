import React from 'react';
import { ActiveStudentRequest, LetterLayout } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ValidationQrCode } from './ValidationQrCode';
import {
  buildBirthPlaceAndDate,
  DEFAULT_FACULTY,
  DEFAULT_UNIVERSITY
} from './activeStudentUtils';

import { useLecturers } from '../../hooks/useLecturers';

interface ActiveStudentLetterProps {
  data: ActiveStudentRequest & {
    backgroundImageBase64?: string;
    layout?: LetterLayout;
    deanName?: string;
    deanTitle?: string;
    validationUrl?: string;
  };
}

export const ActiveStudentLetter = React.forwardRef<HTMLDivElement, ActiveStudentLetterProps>(({ data }, ref) => {
  const { lecturers } = useLecturers();
  const dean =
    lecturers.find(l => l.jabatan && l.jabatan.toLowerCase().startsWith('dekan')) ||
    lecturers.find(l => l.jabatan && l.jabatan.toLowerCase().startsWith('wakil dekan'));
  const derivedDeanName = dean ? dean.nama : 'Nama Dekan Belum Diatur';
  const derivedDeanTitle = dean ? dean.jabatan : 'Dekan';

  const letterDate = data.letterGeneratedAt || data.createdAt;
  const baseDate = letterDate ? new Date(new Date(letterDate).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })) : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const today = format(baseDate, 'dd MMMM yyyy', { locale: id });
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth();
  const semester = data.semesterName || (currentMonth >= 7 ? 'Ganjil' : 'Genap');
  const academicYear = data.academicYear || (currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`);
  const letterNumber = data.letterNumber || `AUTO/FTI/S.Ket/${format(baseDate, 'MM/yyyy')}`;
  const layout = data.layout || { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 };
  const studyProgramLevel = data.studyProgramLevel || '[Jenjang Program]';
  const studyProgramName = data.studyProgramName || '[Program Studi]';
  const birthPlaceAndDate = buildBirthPlaceAndDate(data.birthPlace, data.birthDate) || '[Tempat & Tanggal Lahir]';
  const faculty = data.faculty || DEFAULT_FACULTY;
  const university = data.university || DEFAULT_UNIVERSITY;
  const validationUrl = data.validationUrl || (data.validationToken ? `${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tu/validasi-surat/${data.validationToken}` : '');

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white text-[11pt] leading-[1.5] text-black shadow-lg"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {data.backgroundImageBase64 ? (
        <img
          src={data.backgroundImageBase64}
          alt="Background Surat Aktif Kuliah"
          className="absolute inset-0 h-full w-full object-fill"
        />
      ) : null}

      <div
        className="pointer-events-none absolute border border-dashed border-sky-400/40 print:hidden"
        style={{
          top: `${layout.marginTopMm}mm`,
          right: `${layout.marginRightMm}mm`,
          bottom: `${layout.marginBottomMm}mm`,
          left: `${layout.marginLeftMm}mm`
        }}
      />

      <div
        className="relative z-10"
        style={{
          paddingTop: `${layout.marginTopMm}mm`,
          paddingRight: `${layout.marginRightMm}mm`,
          paddingBottom: `${layout.marginBottomMm}mm`,
          paddingLeft: `${layout.marginLeftMm}mm`
        }}
      >
        <div className="mb-[8mm] text-center">
          <h3 className="text-[15pt] font-bold uppercase">
            Surat Keterangan
          </h3>
        </div>

        <table className="mb-[8mm] w-full border-collapse text-[10.5pt]">
          <tbody>
            <tr>
              <td className="w-[22mm] py-[1mm] align-top">Nomor</td>
              <td className="w-[4mm] py-[1mm] align-top">:</td>
              <td className="py-[1mm] align-top">{letterNumber}</td>
            </tr>
            <tr>
              <td className="py-[1mm] align-top">Hal</td>
              <td className="py-[1mm] align-top">:</td>
              <td className="py-[1mm] align-top">Permohonan Surat Aktif Kuliah</td>
            </tr>
            <tr>
              <td className="py-[1mm] align-top">Lamp</td>
              <td className="py-[1mm] align-top">:</td>
              <td className="py-[1mm] align-top">1 lembar</td>
            </tr>

          </tbody>
        </table>

        <div className="space-y-[5mm] text-justify">
          <p>Pimpinan Fakultas Teknologi Informasi Universitas Kristen Satya Wacana, dengan ini menerangkan bahwa:</p>

          <table className="ml-[12mm] w-[calc(100%-12mm)] border-collapse">
            <tbody>
              <tr>
                <td className="w-[48mm] py-[1.1mm] align-top">Nama Mahasiswa</td>
                <td className="w-[5mm] py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{data.name || '[Nama Mahasiswa]'}</td>
              </tr>
              <tr>
                <td className="py-[1.1mm] align-top">NIM</td>
                <td className="py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{data.nim || '[NIM Mahasiswa]'}</td>
              </tr>
              <tr>
                <td className="py-[1.1mm] align-top">Tempat &amp; Tanggal Lahir</td>
                <td className="py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{birthPlaceAndDate}</td>
              </tr>
              <tr>
                <td className="py-[1.1mm] align-top">Jenjang Program</td>
                <td className="py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{studyProgramLevel}</td>
              </tr>
              <tr>
                <td className="py-[1.1mm] align-top">Program Studi</td>
                <td className="py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{studyProgramName}</td>
              </tr>
              <tr>
                <td className="py-[1.1mm] align-top">Fakultas</td>
                <td className="py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{faculty}</td>
              </tr>
              <tr>
                <td className="py-[1.1mm] align-top">Universitas</td>
                <td className="py-[1.1mm] align-top">:</td>
                <td className="py-[1.1mm] align-top">{university}</td>
              </tr>
            </tbody>
          </table>

          <p>
            Benar sebagai Mahasiswa Fakultas {faculty} yang saat ini pada Semester{' '}
            <span>{semester}</span> Tahun Akademik <span>{academicYear}</span>{' '}
            terdaftar dengan status aktif kuliah.
          </p>

          <p>Demikian surat keterangan ini diberikan kepada yang bersangkutan untuk dipergunakan sebagaimana mestinya.</p>
        </div>

      <div className="mt-[14mm] flex justify-end">
        <div className="w-[48%] leading-tight text-center">
          <p>Salatiga, {today}</p>
          <p>Hormat kami,</p>

          {validationUrl ? (
            <div className="my-[4mm] inline-flex flex-col items-center gap-[1mm]">
              <ValidationQrCode value={validationUrl} size={92} />
            </div>
          ) : (
            <div className="h-[24mm]" />
          )}

          <p className="relative left-1/2 w-max -translate-x-1/2 whitespace-nowrap text-[11pt] font-bold">{data.deanName || derivedDeanName}</p>
          <p>{data.deanTitle || derivedDeanTitle}</p>
        </div>
      </div>
      </div>

      {/* Watermark/Status Indicator (Hidden when printing) */}
      {data.status === 'pending' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none print:hidden">
          <div className="text-6xl font-bold text-red-500 border-8 border-red-500 p-8 rounded-xl rotate-[-30deg]">
            DRAFT / PENDING
          </div>
        </div>
      )}

    </div>
  );
});

ActiveStudentLetter.displayName = 'ActiveStudentLetter';
