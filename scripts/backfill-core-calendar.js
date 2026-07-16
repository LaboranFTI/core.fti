import { pool, ensureCalendarSchema } from '../backend/config/database.js';
import {
  CalendarConflictError,
  CalendarValidationError,
  syncBookingToCalendar,
} from '../backend/services/calendar.service.js';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');

const log = (message) => console.log(`[core-calendar-backfill] ${message}`);

const getApprovedBookings = async () => {
  const result = await pool.query(
    `SELECT b.id, b.keperluan, b.room_id, r.name AS room_name, COUNT(bs.id)::int AS schedule_count
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN booking_schedules bs ON bs.booking_id = b.id
     WHERE b.status = 'Disetujui'
     GROUP BY b.id, b.keperluan, b.room_id, r.name
     ORDER BY MIN(bs.schedule_date), b.id`
  );
  return result.rows;
};

const backfillBooking = async (bookingId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = await syncBookingToCalendar(client, bookingId, null);
    await client.query('COMMIT');
    return Array.isArray(items) ? items.length : 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const main = async () => {
  await ensureCalendarSchema();

  const bookings = await getApprovedBookings();
  log(`Found ${bookings.length} approved bookings with schedules.`);

  if (isDryRun) {
    bookings.forEach((booking) => {
      log(`DRY RUN ${booking.id} | ${booking.room_name} | ${booking.schedule_count} schedule(s) | ${booking.keperluan}`);
    });
    return;
  }

  let synced = 0;
  let failed = 0;
  const failures = [];

  for (const booking of bookings) {
    try {
      const occurrenceCount = await backfillBooking(booking.id);
      synced += 1;
      log(`Synced ${booking.id} -> ${occurrenceCount} occurrence(s).`);
    } catch (err) {
      failed += 1;
      const knownError = err instanceof CalendarConflictError || err instanceof CalendarValidationError;
      failures.push({
        bookingId: booking.id,
        roomName: booking.room_name,
        message: knownError ? err.message : err?.message || String(err),
      });
      log(`FAILED ${booking.id}: ${err?.message || err}`);
    }
  }

  log(`Done. Synced: ${synced}. Failed: ${failed}.`);
  if (failures.length > 0) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
  }
};

main()
  .catch((err) => {
    console.error('[core-calendar-backfill] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
