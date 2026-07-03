import React, { useEffect, useState } from 'react';
import { LetterLayout, ObservationData } from '../types';
import { scopeHtml } from './activeStudentUtils';
import { api } from '../../services/api';

interface LetterPreviewProps {
  type?: 'observation' | 'active-student' | 'counseling' | 'research' | 'interview' | 'permission' | 'su-rek';
  data: any & { html?: string };
  backgroundImageBase64?: string;
  layout?: LetterLayout;
  showLayoutGuide?: boolean;
  letterNumber?: string;
  validationToken?: string;
  validationUrl?: string;
  letterDate?: string;
}

export const LetterPreview = React.forwardRef<HTMLDivElement, LetterPreviewProps>(({
  type = 'observation',
  data,
  backgroundImageBase64,
  layout,
  showLayoutGuide = true,
  letterNumber,
  validationToken,
  validationUrl,
  letterDate
}, ref) => {
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
            type,
            data: {
              ...data,
              letter_number: letterNumber,
              validation_token: validationToken,
              validation_url: validationUrl,
              letter_generated_at: letterDate,
              backgroundImageBase64,
              layout
            }
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
    type,
    data.name,
    data.nim,
    data.recipientName,
    data.recipientTitle,
    data.berdasarkanNo,
    data.subject,
    data.referralUnit,
    data.perihal,
    data.lampiran,
    data.companyName,
    data.companyAddress,
    data.destinationPlace,
    data.destinationAddress,
    data.researchPlace,
    data.assignmentType,
    data.researchTitle,
    data.permissionPurpose,
    data.contactPerson,
    data.courseName,
    data.lecturerName,
    data.headOfProgramName,
    data.studyProgramName,
    data.studyProgramLevel,
    data.faculty,
    data.advisors,
    data.students,
    data.html,
    letterNumber,
    validationToken,
    validationUrl,
    letterDate,
    backgroundImageBase64,
    layout
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

LetterPreview.displayName = 'LetterPreview';
