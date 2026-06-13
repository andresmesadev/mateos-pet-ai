const { addMinutes } = require("date-fns");
const { google } = require("googleapis");
const logger = require("../lib/logger");
const {
  TIMEZONE,
  toDateKey,
  getHourInTimezone,
  formatInTimeZone,
  fromZonedTime,
  zonedDateTimeToUtc,
} = require("../lib/timezone");

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

const SERVICE_TITLE_LABELS = {
  vet: "Vet",
  grooming: "Grooming",
  general_appointment: "Vet",
  medication: "Vet",
};

const SERVICE_DESCRIPTION_LABELS = {
  vet: "Consulta veterinaria",
  grooming: "Baño y peluquería",
  general_appointment: "Cita general",
  medication: "Medicamentos",
};

const isCalendarConfigured = () =>
  Boolean(
    String(process.env.GOOGLE_CALENDAR_ID || "").trim() &&
      String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim() &&
      String(process.env.GOOGLE_PRIVATE_KEY || "").trim()
  );

const getCalendarId = () => String(process.env.GOOGLE_CALENDAR_ID || "").trim();

const getPrivateKey = () =>
  String(process.env.GOOGLE_PRIVATE_KEY || "")
    .trim()
    .replace(/\\n/g, "\n");

let calendarClient = null;

const getCalendarClient = () => {
  if (!isCalendarConfigured()) {
    return null;
  }

  if (!calendarClient) {
    const auth = new google.auth.JWT({
      email: String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim(),
      key: getPrivateKey(),
      scopes: [CALENDAR_SCOPE],
    });

    calendarClient = google.calendar({ version: "v3", auth });
  }

  return calendarClient;
};

const getServiceTitleLabel = (serviceType) => {
  const key = String(serviceType || "").trim().toLowerCase();
  return SERVICE_TITLE_LABELS[key] ?? "Vet";
};

const getServiceDescriptionLabel = (serviceType) => {
  const key = String(serviceType || "").trim().toLowerCase();
  return SERVICE_DESCRIPTION_LABELS[key] ?? serviceType ?? "Cita";
};

const getDurationMinutes = (serviceType) => {
  const key = String(serviceType || "").trim().toLowerCase();
  return key === "grooming" ? 60 : 30;
};

const resolveAppointmentInstant = (appointment) => {
  const date = appointment?.date;

  if (!date) {
    return null;
  }

  const instant = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return instant;
};

const buildEventWindow = (appointment) => {
  const instant = resolveAppointmentInstant(appointment);

  if (!instant) {
    return null;
  }

  const dateKey = toDateKey(instant);
  const hour = getHourInTimezone(instant);
  const minute = parseInt(formatInTimeZone(instant, TIMEZONE, "m"), 10);

  if (!dateKey || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const startLocal = fromZonedTime(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
    TIMEZONE
  );
  const endLocal = addMinutes(
    startLocal,
    getDurationMinutes(appointment.serviceType)
  );

  return {
    start: {
      dateTime: formatInTimeZone(startLocal, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: formatInTimeZone(endLocal, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: TIMEZONE,
    },
  };
};

const buildEventSummary = (appointment) => {
  const serviceLabel = getServiceTitleLabel(appointment.serviceType);
  const petName = String(appointment.petName || "Mascota").trim();
  const phone = String(appointment.userPhone || appointment.phone || "").trim();
  const phoneSuffix = phone ? ` (${phone})` : "";

  return `🐾 ${serviceLabel} — ${petName}${phoneSuffix}`;
};

const buildEventDescription = (appointment) => {
  const lines = [
    `Mascota: ${appointment.petName || "—"}`,
    `Tipo: ${appointment.petType || "—"}`,
    `Servicio: ${getServiceDescriptionLabel(appointment.serviceType)}`,
  ];

  const phone = String(appointment.userPhone || appointment.phone || "").trim();

  if (phone) {
    lines.push(`Teléfono dueño: ${phone}`);
  }

  if (appointment.id) {
    lines.push(`Cita ID: ${appointment.id}`);
  }

  return lines.join("\n");
};

/**
 * @param {object} appointment — cita con date, serviceType, petName, userPhone opcional
 * @returns {Promise<string|null>} googleEventId
 */
const createCalendarEvent = async (appointment) => {
  if (!isCalendarConfigured()) {
    return null;
  }

  const calendar = getCalendarClient();
  const window = buildEventWindow(appointment);

  if (!calendar || !window) {
    logger.warn("[GoogleCalendar] Skipped create — invalid appointment window");
    return null;
  }

  try {
    const response = await calendar.events.insert({
      calendarId: getCalendarId(),
      requestBody: {
        summary: buildEventSummary(appointment),
        description: buildEventDescription(appointment),
        start: window.start,
        end: window.end,
      },
    });

    const eventId = response.data?.id ?? null;

    if (eventId) {
      logger.info("[GoogleCalendar] Event created:", eventId);
    }

    return eventId;
  } catch (error) {
    logger.error("[GoogleCalendar] createCalendarEvent error:", error.message);
    return null;
  }
};

/**
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
const cancelCalendarEvent = async (eventId) => {
  if (!isCalendarConfigured() || !eventId) {
    return false;
  }

  const calendar = getCalendarClient();

  if (!calendar) {
    return false;
  }

  try {
    await calendar.events.delete({
      calendarId: getCalendarId(),
      eventId: String(eventId),
    });

    logger.info("[GoogleCalendar] Event cancelled:", eventId);
    return true;
  } catch (error) {
    if (error.code === 404 || error.status === 404) {
      logger.warn("[GoogleCalendar] Event already missing:", eventId);
      return true;
    }

    logger.error("[GoogleCalendar] cancelCalendarEvent error:", error.message);
    return false;
  }
};

/**
 * @param {string} eventId
 * @param {Date|string} newDate — dateKey YYYY-MM-DD o instante
 * @param {number} newHour — hora entera en America/Bogota
 * @param {object} [options]
 * @param {string} [options.serviceType]
 * @returns {Promise<boolean>}
 */
const updateCalendarEvent = async (eventId, newDate, newHour, options = {}) => {
  if (!isCalendarConfigured() || !eventId) {
    return false;
  }

  const calendar = getCalendarClient();
  const dateKey =
    typeof newDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(newDate)
      ? newDate
      : toDateKey(newDate);
  const hour = Number(newHour);

  if (!dateKey || !Number.isFinite(hour)) {
    return false;
  }

  const window = buildEventWindow({
    date: zonedDateTimeToUtc(dateKey, hour),
    serviceType: options.serviceType,
  });

  if (!calendar || !window) {
    return false;
  }

  try {
    await calendar.events.patch({
      calendarId: getCalendarId(),
      eventId: String(eventId),
      requestBody: {
        start: window.start,
        end: window.end,
      },
    });

    logger.info("[GoogleCalendar] Event updated:", eventId);
    return true;
  } catch (error) {
    logger.error("[GoogleCalendar] updateCalendarEvent error:", error.message);
    return false;
  }
};

module.exports = {
  isCalendarConfigured,
  createCalendarEvent,
  cancelCalendarEvent,
  updateCalendarEvent,
};
