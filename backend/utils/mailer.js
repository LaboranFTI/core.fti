/**
 * mailer.js — Utility Nodemailer untuk otomasi pengiriman surat TU
 * 
 * Cara pakai di route lain:
 *   import { sendMail } from '../utils/mailer.js';
 *   await sendMail({ to, subject, html, attachments });
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let transporter = null;
let resend = null;

// Memuat logo sebagai buffer agar bisa diattach (CID)
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

export function getStandardEmailAttachments() {
  const attachments = [];
  if (ukswLogo) attachments.push({ filename: 'UKSW.png', content: ukswLogo, cid: 'uksw_logo' });
  if (ftiLogo) attachments.push({ filename: 'FTI.png', content: ftiLogo, cid: 'fti_logo' });
  if (nocLogo) attachments.push({ filename: 'noc.png', content: nocLogo, cid: 'noc_logo' });
  return attachments;
}

// ---------------------------------------------------------------
// Inisialisasi Mailer (Resend untuk Prod, Ethereal untuk Dev)
// ---------------------------------------------------------------
const initMailer = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('[Mailer] ✅ Menggunakan Resend API (Production)');
  } else {
    // Mode Development: Gunakan Ethereal agar kuota Resend tidak habis
    console.log('[Mailer] 🛠️ Menggunakan Mock Server (Ethereal) untuk Development');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[Mailer] ✅ Ethereal siap (user: ${testAccount.user})`);
    } catch (err) {
      console.error('[Mailer] ❌ Gagal membuat akun Ethereal:', err);
    }
  }
};

// Panggil inisialisasi
initMailer();

/**
 * Verifikasi koneksi SMTP saat server start.
 * Dipanggil dari server.js (opsional).
 */
export async function verifyMailer() {
  if (resend) {
    console.log('[Mailer] ✅ Resend siap untuk mengirim email.');
    return;
  }
  try {
    if (transporter) {
      await transporter.verify();
      console.log('[Mailer] ✅ Koneksi SMTP Ethereal berhasil diverifikasi.');
    }
  } catch (err) {
    console.error('[Mailer] ❌ Gagal koneksi SMTP:', err.message);
  }
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
  
  if (resend) {
    // Pengiriman via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@forion.my.id';
    const resendAttachments = attachments.map(att => {
      // Sesuaikan format attachment dari Nodemailer ke Resend
      if (att.content) {
        return {
          filename: att.filename,
          content: att.content // Resend menerima Buffer secara native di versi terbaru
        };
      }
      return att;
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
  } else {
    // Pengiriman via Nodemailer (Ethereal)
    const fromEmail = 'noreply@ethereal.email';
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]+>/g, ''),
      ...(cc && { cc }),
      ...(attachments.length > 0 && { attachments }),
    };

    if (!transporter) throw new Error('Transporter belum diinisialisasi');

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] 📧 Email terkirim via Ethereal ke ${to} | MessageID: ${info.messageId}`);
    
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Mailer] 🔍 PREVIEW EMAIL: ${previewUrl}`);
    }
    
    return info;
  }
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
                    <img src="cid:uksw_logo" alt="Logo UKSW" />
                    <img src="cid:fti_logo" alt="Logo FTI" />
                    <img src="cid:noc_logo" alt="Logo NOC" />
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
                  <p class="system-name">CORE.FTI (Sistem Informasi Laboratorium & Layanan TU)</p>
                  <p>Gedung FTI UKSW, Jl. Dr. O. Notohamidjojo, Salatiga</p>
                  <p class="warning">Email ini dikirim otomatis oleh sistem CORE.FTI. Mohon tidak membalas email ini (noreply).</p>
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


