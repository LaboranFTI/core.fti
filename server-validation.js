import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 5001; // Port ini yang akan ditunneling

// Serve file statik dari hasil build React (folder dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback SPA: Semua rute dikembalikan ke index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Validation server berjalan di http://localhost:${port}`);
});
