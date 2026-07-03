import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from '../config/database.js';
import { verifyRole } from '../middleware/auth.js';
const router = express.Router();
const BOOKING_READONLY_ROLES = ['Mahasiswa'];

// Konfigurasi Upload (Simpan sementara di folder uploads/)
const upload = multer({ dest: 'uploads/' });

// Endpoint Summary untuk Statistik Dashboard
router.get('/dashboard/summary', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
    try {
        const [activeLoans, totalUsers, inventoryStats, bookingStats, roomStats, recentBookings] = await Promise.all([
            pool.query("SELECT COUNT(*) as count FROM loans WHERE status = 'Dipinjam'"),
            pool.query("SELECT COUNT(*) as count FROM users WHERE role != 'Admin'"),
            pool.query("SELECT kondisi, COUNT(*) as count FROM inventory GROUP BY kondisi"),
            pool.query("SELECT status, COUNT(*) as count FROM bookings GROUP BY status"),
            pool.query(`
                SELECT r.name, COUNT(b.id) as count 
                FROM rooms r 
                LEFT JOIN bookings b ON r.id = b.room_id 
                GROUP BY r.id, r.name
            `),
            pool.query(`
                SELECT b.id, b.keperluan as purpose, b.status, b.created_at as date, 
                       u.nama as "userName",
                       (SELECT start_time::text FROM booking_schedules bs WHERE bs.booking_id = b.id ORDER BY schedule_date ASC LIMIT 1) as "startTime"
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                ORDER BY b.created_at DESC LIMIT 5
            `)
        ]);

        let good = 0, minor = 0, major = 0, totalEq = 0;
        inventoryStats.rows.forEach(row => {
            const count = parseInt(row.count);
            totalEq += count;
            if (row.kondisi === 'Baik') good += count;
            else if (row.kondisi === 'Rusak Ringan') minor += count;
            else if (row.kondisi === 'Rusak Berat') major += count;
        });

        let totalBookings = 0, pending = 0, approved = 0, rejected = 0;
        bookingStats.rows.forEach(row => {
            const count = parseInt(row.count);
            totalBookings += count;
            if (row.status === 'Pending') pending = count;
            else if (row.status === 'Disetujui') approved = count;
            else if (row.status === 'Ditolak') rejected = count;
        });

        res.json({
            activeLoans: parseInt(activeLoans.rows[0].count),
            totalUsers: parseInt(totalUsers.rows[0].count),
            equipment: { total: totalEq, damaged: minor + major, good, minor, major },
            bookings: { total: totalBookings, pending, approved, rejected },
            roomStats: roomStats.rows.map(r => ({ name: r.name.split(' ').slice(0, 2).join(' '), bookings: parseInt(r.count) })),
            recentBookings: recentBookings.rows.map(b => ({
                ...b,
                startTime: b.startTime ? b.startTime.substring(0, 5) : '-'
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil summary dashboard.' });
    }
});

// Endpoint Summary khusus untuk User (Mahasiswa/Dosen)
router.get('/dashboard/user-summary', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const [bookingStats, recentBookings] = await Promise.all([
            pool.query("SELECT status, COUNT(*) as count FROM bookings WHERE user_id = $1 GROUP BY status", [userId]),
            pool.query(`
                SELECT b.id, b.keperluan as purpose, b.status, b.created_at as date, 
                       u.nama as "userName",
                       (SELECT start_time::text FROM booking_schedules bs WHERE bs.booking_id = b.id ORDER BY schedule_date ASC LIMIT 1) as "startTime"
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.user_id = $1
                ORDER BY b.created_at DESC LIMIT 5
            `, [userId])
        ]);

        let totalBookings = 0, pending = 0, approved = 0, rejected = 0;
        bookingStats.rows.forEach(row => {
            const count = parseInt(row.count);
            totalBookings += count;
            if (row.status === 'Pending') pending = count;
            else if (row.status === 'Disetujui') approved = count;
            else if (row.status === 'Ditolak') rejected = count;
        });

        res.json({
            bookings: { total: totalBookings, pending, approved, rejected },
            recentBookings: recentBookings.rows.map(b => ({
                ...b,
                startTime: b.startTime ? b.startTime.substring(0, 5) : '-'
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengambil summary user.' });
    }
});

// --- BOOKINGS (Tabel: bookings & booking_schedules) ---

router.get('/bookings', async (req, res) => {
    try {
        const excludeFile = req.query.exclude_file === 'true';
        const columns = excludeFile 
            ? 'b.id, b.room_id, b.user_id, b.penanggung_jawab, b.contact_person, b.keperluan, b.status, NULL as file_proposal, CASE WHEN b.file_proposal IS NOT NULL THEN true ELSE false END as has_file, b.tech_support_pic, b.tech_support_needs, b.rejection_reason, b.created_at, b.updated_at'
            : 'b.*, CASE WHEN b.file_proposal IS NOT NULL THEN true ELSE false END as has_file';

        const result = await pool.query(`
            SELECT ${columns}, u.nama as user_name, r.name as room_name, 
                   (SELECT string_agg(s.nama, ', ') FROM staff s WHERE s.id = ANY(b.tech_support_pic)) as tech_pic_name,
                   (SELECT json_agg(json_build_object('date', bs2.schedule_date, 'startTime', bs2.start_time, 'endTime', bs2.end_time, 'kebutuhan', bs2.kebutuhan) ORDER BY bs2.schedule_date)
                    FROM booking_schedules bs2 
                    WHERE bs2.booking_id = b.id) as all_schedules
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN rooms r ON b.room_id = r.id
            ORDER BY b.created_at DESC
        `);
        
        const bookings = result.rows.map(row => ({
            id: row.id,
            roomId: row.room_id,
            userId: row.user_id,
            userName: row.user_name,
            responsiblePerson: row.penanggung_jawab,
            contactPerson: row.contact_person,
            purpose: row.keperluan,
            // Ambil jadwal pertama sebagai default display
            date: (row.all_schedules && row.all_schedules.length > 0) ? new Date(row.all_schedules[0].date).toLocaleDateString('en-CA') : '',
            startTime: (row.all_schedules && row.all_schedules.length > 0) ? row.all_schedules[0].startTime.substring(0, 5) : '',
            endTime: (row.all_schedules && row.all_schedules.length > 0) ? row.all_schedules[0].endTime.substring(0, 5) : '',
            schedules: row.all_schedules || [], // All schedules as array
            status: row.status,
            proposalFile: row.file_proposal ? `data:application/pdf;base64,${row.file_proposal.toString('base64')}` : null,
            hasFile: row.has_file || (row.file_proposal ? true : false),
            techSupportPic: row.tech_support_pic || [], // Ensure array
            techSupportPicName: row.tech_pic_name, // Nama Staff untuk display
            techSupportNeeds: row.tech_support_needs,
            rejectionReason: row.rejection_reason
        }));
        res.json(bookings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// Endpoint untuk On-Demand Fetching File Proposal
router.get('/bookings/:id/file', async (req, res) => {
    try {
        const result = await pool.query('SELECT file_proposal FROM bookings WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0 || !result.rows[0].file_proposal) {
            return res.status(404).json({ error: 'File tidak ditemukan' });
        }
        const base64Data = `data:application/pdf;base64,${result.rows[0].file_proposal.toString('base64')}`;
        res.json({ file: base64Data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

router.post('/bookings', async (req, res) => {
  if (BOOKING_READONLY_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Role Mahasiswa hanya memiliki akses baca pada halaman ruangan.' });
  }

  const { roomId, userId, responsiblePerson, contactPerson, purpose, schedules, autoApprove, techSupportPic, techSupportNeeds, proposalFile, file, file_proposal, fileProposal } = req.body;
  
  // 1. Validasi & Konversi File Proposal (Sebelum Transaksi DB)
  let proposalBuffer = null;
  const base64String = proposalFile || file || file_proposal || fileProposal;
  
  if (base64String && typeof base64String === 'string' && base64String.startsWith('data:') && base64String.includes(',')) {
      const base64Data = base64String.split(',')[1];
      proposalBuffer = Buffer.from(base64Data, 'base64');
      
      // Validasi Ukuran: Max 5MB
      if (proposalBuffer.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Ukuran file proposal melebihi batas maksimum 5MB.' });
      }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const bookingId = `BOOK-${Date.now()}`;
    
    // 2. Set Status Default ke Pending
    let initialStatus = 'Pending';
    if (req.user && (req.user.role === 'Admin' || req.user.role === 'Laboran' || req.user.role === 'Supervisor') && autoApprove) {
      initialStatus = 'Disetujui';
    }

    // Insert Header Booking
    await client.query(
      `INSERT INTO bookings (id, room_id, user_id, penanggung_jawab, contact_person, keperluan, file_proposal, status, tech_support_pic, tech_support_needs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [bookingId, roomId, userId, responsiblePerson, contactPerson, purpose, proposalBuffer, initialStatus, techSupportPic || [], techSupportNeeds || null]
    );

    // Insert Detail Jadwal
    if (schedules && Array.isArray(schedules)) {
      for (const sch of schedules) {
        await client.query(
          `INSERT INTO booking_schedules (booking_id, schedule_date, start_time, end_time, kebutuhan)
           VALUES ($1, $2, $3, $4, $5)`,
          [bookingId, sch.date, sch.startTime, sch.endTime, sch.kebutuhan || null]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, id: bookingId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Gagal membuat booking.' });
  } finally {
    client.release();
  }
});

// Endpoint Update Status (Approve / Reject)
router.put('/bookings/:id/status', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
    const { id } = req.params;
    const { status, techSupportPic, techSupportNeeds, rejectionReason } = req.body;

    try {
        const result = await pool.query(
            `UPDATE bookings
             SET status = $1,
                 tech_support_pic = $2,
                 tech_support_needs = $3,
                 rejection_reason = $4,
                 updated_at = NOW()
             WHERE id = $5 RETURNING id`,
            [status, techSupportPic || [], techSupportNeeds || null, rejectionReason || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking tidak ditemukan' });
        }

        res.json({ success: true, message: 'Status berhasil diperbarui' });
    } catch (err) {
        console.error('Update booking status error:', err);
        res.status(500).json({ error: 'Gagal memperbarui status booking' });
    }
});

// Endpoint Update Data Teknis
router.put('/bookings/:id/tech-support', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
    const { id } = req.params;
    const { techSupportPic, techSupportNeeds } = req.body;

    try {
        const result = await pool.query(
            `UPDATE bookings
             SET tech_support_pic = $1,
                 tech_support_needs = $2,
                 updated_at = NOW()
             WHERE id = $3 RETURNING id`,
            [techSupportPic || [], techSupportNeeds || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking tidak ditemukan' });
        }

        res.json({ success: true, message: 'Data teknis berhasil diperbarui' });
    } catch (err) {
        console.error('Update tech support error:', err);
        res.status(500).json({ error: 'Gagal memperbarui data teknis' });
    }
});

// Endpoint Update Data Booking
router.put('/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const { roomId, responsiblePerson, contactPerson, purpose, schedules, techSupportPic, techSupportNeeds, proposalFile, file, file_proposal, fileProposal } = req.body;
    const loggedInUserId = req.user?.id;
    const loggedInUserRole = req.user?.role;

    if (BOOKING_READONLY_ROLES.includes(loggedInUserRole)) {
        return res.status(403).json({ error: 'Role Mahasiswa hanya memiliki akses baca pada halaman ruangan.' });
    }

    try {
        // Cek data pesanan sebelum diubah
        const checkRes = await pool.query('SELECT user_id, status FROM bookings WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        
        const booking = checkRes.rows[0];
        const isManager = ['Admin', 'Laboran', 'Supervisor'].includes(loggedInUserRole);
        
        // Validasi 1: User A tidak boleh mengedit pesanan User B
        if (!isManager && booking.user_id !== loggedInUserId) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak dapat mengedit pesanan milik pengguna lain.' });
        }
        // Validasi 2: User biasa tidak boleh mengedit pesanan yang sudah diproses
        if (!isManager && booking.status !== 'Pending') {
            return res.status(400).json({ error: 'Pesanan yang sudah diproses (Disetujui/Ditolak) tidak dapat diedit lagi.' });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Gagal memvalidasi kepemilikan booking.' });
    }

    let proposalBuffer = undefined;
    const base64String = proposalFile || file || file_proposal || fileProposal;
    
    if (base64String && typeof base64String === 'string' && base64String.startsWith('data:') && base64String.includes(',')) {
        const base64Data = base64String.split(',')[1];
        proposalBuffer = Buffer.from(base64Data, 'base64');
        if (proposalBuffer.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Ukuran file proposal melebihi batas maksimum 5MB.' });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Update Header Booking
        if (proposalBuffer !== undefined) {
            await client.query(
                `UPDATE bookings SET room_id=$1, penanggung_jawab=$2, contact_person=$3, keperluan=$4, file_proposal=$5, tech_support_pic=$6, tech_support_needs=$7, updated_at=NOW() WHERE id=$8`,
                [roomId, responsiblePerson, contactPerson, purpose, proposalBuffer, techSupportPic || [], techSupportNeeds || null, id]
            );
        } else {
            await client.query(
                `UPDATE bookings SET room_id=$1, penanggung_jawab=$2, contact_person=$3, keperluan=$4, tech_support_pic=$5, tech_support_needs=$6, updated_at=NOW() WHERE id=$7`,
                [roomId, responsiblePerson, contactPerson, purpose, techSupportPic || [], techSupportNeeds || null, id]
            );
        }

        // Update Detail Jadwal (Hapus & Insert Baru)
        await client.query('DELETE FROM booking_schedules WHERE booking_id = $1', [id]);
        if (schedules && Array.isArray(schedules)) {
            for (const sch of schedules) {
                await client.query(
                    `INSERT INTO booking_schedules (booking_id, schedule_date, start_time, end_time, kebutuhan) VALUES ($1, $2, $3, $4, $5)`,
                    [id, sch.date, sch.startTime, sch.endTime, sch.kebutuhan || null]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Booking berhasil diperbarui' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update booking error:', err);
        res.status(500).json({ error: 'Gagal memperbarui booking.' });
    } finally {
        client.release();
    }
});

// Endpoint Delete Booking
router.delete('/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const loggedInUserId = req.user?.id;
    const loggedInUserRole = req.user?.role;

    if (BOOKING_READONLY_ROLES.includes(loggedInUserRole)) {
        return res.status(403).json({ error: 'Role Mahasiswa hanya memiliki akses baca pada halaman ruangan.' });
    }

    try {
        const checkRes = await pool.query('SELECT user_id, status FROM bookings WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Booking tidak ditemukan' });
        
        const booking = checkRes.rows[0];
        const isManager = ['Admin', 'Laboran', 'Supervisor'].includes(loggedInUserRole);
        
        if (!isManager && booking.user_id !== loggedInUserId) {
            return res.status(403).json({ error: 'Akses ditolak. Anda tidak dapat menghapus pesanan milik pengguna lain.' });
        }
        if (!isManager && booking.status === 'Disetujui') {
            return res.status(400).json({ error: 'Pesanan yang sudah disetujui tidak dapat dibatalkan.' });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Gagal memvalidasi kepemilikan booking.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('DELETE FROM booking_schedules WHERE booking_id = $1', [id]);
        const result = await client.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) throw new Error('Booking tidak ditemukan');

        await client.query('COMMIT');
        res.json({ success: true, message: 'Booking berhasil dihapus' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete booking error:', err);
        res.status(500).json({ error: 'Gagal menghapus booking' });
    } finally {
        client.release();
    }
});

// Endpoint Export Excel
router.get('/bookings/export', verifyRole(['Admin', 'Laboran', 'Supervisor']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.id, b.keperluan, b.penanggung_jawab, b.contact_person, b.status, b.created_at,
                   u.nama as peminjam, r.name as ruang,
                   (SELECT string_agg(s.nama, ', ') FROM staff s WHERE s.id = ANY(b.tech_support_pic)) as teknisi,
                   b.tech_support_needs
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN rooms r ON b.room_id = r.id
            ORDER BY b.created_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Peminjaman Ruang');

        worksheet.columns = [
            { header: 'ID Booking', key: 'id', width: 20 },
            { header: 'Peminjam', key: 'peminjam', width: 25 },
            { header: 'Ruangan', key: 'ruang', width: 20 },
            { header: 'Keperluan', key: 'keperluan', width: 35 },
            { header: 'Penanggung Jawab', key: 'penanggung_jawab', width: 25 },
            { header: 'Kontak', key: 'contact_person', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Teknisi', key: 'teknisi', width: 25 },
            { header: 'Kebutuhan Teknis', key: 'tech_support_needs', width: 35 },
            { header: 'Tanggal Dibuat', key: 'created_at', width: 20 }
        ];

        result.rows.forEach(row => {
            worksheet.addRow({
                ...row,
                created_at: new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Peminjaman_Ruang.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export Excel error:', err);
        res.status(500).json({ error: 'Gagal mengekspor data' });
    }
});

export default router;
