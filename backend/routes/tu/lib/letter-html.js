import { fileURLToPath } from 'url';
import { pool } from './db-infrastructure.js';
import { createQrSvgDataUrl } from './qr.js';
import { buildPublicValidationUrl } from './url-builders.js';
import { createValidationToken } from './tokens.js';
import { letterConfig } from './letter-config.js';
import { generatePdfBuffer, getTuSettingsPayload } from './letter-number.js';
import { getSemesterMeta } from './university.js';
import { escapeXml } from './sanitize.js';
import { getSharedLetterBackground, normalizeLetterLayout, applyOfficialLetterTypography, DEFAULT_LETTER_LAYOUT_MM } from './letterLayout.js';
import { LETTER_TYPE_TO_CLIENT_KEY } from './constants.js';

import path from "path";
































import fs from "fs/promises";












const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ensureLetterValidationToken = async (queryable, type, requestData) => {
  if (requestData.validation_token) {
    return requestData;
  }

  const config = letterConfig[type];
  if (!config) {
    throw new Error('Jenis surat tidak valid untuk token validasi.');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const validationToken = createValidationToken();
      const updateResult = await queryable.query(
        `UPDATE ${config.table}
         SET validation_token = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [validationToken, requestData.id]
      );
      return updateResult.rows[0];
    } catch (err) {
      if (err?.code === '23505') continue;
      throw err;
    }
  }

  throw new Error('Gagal membuat token validasi surat.');
};

const buildLetterHtml = async (type, requestData, req) => {
  const config = letterConfig[type];
  if (!config) {
    throw new Error('Jenis surat tidak valid.');
  }

  const tuSettings = await getTuSettingsPayload();
  const semesterMeta = getSemesterMeta(tuSettings.currentSemesterCode);
  const assetKey = config.assetKey || LETTER_TYPE_TO_CLIENT_KEY[type];
  const backgroundImage = requestData.backgroundImageBase64 || getSharedLetterBackground(tuSettings.letterBackgrounds).imageBase64 || '';
  const letterLayout = requestData.layout || normalizeLetterLayout(tuSettings.letterLayouts?.[assetKey], DEFAULT_LETTER_LAYOUT_MM[assetKey]);
  const templatePath = path.join(__dirname, '..', '..', '..', 'lettersTU', config.template);
  let htmlContent = await fs.readFile(templatePath, 'utf-8');

  const validationToken = requestData.validation_token || requestData.validationToken;
  const letterNumberVal = requestData.letter_number || requestData.letterNumber;
  const letterGeneratedAt = requestData.letter_generated_at || requestData.letterGeneratedAt;

  const tanggalSurat = letterGeneratedAt
    ? new Date(letterGeneratedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const validationUrl = buildPublicValidationUrl(req, validationToken);
  const validationQrImage = await createQrSvgDataUrl(validationUrl);

  const draftWatermarkHtml = requestData.status === 'pending'
    ? '<div class="draft-watermark">DRAFT / PENDING</div>'
    : '';

  const ccRaw = requestData.carbon_copies || requestData.carbonCopies || [];
  let ccArray = [];
  if (typeof ccRaw === 'string') {
    try {
      ccArray = JSON.parse(ccRaw);
    } catch (e) {
      console.error('Failed to parse carbon copies string:', e);
    }
  } else if (Array.isArray(ccRaw)) {
    ccArray = ccRaw;
  }

  let tembusanHtml = '';
  if (ccArray && ccArray.length > 0) {
    const listItems = ccArray
      .map(cc => `<li style="list-style: none; margin: 0; padding: 0 0 0 2mm; text-indent: -2mm;">- ${cc.role || cc.jabatan || ''}${cc.name || cc.nama ? ` - ${cc.name || cc.nama}` : ''}</li>`)
      .join('\n');
    tembusanHtml = `
      <div class="carbon-copy-block" style="margin-top: 8mm; font-size: 11pt; line-height: 1.5; page-break-inside: avoid;">
          <p style="margin: 0; font-weight: bold;">Tembusan</p>
          <ul style="margin: 1mm 0 0 0; padding: 0; list-style: none;">
              ${listItems}
          </ul>
      </div>
    `;
  }

  htmlContent = htmlContent
    .replace(/{{name}}/g, () => escapeXml(requestData.name || ''))
    .replace(/{{nim}}/g, () => escapeXml(requestData.nim || ''))
    .replace(/{{tanggalSurat}}/g, () => tanggalSurat)
    .replace(/{{signatureImage}}/g, () => '')
    .replace(/{{stampImage}}/g, () => '')
    .replace(/{{validationUrl}}/g, () => escapeXml(validationUrl))
    .replace(/{{validationQrImage}}/g, () => validationQrImage)
    .replace(/{{backgroundImage}}/g, () => backgroundImage)
    .replace(/{{marginTopMm}}/g, () => String(letterLayout.marginTopMm))
    .replace(/{{marginRightMm}}/g, () => String(letterLayout.marginRightMm))
    .replace(/{{marginBottomMm}}/g, () => String(letterLayout.marginBottomMm))
    .replace(/{{marginLeftMm}}/g, () => String(letterLayout.marginLeftMm))
    .replace(/{{draftWatermark}}/g, () => draftWatermarkHtml)
    .replace(/{{tembusanBlock}}/g, () => tembusanHtml);

  const placeholders = config.getPlaceholders({
    data: requestData,
    letterNumber: letterNumberVal || '-',
    semesterMeta,
    tuSettings
  });

  const resolvedPlaceholders = await placeholders;
  for (const key in resolvedPlaceholders) {
    htmlContent = htmlContent.replace(new RegExp(key, 'g'), () => String(resolvedPlaceholders[key]));
  }

  return applyOfficialLetterTypography(htmlContent);
};

const buildLetterPdfBuffer = async (type, requestData, req) => {
  const htmlContent = await buildLetterHtml(type, requestData, req);
  return generatePdfBuffer(htmlContent);
};






export {
  ensureLetterValidationToken,
  buildLetterHtml,
  buildLetterPdfBuffer
};
