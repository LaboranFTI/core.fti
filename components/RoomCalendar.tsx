import React, { useState, useEffect, useMemo } from "react";
import { Role, Room } from "../types";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Trash2,
  Edit,
  ExternalLink,
  Type,
  AlignLeft,
  LogIn,
  LogOut,
  CheckCircle,
  Loader2,
  RefreshCw,
  MapPin,
} from "lucide-react";

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink: string;
}

interface EventForm {
  summary: string;
  description: string;
  startDate: string;
  startTime: string;
  endTime: string;
  recurrence: string;
  recurrenceEnd: string;
}

interface EditEventForm {
  summary: string;
  description: string;
  startDate: string;
  startTime: string;
  endTime: string;
}

interface DayDetail {
  date: number;
  events: GoogleEvent[];
  fullDate: string;
}

interface RoomCalendarProps {
  selectedRoom: Room | undefined;
  googleApi: any;
  role: Role;
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
  getCalendarId: (url: string) => string | null;
  filterComponent?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared day-of-week styling tokens  (DRY)
//
// Both MonthView's header row and DayWeekView's column headers import these
// constants so that typography, text colour, and the active-day circle are
// pixel-identical across every calendar view.
// ─────────────────────────────────────────────────────────────────────────────

/** Short Indonesian weekday labels.  Index == Date.getDay()  (0 = Sunday). */
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

const getDowColour = (dow: number): string =>
  dow === 0
    ? "text-red-500 dark:text-red-400"
    : dow === 6
      ? "text-blue-500 dark:text-blue-400"
      : "text-gray-600 dark:text-gray-300";

const DayColumnHeader: React.FC<{ date: Date }> = ({ date }) => {
  const isToday = date.toDateString() === new Date().toDateString();
  const dow = date.getDay();
  const clr = getDowColour(dow);

  return (
    <div className="flex flex-col items-center py-3 select-none">
      {/* Weekday abbrev — same colour logic as MonthView header row */}
      <span className={`text-[11px] font-bold uppercase tracking-wider ${clr}`}>
        {DAY_LABELS[dow]}
      </span>

      {/* Date number:
            today  → solid blue circle  (bg-blue-600, white text, soft shadow)
            other  → transparent bg, inherits the day-of-week colour          */}
      <span
        className={`
          mt-1 w-9 h-9 flex items-center justify-center rounded-full
          text-lg font-bold leading-none transition-colors duration-150
          ${isToday ? "bg-blue-600 text-white shadow-sm" : `bg-transparent ${clr}`}
        `}
      >
        {date.getDate()}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const RoomCalendar: React.FC<RoomCalendarProps> = ({
  selectedRoom,
  googleApi,
  role,
  showToast,
  getCalendarId,
  filterComponent,
}) => {
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const [selectedEvent, setSelectedEvent] = useState<GoogleEvent | null>(null);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetail | null>(
    null,
  );

  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<EventForm>({
    summary: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    startTime: "08:00",
    endTime: "10:00",
    recurrence: "NONE",
    recurrenceEnd: "",
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<GoogleEvent | null>(null);
  const [deleteOption, setDeleteOption] = useState<
    "single" | "thisAndFollowing" | "all"
  >("single");

  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GoogleEvent | null>(null);
  const [editEventForm, setEditEventForm] = useState<EditEventForm>({
    summary: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    startTime: "08:00",
    endTime: "10:00",
  });

  const {
    events,
    isAuthenticated,
    googleUserEmail,
    isCreatingEvent,
    isDeletingEvent,
    isLoading,
    isGapiInitialized,
    login,
    logout,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  } = googleApi;

  /** True for roles that can create / edit / delete calendar events. */
  const canManage = role === Role.ADMIN || role === Role.LABORAN || role.toString() === 'Supervisor';

  const getDateRangeForView = (date: Date, view: "month" | "week" | "day") => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    let timeMin, timeMax;

    if (view === "month") {
      timeMin = new Date(year, month, 1);
      timeMax = new Date(year, month + 1, 0, 23, 59, 59);
    } else if (view === "week") {
      timeMin = new Date(date);
      timeMin.setDate(day - date.getDay());
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(timeMin);
      timeMax.setDate(timeMin.getDate() + 6);
      timeMax.setHours(23, 59, 59, 999);
    } else {
      timeMin = new Date(year, month, day, 0, 0, 0);
      timeMax = new Date(year, month, day, 23, 59, 59);
    }
    return { timeMin, timeMax };
  };

  const fetchCurrentEvents = () => {
    if (!selectedRoom?.googleCalendarUrl || !isGapiInitialized) return;
    const calendarId = getCalendarId(selectedRoom.googleCalendarUrl);
    if (!calendarId) return;
    const { timeMin, timeMax } = getDateRangeForView(currentDate, viewMode);
    fetchEvents(calendarId, timeMin, timeMax);
  };

  useEffect(() => {
    if (isGapiInitialized) {
      const handler = setTimeout(() => {
        fetchCurrentEvents();
      }, 200);
      return () => clearTimeout(handler);
    }
  }, [selectedRoom, isGapiInitialized, currentDate, viewMode]);

  const goToToday = () => setCurrentDate(new Date());

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === "week") newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === "week") newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleDayClick = (day: {
    date: number;
    events: GoogleEvent[];
    isCurrentMonth: boolean;
    fullDate: string;
  }) => {
    if (!day.isCurrentMonth) return;
    const canAdd = role === Role.ADMIN || role === Role.LABORAN;
    if (canAdd && day.events.length === 0) {
      if (!isAuthenticated) {
        login();
        return;
      }
      setEventForm({
        summary: "",
        description: "",
        startDate: day.fullDate,
        startTime: "08:00",
        endTime: "10:00",
        recurrence: "NONE",
        recurrenceEnd: "",
      });
      setIsAddEventModalOpen(true);
    } else {
      setSelectedDayDetail(day);
    }
  };

  const handleOpenAddEventModal = () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    let defaultDate =
      viewMode === "day"
        ? currentDate.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
    setEventForm({
      summary: "",
      description: "",
      startDate: defaultDate,
      startTime: "08:00",
      endTime: "10:00",
      recurrence: "NONE",
      recurrenceEnd: "",
    });
    setIsAddEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom?.googleCalendarUrl) return;
    const calendarId = getCalendarId(selectedRoom.googleCalendarUrl);
    if (!calendarId) {
      showToast("ID Kalender tidak valid.", "error");
      return;
    }
    const startDateTime = new Date(
      `${eventForm.startDate}T${eventForm.startTime}:00`,
    );
    const endDateTime = new Date(
      `${eventForm.startDate}T${eventForm.endTime}:00`,
    );
    if (endDateTime <= startDateTime) {
      showToast("Waktu selesai harus lebih besar dari waktu mulai.", "warning");
      return;
    }
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventResource: any = {
      summary: eventForm.summary,
      location: selectedRoom.name,
      description:
        eventForm.description + `\n\nDibuat oleh Admin () via CORE.FTI`,
      start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone },
      end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone },
    };
    if (eventForm.recurrence !== "NONE") {
      let rrule = `RRULE:FREQ=${eventForm.recurrence}`;
      if (eventForm.recurrenceEnd) {
        const untilDate = new Date(eventForm.recurrenceEnd);
        untilDate.setHours(23, 59, 59);
        const untilStr =
          untilDate.toISOString().replace(/[-:.]/g, "").substring(0, 15) + "Z";
        rrule += `;UNTIL=${untilStr}`;
      }
      eventResource.recurrence = [rrule];
    }
    const success = await createEvent(calendarId, eventResource);
    if (success) {
      setIsAddEventModalOpen(false);
      fetchCurrentEvents();
    }
  };

  const handleDeleteEventClick = (event: GoogleEvent) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    setEventToDelete(event);
    setDeleteOption("single");
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete || !selectedRoom?.googleCalendarUrl) return;
    const calendarId = getCalendarId(selectedRoom.googleCalendarUrl);
    if (!calendarId) {
      showToast("ID Kalender tidak valid.", "error");
      return;
    }
    const success = await deleteEvent(calendarId, eventToDelete.id);
    if (success) {
      setIsDeleteModalOpen(false);
      setSelectedEvent(null);
      fetchCurrentEvents();
    }
  };

  const handleEditEventClick = (event: GoogleEvent) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    const startDateTime = event.start.dateTime
      ? new Date(event.start.dateTime)
      : new Date(event.start.date || "");
    const endDateTime = event.end.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.end.date || "");
    setEditingEvent(event);
    setEditEventForm({
      summary: event.summary,
      description: event.description || "",
      startDate: event.start.date || startDateTime.toISOString().split("T")[0],
      startTime: event.start.dateTime
        ? startDateTime.toTimeString().slice(0, 5)
        : "08:00",
      endTime: event.end.dateTime
        ? endDateTime.toTimeString().slice(0, 5)
        : "10:00",
    });
    setIsEditEventModalOpen(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !selectedRoom?.googleCalendarUrl) return;
    const calendarId = getCalendarId(selectedRoom.googleCalendarUrl);
    if (!calendarId) {
      showToast("ID Kalender tidak valid.", "error");
      return;
    }
    const startDateTime = new Date(
      `${editEventForm.startDate}T${editEventForm.startTime}:00`,
    );
    const endDateTime = new Date(
      `${editEventForm.startDate}T${editEventForm.endTime}:00`,
    );
    if (endDateTime <= startDateTime) {
      showToast("Waktu selesai harus lebih besar dari waktu mulai.", "warning");
      return;
    }
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventResource: any = {
      summary: editEventForm.summary,
      location: selectedRoom.name,
      description:
        editEventForm.description + `\n\nDiubah oleh Admin via CORE.FTI`,
      start: { dateTime: startDateTime.toISOString(), timeZone: userTimeZone },
      end: { dateTime: endDateTime.toISOString(), timeZone: userTimeZone },
    };
    const success = await updateEvent(
      calendarId,
      editingEvent.id,
      eventResource,
    );
    if (success) {
      setIsEditEventModalOpen(false);
      setSelectedEvent(null);
      fetchCurrentEvents();
    }
  };

  const formatEventTime = (dateTime?: string, date?: string) => {
    if (dateTime) {
      return new Date(dateTime).toLocaleString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (date) {
      return (
        new Date(date).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }) + " (Seharian)"
      );
    }
    return "-";
  };

  const formatDateHeader = () => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "week") {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startMonth = startOfWeek.toLocaleDateString("id-ID", {
        month: "short",
      });
      const endMonth = endOfWeek.toLocaleDateString("id-ID", {
        month: "short",
      });

      return `${startOfWeek.getDate()} ${startMonth} - ${endOfWeek.getDate()} ${endMonth}, ${endOfWeek.getFullYear()}`;
    }
  };

  const checkOverlap = (
    currentEvent: GoogleEvent,
    dayEvents: GoogleEvent[],
  ) => {
    if (!currentEvent.start.dateTime || !currentEvent.end.dateTime)
      return false;
    const currentStart = new Date(currentEvent.start.dateTime).getTime();
    const currentEnd = new Date(currentEvent.end.dateTime).getTime();

    return dayEvents.some((other) => {
      if (other.id === currentEvent.id) return false;
      if (!other.start.dateTime || !other.end.dateTime) return false;
      const otherStart = new Date(other.start.dateTime).getTime();
      const otherEnd = new Date(other.end.dateTime).getTime();

      return currentStart < otherEnd && currentEnd > otherStart;
    });
  };

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: {
      date: number;
      events: GoogleEvent[];
      isCurrentMonth: boolean;
      fullDate: string;
    }[] = [];

    for (let i = 0; i < startingDay; i++) {
      days.push({ date: 0, events: [], isCurrentMonth: false, fullDate: "" });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        date: i,
        events: [],
        isCurrentMonth: true,
        fullDate: dateStr,
      });
    }

    events.forEach((event: GoogleEvent) => {
      const dateKey =
        event.start.date ||
        (event.start.dateTime ? event.start.dateTime.split("T")[0] : "Unknown");
      const dayObj = days.find((d) => d.fullDate === dateKey);
      if (dayObj) {
        dayObj.events.push(event);
      }
    });

    return days;
  }, [currentDate, events]);

  const MonthView = () => (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-700">
        {/* Use the shared DAY_LABELS + getDowColour tokens (same as DayWeekView) */}
        {DAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`py-3 text-center text-sm font-bold ${getDowColour(idx)}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr bg-white dark:bg-gray-800">
        {calendarGrid.map((day, idx) => (
          <div
            key={idx}
            onClick={() => handleDayClick(day)}
            className={`min-h-30 border-b border-r border-gray-100 dark:border-gray-700 p-2 transition-colors ${!day.isCurrentMonth ? "bg-gray-50/50 dark:bg-gray-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"}`}
          >
            {day.isCurrentMonth && (
              <>
                <div
                  className={`text-sm font-medium mb-2 ${day.fullDate === new Date().toISOString().split("T")[0] ? "bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full" : "text-gray-700 dark:text-gray-300"}`}
                >
                  {day.date}
                </div>
                <div className="space-y-1">
                  {day.events.map((event) => {
                    const isOverlapping = checkOverlap(event, day.events);
                    return (
                      <div
                        key={event.id}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        className={`block text-xs p-1.5 rounded border truncate hover:opacity-80 transition-opacity cursor-pointer ${isOverlapping ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800"}`}
                        title={`${event.summary}\n${formatEventTime(event.start.dateTime, event.start.date)}${isOverlapping ? "\n(Jadwal Bersamaan)" : ""}`}
                      >
                        <div className="flex items-center">
                          {isOverlapping && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 shrink-0" />
                          )}
                          {event.start.dateTime && (
                            <span className="font-mono text-[10px] mr-1 opacity-75 shrink-0">
                              {new Date(
                                event.start.dateTime,
                              ).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          <span className="truncate">{event.summary}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const DayWeekView = ({ days }: { days: Date[] }) => {
    const timeSlots = Array.from(
      { length: 16 },
      (_, i) => `${String(i + 7).padStart(2, "0")}:00`,
    );

    const calculateEventPosition = (event: GoogleEvent) => {
      const startHour = 7;
      const totalHours = 16;
      if (!event.start.dateTime || !event.end.dateTime)
        return { top: 0, height: 0 };

      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      const startMinutes = Math.max(
        0,
        (startTime.getHours() - startHour) * 60 + startTime.getMinutes(),
      );
      const endMinutes = Math.min(
        totalHours * 60,
        (endTime.getHours() - startHour) * 60 + endTime.getMinutes(),
      );
      const durationMinutes = Math.max(15, endMinutes - startMinutes);

      const top = (startMinutes / (totalHours * 60)) * 100;
      const height = (durationMinutes / (totalHours * 60)) * 100;

      return { top: `${top}%`, height: `${height}%` };
    };

    const allDayEvents = events.filter((e: GoogleEvent) => e.start.date);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex sticky top-0 z-10 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-700">
          {/* Spacer inherits the gradient from its parent — only border-r is needed,
              upgraded to border-gray-200 so it visually matches the column cell borders. */}
          <div className="w-16 shrink-0 border-r border-gray-200 dark:border-gray-700" />
          <div
            className="flex-1 grid"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {/* DayColumnHeader mirrors MonthView typography exactly:
                  – coloured weekday abbreviation (red / blue / grey)
                  – today = solid bg-blue-600 circle with white text          */}
            {/* border-b is now on the parent container, so only border-r is needed here.
                Removing the per-cell border-b prevents a doubled bottom border and
                keeps the gradient band clean all the way to the right edge. */}
            {days.map((date) => (
              <div
                key={date.toISOString()}
                className="border-r border-gray-200 dark:border-gray-700"
              >
                <DayColumnHeader date={date} />
              </div>
            ))}
          </div>
        </div>

        {allDayEvents.length > 0 && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <div className="w-16 shrink-0 border-r border-gray-100 dark:border-gray-700 text-center py-1">
              <span className="text-xs text-gray-400">All-day</span>
            </div>
            <div
              className="flex-1 grid"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              }}
            >
              {days.map((date) => {
                const dateStr = date.toISOString().split("T")[0];
                const dayEvents = allDayEvents.filter(
                  (e: { start: { date: string; }; }) => e.start.date === dateStr,
              );
                return (
                  <div
                    key={dateStr}
                    className="border-r border-gray-100 dark:border-gray-700 p-1 space-y-1"
                  >
                    {dayEvents.map((event: GoogleEvent) => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs p-1 rounded truncate cursor-pointer"
                      >
                        {event.summary}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex overflow-auto max-h-[70vh]">
          <div className="w-16 shrink-0 text-right pr-2 -mt-2">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-16 flex items-start justify-end text-xs text-gray-400 pt-1"
              >
                <span>{time}</span>
              </div>
            ))}
          </div>
          <div
            className="flex-1 grid"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {days.map((date, index) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayEvents = events.filter((e: GoogleEvent) =>
                e.start.dateTime?.startsWith(dateStr),
              );
              return (
                <div
                  key={index}
                  className="relative border-r border-gray-100 dark:border-gray-700"
                >
                  {/* border-gray-700 (no opacity) keeps grid lines consistent with MonthView */}
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="h-16 border-t border-gray-100 dark:border-gray-700"
                    ></div>
                  ))}
                  {dayEvents.map((event: GoogleEvent) => {
                    const { top, height } = calculateEventPosition(event);
                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        style={{ top, height }}
                        className="absolute w-full px-1 cursor-pointer group"
                      >
                        <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 h-full rounded-lg p-2 overflow-hidden border border-blue-200 dark:border-blue-800 group-hover:border-blue-400 transition-all">
                          <p className="text-xs font-bold line-clamp-1">
                            {event.summary}
                          </p>
                          <p className="text-[10px] opacity-80">
                            {new Date(event.start.dateTime!).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            -{" "}
                            {new Date(event.end.dateTime!).toLocaleTimeString(
                              "id-ID",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    switch (viewMode) {
      case "day":
        return <DayWeekView days={[currentDate]} />;
      case "week":
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const weekDates = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          return date;
        });
        return <DayWeekView days={weekDates} />;
      case "month":
      default:
        return <MonthView />;
    }
  };

  return (
    <div className="space-y-6">
      {/*
        ── Action Bar ────────────────────────────────────────────────────────
        Rendered whenever at least one piece of content is relevant:
          • canManage  → Add-Event button + Google auth status (admin/laboran)
          • isGapiInitialized → Refresh button  (ALL roles)
          • googleCalendarUrl → External Google Calendar link  (ALL roles)

        For plain USER role with no GAPI this entire block is hidden cleanly
        instead of leaving an empty white card on screen.
        ──────────────────────────────────────────────────────────────────── */}
      {(canManage ||
        isGapiInitialized ||
        !!selectedRoom?.googleCalendarUrl ||
        filterComponent) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          {/* ── Left cluster: Filter + Add Event + Refresh ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            {filterComponent}

            <div className="flex items-center gap-2 flex-wrap">
              {canManage && (
                <button
                  onClick={handleOpenAddEventModal}
                  disabled={isLoading}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Jadwal
                </button>
              )}
              {isGapiInitialized && (
                <button
                  onClick={fetchCurrentEvents}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Refresh Jadwal"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-500" : ""}`}
                  />
                </button>
              )}
            </div>
          </div>

          {/* ── Right cluster: Google Calendar link + Auth ── */}
          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-start md:justify-end">
            {/*  External Google Calendar link.
                 Visible to ALL roles whenever the room has a calendar URL.
                 Previously this only appeared in JadwalRuang's filter card,
                 which meant it was missing on pages that embed RoomCalendar
                 directly.  Placing it here ensures it renders in every view. */}
            {selectedRoom?.googleCalendarUrl && (
              <a
                href={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
                  getCalendarId(selectedRoom.googleCalendarUrl) || "",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                title="Buka jadwal di Google Calendar"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Calendar
              </a>
            )}

            {/* Auth status / login — admin & laboran only */}
            {canManage && (
              <div className="flex items-center">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-xs text-green-700 dark:text-green-300 font-medium max-w-37.5 truncate">
                      {googleUserEmail || "Terhubung"}
                    </span>
                    <button
                      onClick={logout}
                      className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors"
                      title="Logout Google"
                    >
                      <LogOut className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={login}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    title="Login dengan Google untuk menambahkan jadwal"
                  >
                    <LogIn className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      Login Google
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="animate-fade-in-up">
        {!selectedRoom && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-full mb-4">
              <MapPin className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Pilih Ruangan
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              Belum ada ruangan yang dipilih atau data ruangan kosong.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 shadow-sm">
                  <button
                    onClick={handlePrev}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 text-base font-bold text-gray-900 dark:text-white capitalize min-w-50 text-center select-none">
                    {formatDateHeader()}
                  </span>
                  <button
                    onClick={handleNext}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-600 dark:text-gray-300"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                {isLoading && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Hari Ini
                </button>
                <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode("day")}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === "day" ? "bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
                  >
                    Hari
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === "week" ? "bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
                  >
                    Minggu
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === "month" ? "bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
                  >
                    Bulan
                  </button>
                </div>
              </div>
            </div>

            {renderCalendarView()}
          </div>
        )}
      </div>

      {selectedDayDetail && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedDayDetail(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center pr-4">
                <CalendarIcon className="w-5 h-5 mr-2 text-blue-600 shrink-0" />
                {new Date(selectedDayDetail.fullDate).toLocaleDateString(
                  "id-ID",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </h3>
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(role === Role.ADMIN || role === Role.LABORAN) && (
              <div className="px-6 pt-4">
                <button
                  onClick={() => {
                    setSelectedDayDetail(null);
                    setEventForm({
                      ...eventForm,
                      startDate: selectedDayDetail.fullDate,
                    });
                    setIsAddEventModalOpen(true);
                  }}
                  className="w-full py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal di Tanggal Ini
                </button>
              </div>
            )}

            <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {selectedDayDetail.events.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayDetail.events.map((event) => {
                    const isOverlapping = checkOverlap(
                      event,
                      selectedDayDetail.events,
                    );
                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`block p-3 rounded-lg border hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer ${isOverlapping ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800"}`}
                      >
                        <p className="font-bold text-sm mb-1">
                          {event.summary}
                        </p>
                        <div className="flex items-center text-xs opacity-80">
                          <Clock className="w-3 h-3 mr-1.5" />
                          <span>
                            {event.start.dateTime
                              ? `${new Date(event.start.dateTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} - ${event.end.dateTime ? new Date(event.end.dateTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}`
                              : "Seharian"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">
                    Tidak ada kegiatan terjadwal pada hari ini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div
          className="mobile-modal-shell fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center pr-4">
                <CalendarIcon className="w-5 h-5 mr-2 text-blue-600 shrink-0" />
                Detail Kegiatan
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mobile-modal-body p-4 sm:p-6 space-y-4">
              <div className="flex items-start">
                <Type className="w-5 h-5 text-gray-400 mr-3 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Nama Kegiatan
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-semibold mt-0.5">
                    {selectedEvent.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Clock className="w-5 h-5 text-gray-400 mr-3 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Waktu
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {formatEventTime(
                      selectedEvent.start.dateTime,
                      selectedEvent.start.date,
                    )}
                    {selectedEvent.end.dateTime &&
                      ` - ${new Date(selectedEvent.end.dateTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <AlignLeft className="w-5 h-5 text-gray-400 mr-3 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Deskripsi
                  </p>
                  <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto mt-1 scrollbar-thin">
                    {selectedEvent.description || "Tidak ada deskripsi."}
                  </div>
                </div>
              </div>
            </div>
            <div className="mobile-modal-actions p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3 bg-gray-50 dark:bg-gray-700/50">
              {(role === Role.ADMIN || role === Role.LABORAN) &&
              isAuthenticated ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditEventClick(selectedEvent)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center transition-colors shadow-sm hover:shadow"
                  >
                    <Edit className="w-4 h-4 mr-1.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEventClick(selectedEvent)}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg flex items-center transition-colors shadow-sm hover:shadow"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Hapus
                  </button>
                </div>
              ) : (
                <div />
              )}
              <a
                href={selectedEvent.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center"
              >
                Buka di Google Calendar{" "}
                <ExternalLink className="w-4 h-4 ml-1" />
              </a>
            </div>
          </div>
        </div>
      )}

      {isAddEventModalOpen && (
        <div className="mobile-modal-shell fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-full sm:max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                <CalendarIcon className="w-5 h-5 mr-2 text-blue-600" />
                Tambah Jadwal Baru
              </h3>
              <button
                onClick={() => setIsAddEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEvent} className="mobile-modal-body p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Judul Kegiatan
                </label>
                <div className="relative">
                  <Type className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={eventForm.summary}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, summary: e.target.value })
                    }
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: Praktikum Jarkom A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deskripsi
                </label>
                <div className="relative">
                  <AlignLeft className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <textarea
                    rows={3}
                    value={eventForm.description}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Tambahkan detail kegiatan..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={eventForm.startDate}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={eventForm.startTime}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={eventForm.endTime}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pengulangan (Repeat)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    value={eventForm.recurrence}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, recurrence: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NONE">Tidak Berulang</option>
                    <option value="DAILY">Harian (Daily)</option>
                    <option value="WEEKLY">Mingguan (Weekly)</option>
                    <option value="MONTHLY">Bulanan (Monthly)</option>
                  </select>
                  {eventForm.recurrence !== "NONE" && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Berakhir Pada (Opsional)
                      </label>
                      <input
                        type="date"
                        value={eventForm.recurrenceEnd}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            recurrenceEnd: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Kosongkan jika ingin berulang selamanya.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mobile-modal-actions pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isCreatingEvent ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}{" "}
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && eventToDelete && (
        <div className="mobile-modal-shell fixed inset-0 z-10000 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Hapus Jadwal
              </h3>
            </div>
            <div className="mobile-modal-body p-4 sm:p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Anda akan menghapus jadwal{" "}
                <strong>"{eventToDelete.summary}"</strong>. Pilih metode
                penghapusan:
              </p>

              <div className="space-y-2">
                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deleteOption === "single" ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  <input
                    type="radio"
                    name="deleteOption"
                    value="single"
                    checked={deleteOption === "single"}
                    onChange={() => setDeleteOption("single")}
                    className="mr-3"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Hapus ini saja
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Menghapus hanya event ini
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deleteOption === "thisAndFollowing" ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  <input
                    type="radio"
                    name="deleteOption"
                    value="thisAndFollowing"
                    checked={deleteOption === "thisAndFollowing"}
                    onChange={() => setDeleteOption("thisAndFollowing")}
                    className="mr-3"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Ini dan selanjutnya
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Menghapus event ini dan event mendatang
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${deleteOption === "all" ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  <input
                    type="radio"
                    name="deleteOption"
                    value="all"
                    checked={deleteOption === "all"}
                    onChange={() => setDeleteOption("all")}
                    className="mr-3"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Semua event
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Menghapus semua event yang cocok
                    </p>
                  </div>
                </label>
              </div>

              <div className="mobile-modal-actions flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteEvent}
                  disabled={isDeletingEvent}
                  className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-md flex items-center disabled:opacity-50"
                >
                  {isDeletingEvent ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Hapus Jadwal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditEventModalOpen && selectedEvent && (
        <div className="mobile-modal-shell fixed inset-0 z-10000 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="mobile-modal-panel bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-full sm:max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                <Edit className="w-5 h-5 mr-2 text-blue-600" />
                Edit Jadwal
              </h3>
              <button
                onClick={() => setIsEditEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateEvent} className="mobile-modal-body p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Judul Kegiatan
                </label>
                <div className="relative">
                  <Type className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={editEventForm.summary}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        summary: e.target.value,
                      })
                    }
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Contoh: Praktikum Jarkom A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deskripsi
                </label>
                <div className="relative">
                  <AlignLeft className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <textarea
                    rows={3}
                    value={editEventForm.description}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Tambahkan detail kegiatan..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={editEventForm.startDate}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={editEventForm.startTime}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        startTime: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={editEventForm.endTime}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        endTime: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mobile-modal-actions pt-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditEventModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isCreatingEvent ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}{" "}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomCalendar;
