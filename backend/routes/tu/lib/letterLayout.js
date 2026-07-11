import {
  LETTER_TYPE_TO_CLIENT_KEY,
  SHARED_LETTER_BACKGROUND_TYPE
} from './constants.js';

export const createEmptyLetterBackgrounds = () => ({
  document: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  activeStudent: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  observation: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  counseling: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  research: { imageBase64: '', fileName: '', mimeType: 'image/png' },
  suRek: { imageBase64: '', fileName: '', mimeType: 'image/png' }
});

export const DEFAULT_LETTER_LAYOUT_MM = Object.freeze({
  activeStudent: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  observation: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  counseling: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  research: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  interview: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  permission: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 },
  suRek: { marginTopMm: 40, marginRightMm: 22, marginBottomMm: 26, marginLeftMm: 22 }
});

export const OFFICIAL_LETTER_TYPOGRAPHY_CSS = `
        body {
            font-family: Calibri, Arial, sans-serif;
        }

        .content,
        .letter-meta,
        .subject-meta,
        .reference-meta,
        .recipient-block,
        .body-text,
        .student-data,
        .student-list,
        .signature-content,
        .signature-lines,
        .carbon-copy-block {
            font-family: Calibri, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
        }

        .content p,
        .content td,
        .content th,
        .content li {
            font-size: 11pt;
            line-height: 1.5;
        }

        .title {
            font-size: 12pt;
            line-height: 1.5;
        }

        .validation-qr span {
            font-size: 7.5pt;
            line-height: 1.1;
        }
`;

export const createEmptyLetterLayouts = () => ({
  activeStudent: { ...DEFAULT_LETTER_LAYOUT_MM.activeStudent },
  observation: { ...DEFAULT_LETTER_LAYOUT_MM.observation },
  counseling: { ...DEFAULT_LETTER_LAYOUT_MM.counseling },
  research: { ...DEFAULT_LETTER_LAYOUT_MM.research },
  interview: { ...DEFAULT_LETTER_LAYOUT_MM.interview },
  permission: { ...DEFAULT_LETTER_LAYOUT_MM.permission },
  suRek: { ...DEFAULT_LETTER_LAYOUT_MM.suRek }
});

export const clampMarginMm = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(80, Math.max(0, Number(parsed.toFixed(2))));
};

export const normalizeLetterLayout = (layout, fallback) => ({
  marginTopMm: clampMarginMm(layout?.marginTopMm, fallback.marginTopMm),
  marginRightMm: clampMarginMm(layout?.marginRightMm, fallback.marginRightMm),
  marginBottomMm: clampMarginMm(layout?.marginBottomMm, fallback.marginBottomMm),
  marginLeftMm: clampMarginMm(layout?.marginLeftMm, fallback.marginLeftMm)
});

export const applyOfficialLetterTypography = (htmlContent) => {
  if (!htmlContent || htmlContent.includes('OFFICIAL_LETTER_TYPOGRAPHY_CSS')) {
    return htmlContent;
  }

  return htmlContent.replace(
    /<\/style>/i,
    `\n        /* OFFICIAL_LETTER_TYPOGRAPHY_CSS */\n${OFFICIAL_LETTER_TYPOGRAPHY_CSS}\n    </style>`
  );
};

export const buildLetterBackgroundsPayload = (rows) => {
  const empty = createEmptyLetterBackgrounds();
  const rowByType = rows.reduce((acc, row) => {
    acc[row.letter_type] = {
      imageBase64: row.image_base64 || '',
      fileName: row.file_name || '',
      mimeType: row.mime_type || 'image/png'
    };
    return acc;
  }, {});
  const sharedBackground =
    rowByType[SHARED_LETTER_BACKGROUND_TYPE] ||
    rowByType['active-student'] ||
    rowByType.observation ||
    rowByType.counseling ||
    rowByType.research ||
    rowByType['su-rek'] ||
    empty.document;

  return {
    document: { ...empty.document, ...sharedBackground },
    activeStudent: { ...empty.activeStudent, ...sharedBackground },
    observation: { ...empty.observation, ...sharedBackground },
    counseling: { ...empty.counseling, ...sharedBackground },
    research: { ...empty.research, ...sharedBackground },
    suRek: { ...empty.suRek, ...sharedBackground }
  };
};

export const getSharedLetterBackground = (letterBackgrounds) => {
  const empty = createEmptyLetterBackgrounds();
  const source =
    letterBackgrounds?.document?.imageBase64
      ? letterBackgrounds.document
      : letterBackgrounds?.activeStudent?.imageBase64
        ? letterBackgrounds.activeStudent
        : letterBackgrounds?.observation?.imageBase64
          ? letterBackgrounds.observation
          : letterBackgrounds?.counseling?.imageBase64
            ? letterBackgrounds.counseling
            : letterBackgrounds?.research?.imageBase64
              ? letterBackgrounds.research
              : letterBackgrounds?.suRek?.imageBase64
                ? letterBackgrounds.suRek
                : empty.document;

  return { ...empty.document, ...source };
};

export const buildLetterLayoutsPayload = (rows) => {
  const layouts = createEmptyLetterLayouts();

  rows.forEach((row) => {
    const clientKey = LETTER_TYPE_TO_CLIENT_KEY[row.letter_type];
    if (!clientKey) return;

    layouts[clientKey] = normalizeLetterLayout({
      marginTopMm: row.margin_top_mm,
      marginRightMm: row.margin_right_mm,
      marginBottomMm: row.margin_bottom_mm,
      marginLeftMm: row.margin_left_mm
    }, DEFAULT_LETTER_LAYOUT_MM[clientKey]);
  });

  return layouts;
};
