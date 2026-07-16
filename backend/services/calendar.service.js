import { createHash } from 'node:crypto';
import { pool } from '../config/database.js';

const CORE_CALENDAR_SOURCE_ID = 'CORE_CALENDAR';
const JAKARTA_OFFSET = '+07:00';
const ACTIVE_CALENDAR_STATUSES = new Set(['scheduled', 'tentative']);

export class CalendarConflictError extends Error {
  constructor(message = 'Jadwal bentrok dengan event lain pada ruangan yang sama.') {
    super(message);
    this.name = 'CalendarConflictError';
    this.code = 'CALENDAR_CONFLICT';
    this.status = 409;
  }
}

export class CalendarValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalendarValidationError';
    this.code = 'CALENDAR_VALIDATION_ERROR';
    this.status = 422;
  }
}

export class CalendarNotFoundError extends Error {
  constructor(message = 'Event kalender tidak ditemukan.') {
    super(message);
    this.name = 'CalendarNotFoundError';
    this.code = 'CALENDAR_NOT_FOUND';
    this.status = 404;
  }
}

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const createStableId = (prefix, value) => {
  const digest = createHash('sha1').update(String(value)).digest('hex').slice(0, 24).toUpperCase();
  return `${prefix}-${digest}`;
};

const createBookingEventId = (bookingId) => createStableId('CALB', bookingId);
const createBookingOccurrenceId = (bookingScheduleId) => `CALO-BS-${bookingScheduleId}`;
const createClassScheduleEventId = (scheduleId) => createStableId('CALCS', scheduleId);
const createClassScheduleOccurrenceId = (scheduleId, date) => createStableId('CALO-CS', `${scheduleId}:${date}`);

const DAY_NUMBER_BY_NAME = {
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
};

const RRULE_DAY_BY_NAME = {
  Minggu: 'SU',
  Senin: 'MO',
  Selasa: 'TU',
  Rabu: 'WE',
  Kamis: 'TH',
  Jumat: 'FR',
  Sabtu: 'SA',
};

const normalizeDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizeTime = (value) => {
  if (!value) return '';
  return String(value).slice(0, 5);
};

const buildJakartaTimestamp = (date, time) => `${normalizeDate(date)}T${normalizeTime(time)}:00${JAKARTA_OFFSET}`;

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

