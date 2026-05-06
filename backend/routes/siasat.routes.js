import express from 'express';
import { XMLParser } from 'fast-xml-parser';
import { pool } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Setup XML Parser
const parser = new XMLParser({
  ignoreAttributes: false,
  textNodeName: "_text",
});

// Fungsi pembantu (mirip XPath //) untuk mencari tag tertentu secara dinamis
// Berguna karena API .NET ASMX sering membungkus data dengan <diffgr:diffgram><NewDataSet>
const findXmlNode = (obj, nodeName) => {
  if (obj === null || typeof obj !== 'object') return undefined;
  if (obj[nodeName]) return obj[nodeName];
  for (const key in obj) {
    const found = findXmlNode(obj[key], nodeName);
    if (found) return found;
  }
  return undefined;
};

const getAutoSemesterCode = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Penyesuaian kalender: Jan-Jun (Genap), Jul-Agu (Antara), Sep-Des (Ganjil)
  if (month >= 1 && month <= 6) return `${year - 1}2`;
  if (month >= 7 && month <= 8) return `${year - 1}3`;
  return `${year}1`;
};

const formatSemesterInfo = (semesterCode) => {
  if (!semesterCode || !/^\d{4}[123]$/.test(String(semesterCode))) {
    return { semesterCode: '', semesterName: '', academicYear: '', label: '' };
  }

  const code = String(semesterCode);
  const year = parseInt(code.slice(0, 4), 10);
  const type = code.slice(4);

  if (type === '1') {
    return {
      semesterCode: code,
      semesterName: 'Ganjil',
      academicYear: `${year}/${year + 1}`,
      label: `Ganjil ${year}/${year + 1}`
    };
  }

  if (type === '2') {
    return {
      semesterCode: code,
      semesterName: 'Genap',
      academicYear: `${year - 1}/${year}`,
      label: `Genap ${year - 1}/${year}`
    };
  }

  return {
    semesterCode: code,
    semesterName: 'Antara',
    academicYear: `${year - 1}/${year}`,
    label: `Antara ${year - 1}/${year}`
  };
};

const resolveSemesterCode = async (requestedSemester) => {
  if (requestedSemester) {
    const semStr = String(requestedSemester).toUpperCase();
    
    // Menerjemahkan logika $sem2 PHP (contoh input: "GANJIL 2017-2018" menjadi "20171")
    if (semStr.includes(' ')) {
      const parts = semStr.split(' ');
      if (parts.length >= 2) {
        const thn = parts[1].split('-')[0];
        if (parts[0] === 'GANJIL') return `${thn}1`;
        if (parts[0] === 'GENAP') return `${thn}2`;
        if (parts[0] === 'ANTARA') return `${thn}3`;
      }
    }
    return String(requestedSemester);
  }

  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'tu_current_semester_code' LIMIT 1");
    const configuredSemester = result.rows[0]?.value;
    if (configuredSemester) return String(configuredSemester);
  } catch (error) {
    console.error('Failed to read semester setting:', error);
  }

  return getAutoSemesterCode();
};

