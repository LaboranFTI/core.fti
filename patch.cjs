const fs = require('fs');
const path = require('path');
const p = path.join('backend', 'routes', 'tu', 'requests.ta.js');
let cnt = fs.readFileSync(p, 'utf8');
const endpoints = `

router.post('/tu/research-letter/submit', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'pending', req, 'research');
    await client.query('COMMIT');
    res.status(201).json({ success: true, requestData, message: 'Surat penelitian berhasil diajukan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Submit research letter error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Gagal mengajukan surat penelitian.' });
  } finally {
    client.release();
  }
});

router.post('/tu/interview-letter/submit', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'pending', req, 'interview');
    await client.query('COMMIT');
    res.status(201).json({ success: true, requestData, message: 'Surat wawancara berhasil diajukan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Submit interview letter error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Gagal mengajukan surat wawancara.' });
  } finally {
    client.release();
  }
});

router.post('/tu/permission-letter/submit', verifyRole(TU_SUBMIT_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTuInfrastructure();
    await client.query('BEGIN');
    const requestData = await createFinalResearchRequest(client, req.body, 'pending', req, 'permission');
    await client.query('COMMIT');
    res.status(201).json({ success: true, requestData, message: 'Surat perizinan berhasil diajukan.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Submit permission letter error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Gagal mengajukan surat perizinan.' });
  } finally {
    client.release();
  }
});

`;
cnt = cnt.replace('// ─── Research letter actions ──────────────────────────────────────────────────', '// ─── Research letter actions ──────────────────────────────────────────────────' + endpoints);
fs.writeFileSync(p, cnt);
console.log('Patched');
