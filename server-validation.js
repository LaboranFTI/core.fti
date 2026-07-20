import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 5001; // Port ini yang akan ditunneling

// ─── Proxy /api/* ke backend lokal di port 5000 ────────────────────────────
// Ini diperlukan agar HP (dari internet) bisa mengakses API melalui tunnel
// tanpa harus mengakses core.fti.uksw.edu (DNS lokal)
const BACKEND_URL = 'http://127.0.0.1:5000';

app.use('/api', async (req, res) => {
  const targetUrl = `${BACKEND_URL}/api${req.url}`;
  const headers = { ...req.headers };

  // Hapus header yang bisa menyebabkan masalah
  delete headers['host'];
  delete headers['connection'];

  try {
    const fetchInit = {
      method: req.method,
      headers,
    };

    // Untuk request yang punya body (POST, PUT, PATCH, DELETE)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });
      if (chunks.length > 0) {
        fetchInit.body = Buffer.concat(chunks);
      }
    }

    const backendRes = await fetch(targetUrl, fetchInit);

    // Teruskan status dan headers dari backend
    res.status(backendRes.status);
    backendRes.headers.forEach((value, key) => {
      // Tambahkan CORS headers agar HP dari luar bisa mengakses
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Tambahkan CORS headers untuk akses publik
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const body = await backendRes.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (err) {
    console.error('[proxy] Error forwarding to backend:', err.message);
    res.status(502).json({ error: 'Backend tidak dapat dijangkau', detail: err.message });
  }
});

// Handle preflight CORS OPTIONS
app.options('/api/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

// ─── Serve file statik dari hasil build React (folder dist) ────────────────
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback SPA: Semua rute dikembalikan ke index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`[validation-server] Berjalan di http://localhost:${port}`);
  console.log(`[validation-server] Proxy /api/* → ${BACKEND_URL}`);
});