// 1. Endpoint Get Profil Mahasiswa
router.get('/siasat/mahasiswa/:nim', verifyToken, async (req, res) => {
  const { nim } = req.params;

  const SOAP_URL = process.env.SIASAT_SOAP_URL;
  const SOAP_USER = process.env.SIASAT_SOAP_USER;
  const SOAP_PASS = process.env.SIASAT_SOAP_PASS;

  if (!SOAP_URL) {
    console.error('Konfigurasi SIASAT_SOAP_URL tidak ditemukan di environment variables.');
    return res.status(500).json({ error: 'Konfigurasi sistem belum lengkap. Hubungi administrator.' });
  }

  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <getData xmlns="http://kpftiservice.org/">
          <nim>${nim}</nim>
          <useracc>${SOAP_USER}</useracc>
          <pwd>${SOAP_PASS}</pwd>
        </getData>
      </soap:Body>
    </soap:Envelope>
  `;

  try {
    const response = await fetch(SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://kpftiservice.org/getData"'
      },
      body: xmlBody
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const xmlText = await response.text();
    const resultObj = parser.parse(xmlText);
    
    // Cari tag <listmhs> di mana pun ia berada (meniru XPath)
    const listMhs = findXmlNode(resultObj, 'listmhs');
    
    if (!listMhs) {
      return res.status(404).json({ error: 'Data mahasiswa tidak ditemukan di SIASAT' });
    }

    res.json({ success: true, data: listMhs });
  } catch (error) {
    console.error('Error fetch SIASAT Data Mahasiswa:', error);
    res.status(500).json({ error: 'Gagal terhubung ke service SIASAT. Pastikan jaringan terhubung ke intranet.' });
  }
});

// 2. Endpoint Get Jadwal KST Mahasiswa (Untuk Verifikasi)
router.get('/siasat/kst/:nim', verifyToken, async (req, res) => {
  const { nim } = req.params;
  const { semester: rawSemester } = req.query; // contoh: "20241"
  const semester = await resolveSemesterCode(rawSemester);

  if (!/^\d{4}[123]$/.test(semester)) {
      return res.status(400).json({ error: 'Parameter semester tidak valid. Gunakan format seperti 20251, 20252, atau 20253.' });
  }

  const SOAP_URL = process.env.SIASAT_SOAP_URL;
  const SOAP_USER = process.env.SIASAT_SOAP_USER;
  const SOAP_PASS = process.env.SIASAT_SOAP_PASS;

  console.log('[DEBUG SIASAT KST]');
  console.log(`-> Mengecek NIM: ${nim} untuk Semester: ${semester} (${formatSemesterInfo(semester).label})`);

  if (!SOAP_URL) {
    console.error('Konfigurasi SIASAT_SOAP_URL tidak ditemukan di environment variables.');
    return res.status(500).json({ error: 'Konfigurasi sistem belum lengkap. Hubungi administrator.' });
  }

  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetKartuStudi xmlns="http://kpftiservice.org/">
          <nim>${nim}</nim>
          <tahunsem>${semester}</tahunsem>
          <useracc>${SOAP_USER}</useracc>
          <pwd>${SOAP_PASS}</pwd>
        </GetKartuStudi>
      </soap:Body>
    </soap:Envelope>
  `;

  try {
    const response = await fetch(SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://kpftiservice.org/GetKartuStudi"'
      },
      body: xmlBody
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const xmlText = await response.text();
    const resultObj = parser.parse(xmlText);
    
    // Cari tag <listmhskst> di mana pun ia berada (mengabaikan wrapper diffgr dari .NET)
    let listKst = findXmlNode(resultObj, 'listmhskst');
    
    if (!listKst) {
      return res.json({ success: true, data: [] });
    }

    // Jika mata kuliah yang diambil cuma 1, parser mengubahnya jadi object biasa. Paksa jadi array:
    if (!Array.isArray(listKst)) {
        listKst = [listKst];
    }

    // Format output data untuk membuang field yang tidak perlu
    const formattedKST = listKst.map(item => {
        const jamMulaiRaw = item.jammulai ? String(item.jammulai) : '';
        const jamUsaiRaw = item.jamusai ? String(item.jamusai) : '';
        
        // Menerjemahkan logika PHP: substr(...->jammulai,0,2).'-'.substr(...->jamusai,0,2)
        const jamMulaiShort = jamMulaiRaw.length >= 2 ? jamMulaiRaw.substring(0, 2) : '';
        const jamUsaiShort = jamUsaiRaw.length >= 2 ? jamUsaiRaw.substring(0, 2) : '';
        const hariFormatPHP = (jamMulaiShort && jamUsaiShort) ? `${item.hari}, ${jamMulaiShort}-${jamUsaiShort}` : item.hari;

        return {
            kode: item.kodemkl,
            makul: item.namamkl,
            hari: hariFormatPHP, // Menghasilkan format persis seperti PHP lama, misal: "Senin, 08-10"
            jamMulai: jamMulaiRaw.substring(0, 5),
            jamUsai: jamUsaiRaw.substring(0, 5),
            ruang: item.ruang
        };
    });

    res.json({ success: true, data: formattedKST, semester: formatSemesterInfo(semester) });
  } catch (error) {
    console.error('Error fetch SIASAT KST:', error);
    res.status(500).json({ error: 'Gagal terhubung ke service SIASAT' });
  }
});

export default router;