const parseDateAsUtc = (value, label) => {
  const date = normalizeDate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new CalendarValidationError(`${label} harus berformat YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new CalendarValidationError(`${label} tidak valid.`);
  }

  return parsed;
};

const formatUtcDate = (value) => value.toISOString().slice(0, 10);

const addUtcDays = (value, days) => {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getClassScheduleOccurrenceDates = (schedule) => {
  const dayOfWeek = String(schedule.day_of_week || '').trim();
  const targetDay = DAY_NUMBER_BY_NAME[dayOfWeek];
  if (targetDay === undefined) {
    throw new CalendarValidationError('Hari jadwal kelas tidak valid.');
  }

  const startDate = parseDateAsUtc(schedule.start_date, 'Tanggal mulai periode');
  const endDate = parseDateAsUtc(schedule.end_date, 'Tanggal selesai periode');
  if (endDate < startDate) {
    throw new CalendarValidationError('Tanggal selesai periode harus setelah tanggal mulai.');
  }

  const distance = (targetDay - startDate.getUTCDay() + 7) % 7;
  const dates = [];
  for (let cursor = addUtcDays(startDate, distance); cursor <= endDate; cursor = addUtcDays(cursor, 7)) {
    dates.push(formatUtcDate(cursor));
  }

  return dates;
};

const buildClassScheduleTitle = (schedule) => {
  const classGroup = schedule.class_group && schedule.class_group !== '-' ? ` (${schedule.class_group})` : '';
  return `${schedule.course_code} ${schedule.course_name}${classGroup}`.trim();
};

const buildClassScheduleDescription = (schedule) => [
  `Mata Kuliah: ${schedule.course_name}`,
  `Kode: ${schedule.course_code}`,
  `Kelas: ${schedule.class_group || '-'}`,
  `Dosen: ${schedule.resolved_lecturer_name || schedule.lecturer_name || '-'}`,
  `Semester: ${schedule.semester} ${schedule.academic_year}`,
  '',
  'Diinput via CORE.FTI',
].join('\n');

const mapEventRow = (row) => ({
  id: row.occurrence_id || row.event_id,
  eventId: row.event_id,
  occurrenceId: row.occurrence_id,
  sourceId: row.source_id,
  roomId: row.room_id,
  roomName: row.room_name,
  bookingId: row.booking_id,
  bookingScheduleId: row.booking_schedule_id,
  title: row.title,
  summary: row.title,
  description: row.description,
  location: row.location,
  eventType: row.event_type,
  status: row.occurrence_status || row.event_status,
  eventStatus: row.event_status,
  visibility: row.visibility,
  timezone: row.timezone,
  isAllDay: row.is_all_day,
  startAt: toIso(row.start_at),
  endAt: toIso(row.end_at),
  start: row.is_all_day
    ? { date: toIso(row.start_at)?.slice(0, 10) }
    : { dateTime: toIso(row.start_at) },
  end: row.is_all_day
    ? { date: toIso(row.end_at)?.slice(0, 10) }
    : { dateTime: toIso(row.end_at) },
  htmlLink: '',
});

const withTransaction = async (queryable, task) => {
  if (queryable) return task(queryable);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await task(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const translateDbError = (err) => {
  if (err?.code === '23P01') {
    throw new CalendarConflictError();
  }
  if (err?.code === '23505') {
    throw new CalendarConflictError('Data kalender dengan identitas yang sama sudah ada.');
  }
  if (err?.code === '23503') {
    throw new CalendarValidationError('Referensi kalender tidak valid atau tidak ditemukan.');
  }
  if (err?.code === '23514') {
    throw new CalendarValidationError('Nilai kalender tidak memenuhi aturan validasi.');
  }
  if (err?.code === '22007' || err?.code === '22008' || err?.code === '22P02') {
    throw new CalendarValidationError('Format tanggal, waktu, atau nilai kalender tidak valid.');
  }
  throw err;
};

const ensureValidOccurrence = (occurrence) => {
  if (!occurrence.startAt || !occurrence.endAt) {
    throw new CalendarValidationError('startAt dan endAt wajib diisi.');
  }
  const startMs = new Date(occurrence.startAt).getTime();
  const endMs = new Date(occurrence.endAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new CalendarValidationError('Format startAt atau endAt tidak valid.');
  }
  if (endMs <= startMs) {
    throw new CalendarValidationError('endAt harus lebih besar dari startAt.');
  }
};

const normalizeOccurrences = (payload) => {
  const rawOccurrences = Array.isArray(payload.occurrences) && payload.occurrences.length > 0
    ? payload.occurrences
    : [{
        roomId: payload.roomId,
        startAt: payload.startAt,
        endAt: payload.endAt,
        isAllDay: payload.isAllDay,
        notes: payload.notes,
        bookingScheduleId: payload.bookingScheduleId,
      }];

  return rawOccurrences.map((occurrence) => {
    const normalized = {
      roomId: occurrence.roomId || payload.roomId || null,
      bookingScheduleId: occurrence.bookingScheduleId || null,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      isAllDay: Boolean(occurrence.isAllDay),
      status: occurrence.status || payload.status || 'scheduled',
      notes: occurrence.notes || null,
    };
    ensureValidOccurrence(normalized);
    return normalized;
  });
};

const lockOccurrenceRooms = async (client, occurrences) => {
  const roomIds = [...new Set(
    occurrences
      .filter((occurrence) => occurrence.roomId && ACTIVE_CALENDAR_STATUSES.has(occurrence.status || 'scheduled'))
      .map((occurrence) => String(occurrence.roomId))
  )].sort();

  for (const roomId of roomIds) {
    await client.query('SELECT pg_advisory_xact_lock($1::integer, hashtext($2)::integer)', [74001, roomId]);
  }
};

const assertNoOccurrenceConflicts = async (client, occurrences, excludeEventId = null) => {
  for (const occurrence of occurrences) {
    if (!occurrence.roomId || !ACTIVE_CALENDAR_STATUSES.has(occurrence.status || 'scheduled')) {
      continue;
    }

    const params = [occurrence.roomId, occurrence.startAt, occurrence.endAt];
    const excludeSql = excludeEventId ? `AND o.event_id <> $${params.push(excludeEventId)}` : '';
    const result = await client.query(
      `SELECT e.title, r.name AS room_name, o.start_at, o.end_at
       FROM calendar_occurrences o
       JOIN calendar_events e ON e.id = o.event_id
       LEFT JOIN rooms r ON r.id = o.room_id
       WHERE o.room_id = $1
         AND o.status IN ('scheduled', 'tentative')
         AND e.status IN ('scheduled', 'tentative')
         AND o.start_at < $3
         AND o.end_at > $2
         ${excludeSql}
       ORDER BY o.start_at ASC
       LIMIT 1`,
      params
    );

    if (result.rows.length > 0) {
      const conflict = result.rows[0];
      throw new CalendarConflictError(
        `Jadwal bentrok dengan "${conflict.title}" pada ${conflict.room_name || occurrence.roomId}.`
      );
    }
  }
};

const insertCalendarOccurrence = async (client, eventId, occurrence, occurrenceId = createId('CALO')) => {
  await client.query(
    `INSERT INTO calendar_occurrences (
       id, event_id, room_id, booking_schedule_id, start_at, end_at, is_all_day, status, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      occurrenceId,
      eventId,
      occurrence.roomId,
      occurrence.bookingScheduleId,
      occurrence.startAt,
      occurrence.endAt,
      occurrence.isAllDay,
      occurrence.status,
      occurrence.notes,
    ]
  );
};

