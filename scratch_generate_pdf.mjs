import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

async function generateDummyPdf() {
  const templatePath = path.resolve('f:/Silab FTI/core.fti/backend/lettersTU/suratPenelitianV2.html');
  let html = await fs.readFile(templatePath, 'utf8');

  // Load layout CSS logic to include the 14pt fonts etc
  const layoutScriptPath = path.resolve('f:/Silab FTI/core.fti/backend/routes/tu/lib/letterLayout.js');
  const { applyOfficialLetterTypography } = await import('file://' + layoutScriptPath);
  
  html = applyOfficialLetterTypography(html);

  // Replace placeholders with extensive dummy data to force multiple pages
  html = html.replace(/\{\{letterNumber\}\}/g, '012/FTI/Penelitian/VII/2026')
             .replace(/\{\{currentDate\}\}/g, '16 Juli 2026')
             .replace(/\{\{assignmentType\}\}/g, 'Tugas Talenta Unggul')
             .replace(/\{\{name\}\}/g, 'Firmandez Febrian Afandy')
             .replace(/\{\{nim\}\}/g, '682022013')
             .replace(/\{\{programStudy\}\}/g, 'Sistem Informasi (S1)')
             .replace(/\{\{researchTitle\}\}/g, 'Pengaruh Penerapan Artificial Intelligence dalam Meningkatkan Efisiensi dan Efektivitas Sistem Administrasi Surat Menyurat pada Fakultas Teknologi Informasi Universitas Kristen Satya Wacana Salatiga')
             .replace(/\{\{companyName\}\}/g, 'PT Inovasi Teknologi Masa Depan Indonesia Raya')
             .replace(/\{\{companyAddress\}\}/g, 'Jl. Jenderal Sudirman No. 123, Kompleks Perkantoran Satya Wacana, Lantai 5 Ruang 501')
             .replace(/\{\{companyCity\}\}/g, 'Kec. Sidorejo, Kel. Salatiga, Kota Salatiga, Provinsi Jawa Tengah, 50711')
             .replace(/\{\{researchAdvisors\}\}/g, '<tr><td style="width:23%;">Dosen Pembimbing</td><td style="width:2%;">:</td><td style="width:75%;">Dr. Ir. Budi Santoso, S.Kom., M.Cs.</td></tr>')
             .replace(/\{\{deanName\}\}/g, 'Prof. Dr. Ir. Antonius Rachmat C, S.Kom., M.Cs.')
             .replace(/\{\{tembusanBlock\}\}/g, `
      <div class="carbon-copy-block" style="margin-top: 8mm; font-size: 11pt; line-height: 1.5; page-break-inside: avoid;">
          <p style="margin: 0; font-weight: bold;">Tembusan</p>
          <ul style="margin: 1mm 0 0 0; padding: 0; list-style: none;">
              <li style="list-style: none; margin: 0; padding: 0 0 0 2mm; text-indent: -2mm;">- Dekan Fakultas Teknologi Informasi</li>
              <li style="list-style: none; margin: 0; padding: 0 0 0 2mm; text-indent: -2mm;">- Kaprodi Sistem Informasi</li>
              <li style="list-style: none; margin: 0; padding: 0 0 0 2mm; text-indent: -2mm;">- Arsip</li>
          </ul>
      </div>`)
             .replace(/\{\{signatureImage\}\}/g, '')
             .replace(/\{\{stampImage\}\}/g, '')
             .replace(/\{\{qrCodeImage\}\}/g, '')
             .replace(/\{\{marginConfiguration\}\}/g, 'padding-top: 40mm; padding-bottom: 30mm; padding-left: 20mm; padding-right: 20mm;');

  // Make the data very long to force a second page (e.g. long research title or extra content)
  // Let's add extra dummy content inside the researchTitle to really force it
  html = html.replace(/\{\{researchTitle\}\}/g, 'Pengaruh Penerapan Artificial Intelligence dalam Meningkatkan Efisiensi dan Efektivitas Sistem Administrasi Surat Menyurat pada Fakultas Teknologi Informasi Universitas Kristen Satya Wacana Salatiga. Penelitian ini juga mencakup aspek keamanan data, skalabilitas sistem, dan integrasi dengan sistem legacy yang sudah ada sebelumnya. Diharapkan hasil penelitian ini dapat memberikan kontribusi nyata bagi perkembangan teknologi informasi di bidang administrasi pendidikan tinggi, serta menjadi rujukan bagi institusi lain yang ingin menerapkan sistem serupa.');


  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();

  const outputPath = path.resolve('E:/Users/Mythroidz/.gemini/antigravity/brain/d3df936f-df23-4226-929d-69fc66ad7813/media_eval_font.pdf');
  await fs.writeFile(outputPath, pdfBuffer);
  console.log('PDF generated at:', outputPath);
}

generateDummyPdf().catch(console.error);
