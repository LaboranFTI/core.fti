import React, { useEffect, useState, useRef } from 'react';
import { LetterLayout } from '../types';
import { api } from '../../services/api';

interface LetterPreviewProps {
  type?: 'observation' | 'active-student' | 'counseling' | 'research' | 'interview' | 'permission' | 'su-rek';
  data?: any;
  backgroundImageBase64?: string;
  layout?: LetterLayout;
  showLayoutGuide?: boolean;
  letterNumber?: string;
  validationToken?: string;
  validationUrl?: string;
  letterDate?: string;
  pdfUrl?: string;
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
  letterDate,
  pdfUrl: propPdfUrl
}, ref) => {
  const [pdfUrl, setPdfUrl] = useState<string>(propPdfUrl || '');
  const [loading, setLoading] = useState<boolean>(!propPdfUrl);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propPdfUrl) {
      setPdfUrl(propPdfUrl);
      setLoading(false);
      return;
    }

    if (!data) return;

    let active = true;
    let objectUrl = '';
    
    const fetchPdf = async () => {
      setLoading(true);
      try {
        const res = await api('/api/tu/preview-pdf', {
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
        
        if (!res.ok) {
           throw new Error('Failed to fetch PDF');
        }

        const blob = await res.blob();
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setPdfUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch letter preview PDF:', err);
        if (active) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchPdf();
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    propPdfUrl,
    type,
    data ? JSON.stringify(data) : '',
    letterNumber,
    validationToken,
    validationUrl,
    letterDate,
    backgroundImageBase64,
    layout
  ]);

  return (
    <div ref={containerRef} className="w-full flex justify-center max-w-full relative h-[600px] md:h-[800px] bg-slate-100 rounded border border-slate-200">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-semibold text-slate-600">Memuat pratinjau PDF...</span>
          </div>
        </div>
      )}
      {pdfUrl && (
        <iframe
          ref={ref as any}
          src={pdfUrl + '#toolbar=0&navpanes=0&scrollbar=0'}
          className="w-full h-full border-0 rounded shadow-lg"
          title="Pratinjau Surat PDF"
        />
      )}
    </div>
  );
});

LetterPreview.displayName = 'LetterPreview';
