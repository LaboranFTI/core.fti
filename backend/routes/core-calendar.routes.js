import express from 'express';
import { requireCalendarWriteRole } from '../middleware/auth.js';
import {
  CalendarConflictError,
  CalendarNotFoundError,
  CalendarValidationError,
  cancelCalendarEvent,
  createCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../services/calendar.service.js';

const router = express.Router();
const DETAIL_ROLES = new Set(['ADMIN', 'LABORAN', 'SUPERVISOR', 'ADMIN TU']);

const normalizeRole = (role) => String(role || '').trim().replace(/\s+/g, ' ').toUpperCase();

const canReadCalendarDetails = (user) => DETAIL_ROLES.has(normalizeRole(user?.role));

const sanitizeCalendarEvents = (events, user) => {
  if (canReadCalendarDetails(user)) return events;

  return events.map((event) => {
    const { description, bookingId, bookingScheduleId, ...publicEvent } = event;
    return publicEvent;
  });
};

const sendCalendarError = (res, err) => {
  if (err instanceof CalendarConflictError) {
    return res.status(409).json({ success: false, error: err.message, code: err.code });
  }
  if (err instanceof CalendarNotFoundError) {
    return res.status(404).json({ success: false, error: err.message, code: err.code });
  }
  if (err instanceof CalendarValidationError) {
    return res.status(err.status || 422).json({ success: false, error: err.message, code: err.code });
  }
  console.error('Core calendar route error:', err);
  return res.status(500).json({ success: false, error: 'Terjadi kesalahan saat memproses kalender internal.' });
};

router.get('/events', async (req, res) => {
  try {
    const events = await listCalendarEvents({
      roomId: req.query.roomId,
      timeMin: req.query.timeMin,
      timeMax: req.query.timeMax,
      status: req.query.status,
      q: req.query.q,
      includeGlobal: req.query.includeGlobal !== 'false',
      maxResults: req.query.maxResults,
    });
    const items = sanitizeCalendarEvents(events, req.user);

    res.json({
      success: true,
      data: {
        items,
        count: items.length,
      },
    });
  } catch (err) {
    return sendCalendarError(res, err);
  }
});

router.post('/events', requireCalendarWriteRole, async (req, res) => {
  try {
    const events = await createCalendarEvent(req.body, req.user?.id);
    return res.status(201).json({
      success: true,
      data: {
        eventId: events[0]?.eventId || null,
        items: events,
        count: events.length,
      },
    });
  } catch (err) {
    return sendCalendarError(res, err);
  }
});

router.patch('/events/:id', requireCalendarWriteRole, async (req, res) => {
  try {
    const events = await updateCalendarEvent(req.params.id, req.body, req.user?.id);
    return res.json({
      success: true,
      data: {
        eventId: events[0]?.eventId || req.params.id,
        items: events,
        count: events.length,
      },
    });
  } catch (err) {
    return sendCalendarError(res, err);
  }
});

router.delete('/events/:id', requireCalendarWriteRole, async (req, res) => {
  try {
    await cancelCalendarEvent(req.params.id, req.user?.id);
    return res.json({ success: true, message: 'Event kalender internal berhasil dibatalkan.' });
  } catch (err) {
    return sendCalendarError(res, err);
  }
});

export default router;
