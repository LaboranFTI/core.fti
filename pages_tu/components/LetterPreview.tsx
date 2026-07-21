import React, { useEffect, useState, useRef } from 'react';
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
    JSON.stringify(data),
    letterNumber,
    validationToken,
    validationUrl,
    letterDate,
    backgroundImageBase64,
    layout
  ]);

  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const width = entries[0].contentRect.width;
        // A4 width is ~794px. Leave some padding.
        if (width > 0 && width < 820) {
          const newScale = width / 820;
          setScale(prev => (prev !== newScale ? newScale : prev));
        } else {
          setScale(prev => (prev !== 1 ? 1 : prev));
        }
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);
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

  let finalHtml = scopeHtml(html);

  if (showLayoutGuide && layout) {
    const guideHtml = `<div style="position: absolute; pointer-events: none; border: 2px dashed rgba(59, 130, 246, 0.6); background-color: rgba(59, 130, 246, 0.05); z-index: 50; top: ${layout.marginTopMm}mm; right: ${layout.marginRightMm}mm; bottom: ${layout.marginBottomMm}mm; left: ${layout.marginLeftMm}mm;"></div>`;
    finalHtml = finalHtml.replace('<div class="page">', `<div class="page">${guideHtml}`);
  }

  return (
    <div ref={containerRef} className="w-full flex justify-center max-w-full overflow-x-hidden print:overflow-visible">
      <div
        ref={ref}
        className="print:block print:w-full print:m-0 print:p-0 origin-top flex justify-center"
        style={{ zoom: scale > 0 ? scale : 1, transform: scale < 1 && typeof CSS !== 'undefined' && !CSS.supports('zoom', '1') ? `scale(${scale})` : 'none', transformOrigin: 'top center' }}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
    </div>
  );
});

LetterPreview.displayName = 'LetterPreview';
