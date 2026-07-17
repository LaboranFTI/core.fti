import { pool, ensureTuInfrastructure } from './db-infrastructure.js';
import { letterConfig } from './letter-config.js';
import { buildLetterBackgroundsPayload, buildLetterLayoutsPayload, getSharedLetterBackground, normalizeLetterLayout, DEFAULT_LETTER_LAYOUT_MM } from './letterLayout.js';
import { sendMail, buildProfessionalEmail, getStandardEmailAttachments } from '../../../utils/mailer.js';
import { buildPublicAppBaseUrl } from './url-builders.js';
import { createTuSettingsService } from '../services/settings.service.js';
import { LETTER_TYPE_TO_CODE } from './constants.js';
import { escapeXml } from './sanitize.js';

import puppeteer from 'puppeteer';






















const formatLetterNumber = (type, sequence, date) => {
  const paddedSequence = String(sequence).padStart(3, '0');
  if (type === 'su-rek') {
    const month = String(date.getMonth() + 1);
    return `${paddedSequence}/FTI/Su.Rek/${month}/${date.getFullYear()}`;
  }
  if (type === 'counseling') {
    return `${paddedSequence}/FTI/${date.getMonth() + 1}/${date.getFullYear()}`;
  }
  const paddedMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${paddedSequence}/${LETTER_TYPE_TO_CODE[type]}/${paddedMonth}/${date.getFullYear()}`;
};

const reserveLetterNumber = async (client, type, date) => {
  await ensureTuInfrastructure();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  await client.query(
    `INSERT INTO tu_letter_number_counters (letter_type, year, month, last_sequence)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (letter_type, year, month) DO NOTHING`,
    [type, year, month]
  );

  const counterResult = await client.query(
    `SELECT last_sequence
     FROM tu_letter_number_counters
     WHERE letter_type = $1 AND year = $2 AND month = $3
     FOR UPDATE`,
    [type, year, month]
  );

  const nextSequence = Number(counterResult.rows[0]?.last_sequence || 0) + 1;
  const letterNumber = formatLetterNumber(type, nextSequence, date);

  await client.query(
    `UPDATE tu_letter_number_counters
     SET last_sequence = $4,
         last_letter_number = $5,
         last_generated_at = $6,
         updated_at = CURRENT_TIMESTAMP
     WHERE letter_type = $1 AND year = $2 AND month = $3`,
    [type, year, month, nextSequence, letterNumber, date]
  );

  return { nextSequence, letterNumber };
};

const {
  upsertSystemSetting,
  getTuSettingsPayload,
  saveLetterBackgrounds,
  saveLetterLayouts
} = createTuSettingsService({
  pool,
  ensureTuInfrastructure,
  buildLetterBackgroundsPayload,
  buildLetterLayoutsPayload,
  getSharedLetterBackground,
  normalizeLetterLayout,
  defaultLetterLayoutMm: DEFAULT_LETTER_LAYOUT_MM
});

// Helper: Generate PDF Buffer menggunakan Puppeteer
const generatePdfBuffer = async (htmlContent) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  return pdfBuffer;
};

const sendSuRekAccessCodeEmail = async (requestData, req) => {
  const accessCode = requestData.access_code || requestData.accessCode || '';
  const serviceUrl = `${buildPublicAppBaseUrl(req)}/layanan-tu`;

  const contentHtml = `
    <h2>Permohonan Surat Rekomendasi Diterima</h2>
    <p>Halo, <strong>${escapeXml(requestData.name)}</strong>.</p>
    <p>Permohonan Surat Rekomendasi Afirmasi Cemerlang Anda telah masuk ke sistem Tata Usaha FTI UKSW.</p>
    <p>Gunakan kode akses berikut untuk mengecek status permohonan dan mengunduh surat setelah diverifikasi:</p>
    <div style="margin: 24px 0; padding: 20px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px; text-align: center;">
      <div style="font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Kode Akses</div>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 0.15em; color: #1d4ed8; font-family: Consolas, monospace;">${escapeXml(accessCode)}</div>
    </div>
    <p>Buka halaman layanan TU lalu masukkan kode akses tersebut:</p>
    <p><a href="${serviceUrl}" style="color: #1d4ed8; font-weight: bold; text-decoration: none;">&rarr; Buka Layanan TU</a></p>
  `;

  await sendMail({
    to: requestData.email,
    subject: `Kode Akses Surat Rekomendasi - ${requestData.name}`,
    html: buildProfessionalEmail({
      title: 'Permohonan Diterima',
      contentHtml
    }),
    attachments: getStandardEmailAttachments()
  });

  return { success: true };
};

const ensureLetterNumber = async (client, type, requestData) => {
  if (requestData.letter_number) {
    return requestData;
  }

  const now = new Date();
  const config = letterConfig[type];
  const { nextSequence, letterNumber } = await reserveLetterNumber(client, type, now);
  const updateResult = await client.query(
    `UPDATE ${config.table}
     SET letter_number = $1,
         letter_sequence = $2,
         letter_generated_at = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [letterNumber, nextSequence, now, requestData.id]
  );

  return updateResult.rows[0];
};






export {
  reserveLetterNumber,
  formatLetterNumber,
  ensureLetterNumber,
  generatePdfBuffer,
  getTuSettingsPayload,
  saveLetterBackgrounds,
  saveLetterLayouts,
  sendSuRekAccessCodeEmail,
  upsertSystemSetting
};
