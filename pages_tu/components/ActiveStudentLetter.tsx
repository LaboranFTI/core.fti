import React, { useEffect, useState } from 'react';
import { ActiveStudentRequest, LetterLayout } from '../types';
import { scopeHtml } from './activeStudentUtils';
import { api } from '../../services/api';

interface ActiveStudentLetterProps {
  data: ActiveStudentRequest & {
    backgroundImageBase64?: string;
    layout?: LetterLayout;
    deanName?: string;
    deanTitle?: string;
    validationUrl?: string;
    html?: string;
  };
}

export const ActiveStudentLetter = React.forwardRef<HTMLDivElement, ActiveStudentLetterProps>(({ data }, ref) => {
  const [html, setHtml] = useState<string>(data.html || '');
  const [loading, setLoading] = useState<boolean>(!data.html);

  useEffect(() => {
    if (data.html) {
      setHtml(data.html);
      setLoading(false);
      return;
    }

    let active = true;
    const fetchHtml = async () => {
      setLoading(true);
      try {
        const res = await api('/api/tu/preview-html', {
          method: 'POST',
          data: {
            type: 'active-student',
            data: data
          }
        });
        const text = await res.text();
        if (active) {
          setHtml(text);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch letter preview:', err);
        if (active) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchHtml();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    data.name,
    data.nim,
    data.birthPlace,
    data.birthDate,
    data.studyProgramLevel,
    data.studyProgramName,
    data.faculty,
    data.university,
    data.semesterName,
    data.academicYear,
    data.letterNumber,
    data.validationToken,
    data.validationUrl,
    data.deanName,
    data.deanTitle,
    data.status,
    data.backgroundImageBase64,
    data.layout,
    data.html
  ]);

  if (loading && !html) {
    return (
      <div
        ref={ref}
        className="relative mx-auto h-[297mm] w-[210mm] flex items-center justify-center bg-white shadow-lg text-slate-500 font-sans"
      >
        <div className="flex flex-col items-center gap-2">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold">Memuat pratinjau surat...</span>
        </div>
      </div>
    );
  }

  const scopedHtml = scopeHtml(html);

  return (
    <div
      ref={ref}
      className="print:block print:w-full print:m-0 print:p-0"
      dangerouslySetInnerHTML={{ __html: scopedHtml }}
    />
  );
});

ActiveStudentLetter.displayName = 'ActiveStudentLetter';
