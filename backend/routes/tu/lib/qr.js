import { fileURLToPath } from 'url';

import path from "path";
import qrcode from 'qr.js';


import fs from "fs/promises";





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QR_CENTER_LOGO_PATH = path.join(__dirname, '..', '..', '..', '..', 'src', 'assets', 'FTI_nobg.svg');
let qrCenterLogoDataUrlPromise = null;

const getQrCenterLogoDataUrl = async () => {
  if (!qrCenterLogoDataUrlPromise) {
    qrCenterLogoDataUrlPromise = fs.readFile(QR_CENTER_LOGO_PATH)
      .then((buffer) => `data:image/svg+xml;base64,${buffer.toString('base64')}`)
      .catch((err) => {
        qrCenterLogoDataUrlPromise = null;
        console.warn('Failed to load TU QR center logo:', err.message);
        return '';
      });
  }

  return qrCenterLogoDataUrlPromise;
};

const createQrSvgDataUrl = async (value) => {
  if (!value) return '';

  const qr = qrcode(value, { errorCorrectLevel: qrcode.ErrorCorrectLevel.H });
  const moduleCount = qr.getModuleCount();
  const quietZone = 4;
  const size = moduleCount + quietZone * 2;
  const rects = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        rects.push(`<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1"/>`);
      }
    }
  }

  const logoDataUrl = await getQrCenterLogoDataUrl();
  const logoSize = Math.max(8, size * 0.25);
  const logoPadding = Math.max(1.25, size * 0.045);
  const logoFrameSize = logoSize + logoPadding * 2;
  const logoFrameCenter = size / 2;
  const logoFrameRadius = logoFrameSize / 2;
  const logoX = (size - logoSize) / 2;
  const logoMarkup = logoDataUrl
    ? `<circle cx="${logoFrameCenter}" cy="${logoFrameCenter}" r="${logoFrameRadius}" fill="#fff" shape-rendering="geometricPrecision"/><image href="${logoDataUrl}" x="${logoX}" y="${logoX}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><g fill="#000">${rects.join('')}</g>${logoMarkup}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};






export {
  QR_CENTER_LOGO_PATH,
  getQrCenterLogoDataUrl,
  createQrSvgDataUrl
};
