/**
 * mailer.js — Utility Nodemailer untuk otomasi pengiriman surat TU
 * 
 * Cara pakai di route lain:
 *   import { sendMail } from '../utils/mailer.js';
 *   await sendMail({ to, subject, html, attachments });
 */

import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let resend = null;

// Memuat logo sebagai buffer agar bisa embedded base64 (lebih konsisten daripada cid: untuk Resend)
let ukswLogo = null;
let ftiLogo = null;
let nocLogo = null;

try {
  ukswLogo = fs.readFileSync(path.join(__dirname, '../../src/assets/UKSW.png'));
  ftiLogo = fs.readFileSync(path.join(__dirname, '../../src/assets/FTI.png'));
  nocLogo = fs.readFileSync(path.join(__dirname, '../../src/assets/noc.png'));
} catch (err) {
  console.warn('[Mailer] Peringatan: Logo PNG tidak ditemukan di src/assets/', err.message);
}

function toDataUrlPng(buffer) {
  if (!buffer) return null;
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

export function getLogoDataUrls() {
  return {
    uksw: toDataUrlPng(ukswLogo),
    fti: toDataUrlPng(ftiLogo),
    noc: toDataUrlPng(nocLogo),
  };
}

// ---------------------------------------------------------------
// Inisialisasi Mailer (Resend untuk Dev + Prod supaya konsisten)
// ---------------------------------------------------------------
const initMailer = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('[Mailer] RESEND_API_KEY belum diset');
  }
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('[Mailer] ✅ Menggunakan Resend API (Dev+Prod)');
};

// Panggil inisialisasi
initMailer();

/**
 * Verifikasi koneksi SMTP saat server start.
 * Dipanggil dari server.js (opsional).
 */
export async function verifyMailer() {
  if (!resend) {
    console.error('[Mailer] ❌ Resend belum diinisialisasi.');
    return;
  }
  console.log('[Mailer] ✅ Resend siap untuk mengirim email.');
}

/**
 * Kirim email dengan Nodemailer atau Resend.
 * 
 * @param {Object} options
 * @param {string|string[]} options.to        - Alamat email penerima
 * @param {string}          options.subject   - Subjek email
 * @param {string}          options.html      - Isi email dalam format HTML
 * @param {string}          [options.text]    - Isi email fallback teks biasa
 * @param {string|string[]} [options.cc]      - CC (opsional)
 * @param {Array}           [options.attachments] - Lampiran (buffer / content)
 * 
 * @returns {Promise<Object>} Info hasil pengiriman
 */
export async function sendMail({ to, subject, html, text, cc, attachments = [] }) {
  const fromName = process.env.EMAIL_FROM_NAME || 'TU FTI UKSW';
  if (!resend) throw new Error('Resend belum diinisialisasi');

  // Pengiriman via Resend (Dev + Prod)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@forion.my.id';

  const resendAttachments = attachments.map(att => {
    const resendAtt = {};
    if (att.filename) resendAtt.filename = att.filename;

    if (att.content) {
      resendAtt.content = Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content;
    }

    if (att.contentType) resendAtt.content_type = att.contentType;

    // Catatan: kita tidak pakai cid untuk header, tapi kalau ada attachment inline lain masih bisa.
    if (att.cid) {
      resendAtt.content_id = att.cid;
      resendAtt.disposition = 'inline';
    }

    return resendAtt;
  });

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text && { text }),
    ...(cc && { cc: Array.isArray(cc) ? cc : [cc] }),
    ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
  };

  const data = await resend.emails.send(payload);

  if (data.error) {
    console.error('[Mailer] ❌ Resend Error:', data.error);
    throw new Error(`Resend Error: ${data.error.message}`);
  }

  console.log(`[Mailer] 📧 Email terkirim via Resend ke ${to} | ID: ${data.data?.id}`);
  return data;
}

/**
 * Fungsi untuk membungkus konten email dengan desain profesional (Tabel HTML).
 * Sesuai panduan 'email-systems'.
 * 
 * @param {Object} param
 * @param {string} param.title - Judul email di header (misal: "Pemberitahuan Sistem")
 * @param {string} param.contentHtml - Isi utama dari email (dapat mengandung tag HTML dasar)
 */
export function buildProfessionalEmail({ title = 'Pemberitahuan Sistem', contentHtml }) {
  const { uksw, fti, noc } = getLogoDataUrls();

  // fallback: kalau logo tidak ketemu, tetap render tanpa broken image
  const ukswImg = uksw ? `<img src="${uksw}" alt="Logo UKSW" />` : '';
  const ftiImg = fti ? `<img src="${fti}" alt="Logo FTI" />` : '';
  const nocImg = noc ? `<img src="${noc}" alt="Logo NOC" />` : '';

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; background-color: #f3f4f6; margin: 0; padding: 0; }
        .wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; }
        .header { background-color: #0f172a; padding: 24px 32px; text-align: center; }
        .logos { display: block; margin: 0 auto 16px; text-align: center; }
        .logos img { height: 48px; margin: 0 8px; vertical-align: middle; }
        .header h1 { margin: 0; font-size: 20px; color: #ffffff; font-weight: 600; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
        .body { padding: 32px; font-size: 15px; line-height: 1.6; color: #334155; }
        .body h2 { color: #0f172a; font-size: 18px; margin-top: 0; }
        .body p { margin-bottom: 16px; }
        .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; }
        .footer p { margin: 0 0 8px; font-size: 12px; color: #64748b; line-height: 1.5; }
        .footer .warning { color: #dc2626; font-weight: 600; }
        .footer .system-name { font-weight: bold; color: #0f172a; }
      </style>
    </head>
    <body>
      <table class="wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <table class="container" width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <!-- Header -->
              <tr>
                <td class="header">
                  <div class="logos">
                    ${ukswImg}
                    ${ftiImg}
                    ${nocImg}
                  </div>
                  <h1>${title}</h1>
                  <p>Fakultas Teknologi Informasi UKSW</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td class="body">
                  ${contentHtml}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td class="footer">
                  <p class="system-name">CORE.FTI (Campus Operational Resource Environment)</p>
                  <p>Gedung FTI UKSW, Jl. Dr. O. Notohamidjojo 1-10, Kota Salatiga</p>
                  <p class="warning">Email ini dikirim otomatis oleh sistem. Mohon tidak membalas email ini.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}