export const listCalendarEvents = async ({
  roomId,
  timeMin,
  timeMax,
  status,
  q,
  includeGlobal = true,
  maxResults = 500,
} = {}, queryable = pool) => {
  const params = [];
  const where = [];

  if (timeMin) {
    params.push(timeMin);
    where.push(`o.end_at > $${params.length}`);
  }
  if (timeMax) {
    params.push(timeMax);
    where.push(`o.start_at < $${params.length}`);
  }
  if (roomId) {
    params.push(roomId);
    where.push(includeGlobal ? `(o.room_id = $${params.length} OR o.room_id IS NULL)` : `o.room_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  } else {
    where.push("o.status <> 'cancelled'");
    where.push("e.status <> 'cancelled'");
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
  }

  const limit = Math.min(Math.max(Number(maxResults) || 500, 1), 1000);
  params.push(limit);

  const result = await queryable.query(
    `SELECT
       e.id AS event_id,
       e.source_id,
       e.room_id AS event_room_id,
       e.booking_id,
       e.title,
       e.description,
       e.location,
       e.event_type,
       e.status AS event_status,
       e.visibility,
       e.timezone,
       o.id AS occurrence_id,
       o.room_id,
       r.name AS room_name,
       o.booking_schedule_id,
       o.start_at,
       o.end_at,
       o.is_all_day,
       o.status AS occurrence_status
     FROM calendar_occurrences o
     JOIN calendar_events e ON e.id = o.event_id
     LEFT JOIN rooms r ON r.id = o.room_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY o.start_at ASC, e.title ASC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map(mapEventRow);
};

export const getCalendarEvent = async (eventId, queryable = pool) => {
  const result = await queryable.query(
    `SELECT
       e.id AS event_id,
       e.source_id,
       e.room_id AS event_room_id,
       e.booking_id,
       e.title,
       e.description,
       e.location,
       e.event_type,
       e.status AS event_status,
       e.visibility,
       e.timezone,
       o.id AS occurrence_id,
       o.room_id,
       r.name AS room_name,
       o.booking_schedule_id,
       o.start_at,
       o.end_at,
       o.is_all_day,
       o.status AS occurrence_status
     FROM calendar_events e
     LEFT JOIN calendar_occurrences o ON o.event_id = e.id
     LEFT JOIN rooms r ON r.id = o.room_id
     WHERE e.id = $1
     ORDER BY o.start_at ASC`,
    [eventId]
  );

  return result.rows.map(mapEventRow);
};

export const createCalendarEvent = async (payload, actorUserId, queryable = null) => withTransaction(queryable, async (client) => {
  if (!payload.title || !String(payload.title).trim()) {
    throw new CalendarValidationError('title wajib diisi.');
  }

  const eventId = payload.id || createId('CAL');
  const occurrences = normalizeOccurrences(payload);

  try {
    await lockOccurrenceRooms(client, occurrences);
    await assertNoOccurrenceConflicts(client, occurrences, eventId);

    await client.query(
      `INSERT INTO calendar_events (
         id, source_id, room_id, booking_id, source_reference_type, source_reference_id,
         title, description, location, event_type, status, visibility, timezone,
         recurrence_rule, recurrence_until, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
      [
        eventId,
        payload.sourceId || CORE_CALENDAR_SOURCE_ID,
        payload.roomId || occurrences[0]?.roomId || null,
        payload.bookingId || null,
        payload.sourceReferenceType || null,
        payload.sourceReferenceId || null,
        String(payload.title).trim(),
        payload.description || null,
        payload.location || null,
        payload.eventType || 'manual',
        payload.status || 'scheduled',
        payload.visibility || 'internal',
        payload.timezone || 'Asia/Jakarta',
        payload.recurrenceRule || null,
        payload.recurrenceUntil || null,
        actorUserId || null,
      ]
    );

    for (const occurrence of occurrences) {
      await insertCalendarOccurrence(client, eventId, occurrence);
    }

    await client.query(
      `INSERT INTO calendar_audit_logs (id, event_id, actor_user_id, action, next_data)
       VALUES ($1, $2, $3, 'created', $4)`,
      [createId('CALA'), eventId, actorUserId || null, JSON.stringify({ ...payload, occurrences })]
    );
  } catch (err) {
    translateDbError(err);
  }

  return getCalendarEvent(eventId, client);
});

export const updateCalendarEvent = async (eventId, payload, actorUserId, queryable = null) => withTransaction(queryable, async (client) => {
  const previous = await getCalendarEvent(eventId, client);
  if (previous.length === 0) {
    throw new CalendarNotFoundError();
  }

  const eventUpdates = [];
  const params = [];
  const setValue = (column, value) => {
    params.push(value);
    eventUpdates.push(`${column} = $${params.length}`);
  };

  if (payload.title !== undefined) setValue('title', payload.title);
  if (payload.description !== undefined) setValue('description', payload.description || null);
  if (payload.location !== undefined) setValue('location', payload.location || null);
  if (payload.eventType !== undefined) setValue('event_type', payload.eventType);
  if (payload.status !== undefined) setValue('status', payload.status);
  if (payload.visibility !== undefined) setValue('visibility', payload.visibility);
  if (payload.timezone !== undefined) setValue('timezone', payload.timezone);
  if (payload.roomId !== undefined) setValue('room_id', payload.roomId || null);
  if (payload.recurrenceRule !== undefined) setValue('recurrence_rule', payload.recurrenceRule || null);
  if (payload.recurrenceUntil !== undefined) setValue('recurrence_until', payload.recurrenceUntil || null);
  setValue('updated_by', actorUserId || null);
  eventUpdates.push('updated_at = NOW()');

  params.push(eventId);
  try {
    await client.query(`UPDATE calendar_events SET ${eventUpdates.join(', ')} WHERE id = $${params.length}`, params);
  } catch (err) {
    translateDbError(err);
  }

  const shouldReplaceOccurrences = payload.occurrences || payload.startAt || payload.endAt;
  const replacementOccurrences = shouldReplaceOccurrences ? normalizeOccurrences(payload) : null;

  if (replacementOccurrences) {
    await lockOccurrenceRooms(client, replacementOccurrences);
    await assertNoOccurrenceConflicts(client, replacementOccurrences, eventId);
  }

  if (shouldReplaceOccurrences) {
    try {
      await client.query('DELETE FROM calendar_occurrences WHERE event_id = $1', [eventId]);
      for (const occurrence of replacementOccurrences) {
        await insertCalendarOccurrence(client, eventId, occurrence);
      }
    } catch (err) {
      translateDbError(err);
    }
  }

  if (payload.status === 'cancelled') {
    await client.query("UPDATE calendar_occurrences SET status = 'cancelled', updated_at = NOW() WHERE event_id = $1", [eventId]);
  }

  const next = await getCalendarEvent(eventId, client);
  await client.query(
    `INSERT INTO calendar_audit_logs (id, event_id, actor_user_id, action, previous_data, next_data)
     VALUES ($1, $2, $3, 'updated', $4, $5)`,
    [createId('CALA'), eventId, actorUserId || null, JSON.stringify(previous), JSON.stringify(next)]
  );

  return next;
});

export const cancelCalendarEvent = async (eventId, actorUserId, queryable = null) => withTransaction(queryable, async (client) => {
  const previous = await getCalendarEvent(eventId, client);
  if (previous.length === 0) {
    throw new CalendarNotFoundError();
  }

  await client.query("UPDATE calendar_events SET status = 'cancelled', updated_by = $1, updated_at = NOW() WHERE id = $2", [actorUserId || null, eventId]);
  await client.query("UPDATE calendar_occurrences SET status = 'cancelled', updated_at = NOW() WHERE event_id = $1", [eventId]);
  await client.query(
    `INSERT INTO calendar_audit_logs (id, event_id, actor_user_id, action, previous_data)
     VALUES ($1, $2, $3, 'cancelled', $4)`,
    [createId('CALA'), eventId, actorUserId || null, JSON.stringify(previous)]
  );
});

export const cancelCalendarEventsForBooking = async (queryable, bookingId, actorUserId) => {
  const result = await queryable.query('SELECT id FROM calendar_events WHERE booking_id = $1 AND status <> $2', [bookingId, 'cancelled']);
  for (const row of result.rows) {
    await cancelCalendarEvent(row.id, actorUserId, queryable);
  }
};

export const cancelCalendarEventsForClassSchedule = async (queryable, scheduleId, actorUserId) => {
  const result = await queryable.query(
    `SELECT id
     FROM calendar_events
     WHERE source_reference_type = 'class_schedule'
       AND source_reference_id = $1
       AND status <> 'cancelled'`,
    [scheduleId]
  );
  for (const row of result.rows) {
    await cancelCalendarEvent(row.id, actorUserId, queryable);
  }
};

export const syncClassScheduleToCalendar = async (queryable, scheduleId, actorUserId) => {
  const scheduleResult = await queryable.query(
    `SELECT
       cs.*,
       r.name AS room_name,
       COALESCE(l.nama, cs.lecturer_name) AS resolved_lecturer_name
     FROM class_schedules cs
     LEFT JOIN rooms r ON r.id = cs.room_id
     LEFT JOIN lecturer l ON l.id = cs.lecturer_id
     WHERE cs.id = $1`,
    [scheduleId]
  );
  const schedule = scheduleResult.rows[0];
  if (!schedule) {
    throw new CalendarValidationError('Jadwal kelas tidak ditemukan untuk sinkronisasi kalender.');
  }

  if (!schedule.room_id || !schedule.start_date || !schedule.end_date) {
    await cancelCalendarEventsForClassSchedule(queryable, scheduleId, actorUserId);
    return null;
  }

  const dates = getClassScheduleOccurrenceDates(schedule);
  if (dates.length === 0) {
    throw new CalendarValidationError('Periode jadwal kelas tidak memiliki pertemuan pada hari yang dipilih.');
  }

  const existingEvent = await queryable.query(
    `SELECT id
     FROM calendar_events
     WHERE source_reference_type = 'class_schedule'
       AND source_reference_id = $1
     ORDER BY CASE WHEN status <> 'cancelled' THEN 0 ELSE 1 END, created_at ASC
     LIMIT 1`,
    [scheduleId]
  );
  const eventId = existingEvent.rows[0]?.id || createClassScheduleEventId(scheduleId);
  const title = buildClassScheduleTitle(schedule);
  const occurrences = normalizeOccurrences({
    roomId: schedule.room_id,
    status: 'scheduled',
    occurrences: dates.map((date) => ({
      roomId: schedule.room_id,
      startAt: buildJakartaTimestamp(date, schedule.start_time),
      endAt: buildJakartaTimestamp(date, schedule.end_time),
      notes: `${schedule.semester} ${schedule.academic_year}`,
    })),
  });
  const occurrenceIds = dates.map((date) => createClassScheduleOccurrenceId(scheduleId, date));

  try {
    await lockOccurrenceRooms(queryable, occurrences);
    await assertNoOccurrenceConflicts(queryable, occurrences, eventId);

    const previous = await getCalendarEvent(eventId, queryable);

    await queryable.query(
      `INSERT INTO calendar_events (
         id, source_id, room_id, booking_id, source_reference_type, source_reference_id,
         title, description, location, event_type, status, visibility, timezone,
         recurrence_rule, recurrence_until, created_by, updated_by
       )
       VALUES ($1, $2, $3, NULL, 'class_schedule', $4, $5, $6, $7, 'class_schedule', 'scheduled', 'internal', 'Asia/Jakarta', $8, $9, $10, $10)
       ON CONFLICT (id) DO UPDATE
       SET source_id = EXCLUDED.source_id,
           room_id = EXCLUDED.room_id,
           booking_id = NULL,
           source_reference_type = 'class_schedule',
           source_reference_id = EXCLUDED.source_reference_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           location = EXCLUDED.location,
           event_type = 'class_schedule',
           status = 'scheduled',
           visibility = 'internal',
           timezone = 'Asia/Jakarta',
           recurrence_rule = EXCLUDED.recurrence_rule,
           recurrence_until = EXCLUDED.recurrence_until,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
      [
        eventId,
        CORE_CALENDAR_SOURCE_ID,
        schedule.room_id,
        scheduleId,
        title,
        buildClassScheduleDescription(schedule),
        schedule.room_name || null,
        `FREQ=WEEKLY;BYDAY=${RRULE_DAY_BY_NAME[schedule.day_of_week]}`,
        buildJakartaTimestamp(schedule.end_date, schedule.end_time),
        actorUserId || null,
      ]
    );

    await queryable.query(
      `UPDATE calendar_occurrences
       SET status = 'cancelled', updated_at = NOW()
       WHERE event_id = $1
         AND NOT (id = ANY($2::varchar[]))`,
      [eventId, occurrenceIds]
    );

    for (const [index, occurrence] of occurrences.entries()) {
      await queryable.query(
        `INSERT INTO calendar_occurrences (
           id, event_id, room_id, booking_schedule_id, start_at, end_at, is_all_day, status, notes
         )
         VALUES ($1, $2, $3, NULL, $4, $5, $6, 'scheduled', $7)
         ON CONFLICT (id) DO UPDATE
         SET event_id = EXCLUDED.event_id,
             room_id = EXCLUDED.room_id,
             booking_schedule_id = NULL,
             start_at = EXCLUDED.start_at,
             end_at = EXCLUDED.end_at,
             is_all_day = EXCLUDED.is_all_day,
             status = 'scheduled',
             notes = EXCLUDED.notes,
             updated_at = NOW()`,
        [
          occurrenceIds[index],
          eventId,
          occurrence.roomId,
          occurrence.startAt,
          occurrence.endAt,
          occurrence.isAllDay,
          occurrence.notes,
        ]
      );
    }

    const next = await getCalendarEvent(eventId, queryable);
    await queryable.query(
      `INSERT INTO calendar_audit_logs (id, event_id, actor_user_id, action, previous_data, next_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        createId('CALA'),
        eventId,
        actorUserId || null,
        previous.length > 0 ? 'synced' : 'created',
        JSON.stringify(previous),
        JSON.stringify(next),
      ]
    );

    return next;
  } catch (err) {
    translateDbError(err);
  }
};

export const syncBookingToCalendar = async (queryable, bookingId, actorUserId) => {
  const bookingResult = await queryable.query(
    `SELECT b.id, b.room_id, b.keperluan, b.status, b.penanggung_jawab, r.name AS room_name
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     WHERE b.id = $1`,
    [bookingId]
  );
  const booking = bookingResult.rows[0];
  if (!booking) {
    throw new CalendarValidationError('Booking tidak ditemukan untuk sinkronisasi kalender.');
  }

  if (booking.status !== 'Disetujui') {
    await cancelCalendarEventsForBooking(queryable, bookingId, actorUserId);
    return null;
  }

  const schedules = await queryable.query(
    `SELECT id, schedule_date, start_time, end_time, kebutuhan
     FROM booking_schedules
     WHERE booking_id = $1
     ORDER BY schedule_date, start_time`,
    [bookingId]
  );

  if (schedules.rows.length === 0) {
    await cancelCalendarEventsForBooking(queryable, bookingId, actorUserId);
    return null;
  }

  const existingEvent = await queryable.query(
    `SELECT id
     FROM calendar_events
     WHERE booking_id = $1
     ORDER BY CASE WHEN status <> 'cancelled' THEN 0 ELSE 1 END, created_at ASC
     LIMIT 1`,
    [bookingId]
  );
  const eventId = existingEvent.rows[0]?.id || createBookingEventId(bookingId);
  const payload = {
    roomId: booking.room_id,
    bookingId,
    sourceReferenceType: 'booking',
    sourceReferenceId: bookingId,
    title: booking.keperluan,
    description: `Booking ruangan oleh ${booking.penanggung_jawab || '-'}${schedules.rows[0].kebutuhan ? `\n\nKebutuhan: ${schedules.rows[0].kebutuhan}` : ''}`,
    location: booking.room_name,
    eventType: 'booking',
    status: 'scheduled',
    occurrences: schedules.rows.map((schedule) => ({
      roomId: booking.room_id,
      bookingScheduleId: schedule.id,
      startAt: buildJakartaTimestamp(schedule.schedule_date, schedule.start_time),
      endAt: buildJakartaTimestamp(schedule.schedule_date, schedule.end_time),
      notes: schedule.kebutuhan || null,
    })),
  };
  const occurrences = normalizeOccurrences(payload);

  try {
    await lockOccurrenceRooms(queryable, occurrences);
    await assertNoOccurrenceConflicts(queryable, occurrences, eventId);

    const previous = await getCalendarEvent(eventId, queryable);

    await queryable.query(
      `INSERT INTO calendar_events (
         id, source_id, room_id, booking_id, source_reference_type, source_reference_id,
         title, description, location, event_type, status, visibility, timezone,
         recurrence_rule, recurrence_until, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'booking', 'scheduled', 'internal', 'Asia/Jakarta', NULL, NULL, $10, $10)
       ON CONFLICT (id) DO UPDATE
       SET source_id = EXCLUDED.source_id,
           room_id = EXCLUDED.room_id,
           booking_id = EXCLUDED.booking_id,
           source_reference_type = EXCLUDED.source_reference_type,
           source_reference_id = EXCLUDED.source_reference_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           location = EXCLUDED.location,
           event_type = 'booking',
           status = 'scheduled',
           visibility = 'internal',
           timezone = 'Asia/Jakarta',
           recurrence_rule = NULL,
           recurrence_until = NULL,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
      [
        eventId,
        CORE_CALENDAR_SOURCE_ID,
        payload.roomId,
        bookingId,
        payload.sourceReferenceType,
        payload.sourceReferenceId,
        payload.title,
        payload.description,
        payload.location,
        actorUserId || null,
      ]
    );

    const existingOccurrences = await queryable.query(
      `SELECT id, booking_schedule_id
       FROM calendar_occurrences
       WHERE event_id = $1
         AND booking_schedule_id IS NOT NULL`,
      [eventId]
    );
    const existingOccurrenceIdBySchedule = new Map(
      existingOccurrences.rows.map((row) => [String(row.booking_schedule_id), row.id])
    );

    const occurrenceIds = [];
    for (const occurrence of occurrences) {
      const occurrenceId = existingOccurrenceIdBySchedule.get(String(occurrence.bookingScheduleId))
        || createBookingOccurrenceId(occurrence.bookingScheduleId);
      occurrenceIds.push(occurrenceId);
      await queryable.query(
        `INSERT INTO calendar_occurrences (
           id, event_id, room_id, booking_schedule_id, start_at, end_at, is_all_day, status, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)
         ON CONFLICT (id) DO UPDATE
         SET event_id = EXCLUDED.event_id,
             room_id = EXCLUDED.room_id,
             booking_schedule_id = EXCLUDED.booking_schedule_id,
             start_at = EXCLUDED.start_at,
             end_at = EXCLUDED.end_at,
             is_all_day = EXCLUDED.is_all_day,
             status = 'scheduled',
             notes = EXCLUDED.notes,
             updated_at = NOW()`,
        [
          occurrenceId,
          eventId,
          occurrence.roomId,
          occurrence.bookingScheduleId,
          occurrence.startAt,
          occurrence.endAt,
          occurrence.isAllDay,
          occurrence.notes,
        ]
      );
    }

    await queryable.query(
      `UPDATE calendar_occurrences
       SET status = 'cancelled', updated_at = NOW()
       WHERE event_id = $1
         AND NOT (id = ANY($2::varchar[]))`,
      [eventId, occurrenceIds]
    );

    const next = await getCalendarEvent(eventId, queryable);
    await queryable.query(
      `INSERT INTO calendar_audit_logs (id, event_id, actor_user_id, action, previous_data, next_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        createId('CALA'),
        eventId,
        actorUserId || null,
        previous.length > 0 ? 'synced' : 'created',
        JSON.stringify(previous),
        JSON.stringify(next),
      ]
    );

    return next;
  } catch (err) {
    translateDbError(err);
  }
};
