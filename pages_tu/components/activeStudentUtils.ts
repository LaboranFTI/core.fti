export const DEFAULT_FACULTY = 'Teknologi Informasi';
export const DEFAULT_UNIVERSITY = 'Kristen Satya Wacana';

interface StudyProgramLike {
  id: string;
  name: string;
  level: string;
}

export const getStudyProgramCodeFromNim = (nim: string) => {
  const normalizedNim = String(nim || '').replace(/\s+/g, '');
  return normalizedNim.slice(0, 2);
};

export const findStudyProgramByNim = (nim: string, studyPrograms: StudyProgramLike[]) => {
  const studyProgramCode = getStudyProgramCodeFromNim(nim);
  const studyProgram = studyPrograms.find((program) => String(program.id) === studyProgramCode);

  return studyProgram
    ? { studyProgramLevel: studyProgram.level, studyProgramName: studyProgram.name }
    : null;
};

export const formatSiasatBirthDate = (rawDate?: string) => {
  if (!rawDate) return '';

  const match = String(rawDate).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return rawDate;

  const [, year, month, day] = match;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parsedDate);
};

export const buildBirthPlaceAndDate = (birthPlace?: string, birthDate?: string) => {
  return [birthPlace, formatSiasatBirthDate(birthDate)]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};

export const scopeHtml = (rawHtml: string): string => {
  if (!rawHtml) return '';

  const styleMatch = rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  let cssContent = styleMatch ? styleMatch[1] : '';

  cssContent = cssContent.replace(/\bbody\b/g, '&');

  const pageRules: string[] = [];
  cssContent = cssContent.replace(/(@page[^{]*\{[^}]*\})/g, (match) => {
    pageRules.push(match);
    return '';
  });

  // Extract background image if any
  const bgImgTagMatch = rawHtml.match(/<img[^>]*class="background-image"[^>]*>|<img[^>]*src="[^"]*"[^>]*class="background-image"[^>]*>/i);
  let bgImgSrc = '';
  if (bgImgTagMatch) {
    const srcMatch = bgImgTagMatch[0].match(/src="([^"]+)"/i);
    if (srcMatch) {
      bgImgSrc = srcMatch[1];
    }
  }

  const nestedCss = `
    ${pageRules.join('\n')}
    .letter-body-wrapper {
      ${cssContent}
    }
    
    /* Simulate continuous pagination on screen */
    @media screen {
      .letter-body-wrapper .page {
        ${bgImgSrc ? `background-image: url("${bgImgSrc}") !important;` : ''}
        background-repeat: repeat-y !important;
        background-position: top center !important;
        background-size: 210mm 297mm !important;
        height: auto !important;
        min-height: 297mm !important;
        overflow: visible !important;
      }
      .letter-body-wrapper .background-image {
        display: none !important;
      }
    }
  `;

  const pageMatch = rawHtml.match(/<div[^>]*class="page"[^>]*>([\s\S]*?)<\/div>\s*<\/body>/i) ||
                    rawHtml.match(/<div[^>]*class="page"[^>]*>([\s\S]*?)<\/div>/i);
                    
  let pageContent = pageMatch ? pageMatch[1] : '';
  
  if (!pageContent) {
    pageContent = rawHtml
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head>[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '');
  }

  return `
    <style>
      ${nestedCss}
    </style>
    <div class="letter-body-wrapper flex justify-center w-full overflow-x-auto print:overflow-visible">
      <div class="page shadow-lg print:shadow-none mb-8 print:mb-0">
        ${pageContent}
      </div>
    </div>
  `;
};
