/**
 * mailer.js — Utility Nodemailer untuk otomasi pengiriman surat TU
 * 
 * Cara pakai di route lain:
 *   import { sendMail } from '../utils/mailer.js';
 *   await sendMail({ to, subject, html, attachments });
 */

import nodemailer from 'nodemailer';

// ---------------------------------------------------------------
// Buat transporter sekali (reusable) menggunakan Gmail + App Password
// Semua konfigurasi dibaca dari .env
// ---------------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_TLS === 'false', // true hanya untuk port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Aktifkan jika menggunakan port 587 (STARTTLS)
  requireTLS: process.env.EMAIL_TLS !== 'false',
});

/**
 * Verifikasi koneksi SMTP saat server start.
 * Dipanggil dari server.js (opsional).
 */
export async function verifyMailer() {
  try {
    await transporter.verify();
    console.log('[Mailer] ✅ Koneksi SMTP Gmail berhasil —', process.env.EMAIL_USER);
  } catch (err) {
    console.error('[Mailer] ❌ Gagal koneksi SMTP:', err.message);
    // Tidak throw — biarkan server tetap jalan meskipun email gagal
  }
}

/**
 * Kirim email dengan Nodemailer.
 * 
 * @param {Object} options
 * @param {string|string[]} options.to        - Alamat email penerima
 * @param {string}          options.subject   - Subjek email
 * @param {string}          options.html      - Isi email dalam format HTML
 * @param {string}          [options.text]    - Isi email fallback teks biasa
 * @param {string|string[]} [options.cc]      - CC (opsional)
 * @param {Array}           [options.attachments] - Lampiran (lihat contoh di bawah)
 * 
 * Contoh attachments:
 *   [{ filename: 'surat.pdf', content: bufferPDF, contentType: 'application/pdf' }]
 *   [{ filename: 'surat.pdf', path: '/absolute/path/to/surat.pdf' }]
 * 
 * @returns {Promise<Object>} Info hasil pengiriman dari Nodemailer
 */
export async function sendMail({ to, subject, html, text, cc, attachments = [] }) {
  const fromName = process.env.EMAIL_FROM_NAME || 'TU FTI UKSW';
  const fromEmail = process.env.EMAIL_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || html?.replace(/<[^>]+>/g, ''), // fallback strip HTML jika text tidak diisi
    ...(cc && { cc }),
    ...(attachments.length > 0 && { attachments }),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Mailer] 📧 Email terkirim ke ${to} | MessageID: ${info.messageId}`);
  return info;
}

/**
 * Template HTML siap pakai untuk surat TU.
 * Bisa dikembangkan lebih lanjut sesuai kebutuhan.
 * 
 * @param {Object} param
 * @param {string} param.recipientName - Nama mahasiswa/penerima
 * @param {string} param.letterType    - Jenis surat (misal: "Surat Ijin Observasi")
 * @param {string} param.message       - Pesan tambahan (opsional)
 */
export function buildLetterEmailHtml({ recipientName, letterType, message = '' }) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        .header { background: #1e3a5f; color: #fff; padding: 24px 32px; }
        .header h1 { margin: 0; font-size: 20px; }
        .header p { margin: 4px 0 0; font-size: 13px; opacity: .8; }
        .body { padding: 32px; }
        .body p { line-height: 1.7; }
        .badge { display: inline-block; background: #eef3ff; color: #1e3a5f; border: 1px solid #c5d4f0; border-radius: 4px; padding: 4px 12px; font-size: 13px; font-weight: bold; margin: 12px 0; }
        .footer { background: #f9f9f9; border-top: 1px solid #eee; padding: 16px 32px; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Tata Usaha — FTI UKSW</h1>
          <p>Sistem Informasi Laboratorium</p>
        </div>
        <div class="body">
          <p>Yth. <strong>${recipientName}</strong>,</p>
          <p>Surat berikut telah diterbitkan dan tersedia untuk Anda:</p>
          <div class="badge">📄 ${letterType}</div>
          <p>Surat terlampir dalam email ini dalam format PDF. Silakan simpan dan gunakan sesuai keperluan.</p>
          ${message ? `<p>${message}</p>` : ''}
          <p>Apabila ada pertanyaan, silakan hubungi Tata Usaha FTI UKSW secara langsung.</p>
          <p>Hormat kami,<br/><strong>Tata Usaha FTI UKSW</strong></p>
        </div>
        <div class="footer">
          Email ini dikirim otomatis oleh sistem CORE.FTI. Mohon tidak membalas email ini.
        </div>
      </div>
    </body>
    </html>
  `;
}

export default transporter;
