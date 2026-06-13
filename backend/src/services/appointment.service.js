const prisma = require("../lib/prisma");
const { findPetByNameAndOwner } = require("./pet.service");
const availabilityDb = require("./availability-db.service");
const { SERVICE_TYPES, toDateKey } = require("./availability.service");
const {
  TIMEZONE,
  zonedDateTimeToUtc,
  dayBoundsInTimezone,
  getHourInTimezone,
  formatSlotForUser,
  formatInTimeZone,
} = require("../lib/timezone");

const MAX_USER_APPOINTMENTS = 3;

const APPOINTMENT_SERVICE_LABELS = {
  vet: "Veterinaria",
  grooming: "Grooming",
  general_appointment: "Cita general",
  medication: "Medicamentos",
};

const VET_BUCKET_TYPES = new Set(["vet", "general_appointment", "medication"]);

const mapToAvailabilityServiceType = (serviceType) => {
  const type = String(serviceType || "").trim().toLowerCase();
  if (type === "grooming") return SERVICE_TYPES.GROOMING;
  if (VET_BUCKET_TYPES.has(type)) return SERVICE_TYPES.VET;
  return type;
};

/**
 * Instant UTC para PostgreSQL: dateKey + hour interpretados en America/Bogota.
 */
const buildAppointmentDateTime = (dateKey, hour) => {
  const key = String(dateKey || "").trim();
  const h = Number(hour);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(h) || h < 0 || h > 23) {
    throw new Error("Invalid dateKey or hour for appointment");
  }

  return zonedDateTimeToUtc(key, h);
};

/**
 * Mapea servicio de sesión/OpenAI al tipo usado en agenda.
 */
const mapSessionServiceType = (requestedService) => {
  const s = String(requestedService || "").trim();

  if (s === "bath_grooming") return "grooming";
  if (s === "veterinary_consultation" || s === "medication") return "vet";
  if (s === "general_appointment") return "general_appointment";
  return s || "general_appointment";
};

const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed"];

/**
 * Mapea serviceType de DB al valor de sesión/OpenAI.
 */
const mapDbServiceTypeToSession = (serviceType) => {
  const s = String(serviceType || "").trim().toLowerCase();

  if (s === "grooming") return "bath_grooming";
  if (s === "vet") return "veterinary_consultation";
  if (s === "medication") return "medication";
  if (s === "general_appointment") return "general_appointment";
  return null;
};

/**
 * Etiqueta legible de fecha/hora de cita (America/Bogota).
 */
const formatAppointmentDateLabel = (appointment) => {
  if (!appointment?.date) {
    return "fecha programada";
  }

  const date =
    appointment.date instanceof Date
      ? appointment.date
      : new Date(appointment.date);

  if (Number.isNaN(date.getTime())) {
    return "fecha programada";
  }

  return formatSlotForUser(toDateKey(date), getHourInTimezone(date));
};

const formatAppointmentServiceLabel = (serviceType) => {
  const key = String(serviceType || "").trim().toLowerCase();
  return APPOINTMENT_SERVICE_LABELS[key] ?? serviceType ?? "Cita";
};

/**
 * Línea de lista para WhatsApp: 📅 Servicio — dd/MM/yyyy a las h:mm AM/PM
 */
const formatAppointmentListLine = (appointment) => {
  if (!appointment?.date) {
    return null;
  }

  const date =
    appointment.date instanceof Date
      ? appointment.date
      : new Date(appointment.date);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const serviceLabel = formatAppointmentServiceLabel(appointment.serviceType);
  const dateLabel = formatInTimeZone(date, TIMEZONE, "dd/MM/yyyy");
  const timeLabel = formatInTimeZone(date, TIMEZONE, "h:mm a");

  return `📅 ${serviceLabel} — ${dateLabel} a las ${timeLabel}`;
};

/**
 * Próximas citas activas del usuario (pending/confirmed), máx. 3.
 */
const getUserAppointments = async (userId) => {
  const id = String(userId || "").trim();

  if (!id) {
    throw new Error("userId is required");
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        userId: id,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        date: { gte: new Date() },
      },
      orderBy: { date: "asc" },
      take: MAX_USER_APPOINTMENTS,
    });

    console.log(
      `[AppointmentService] User appointments found: ${appointments.length}`
    );
    return appointments;
  } catch (error) {
    console.error(
      "[AppointmentService] getUserAppointments error:",
      error.message
    );
    throw error;
  }
};

/**
 * Cancela la última cita activa (pending/confirmed) del usuario.
 * @returns {Promise<object|null>} Cita cancelada o null si no hay activas
 */
const cancelAppointment = async (userId) => {
  const id = String(userId || "").trim();

  if (!id) {
    throw new Error("userId is required");
  }

  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        userId: id,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
      },
      orderBy: { date: "desc" },
    });

    if (!appointment) {
      console.log("[AppointmentService] No active appointment to cancel");
      return null;
    }

    const cancelled = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });

    console.log("[AppointmentService] Appointment cancelled:", cancelled.id);
    return cancelled;
  } catch (error) {
    console.error("[AppointmentService] cancelAppointment error:", error.message);
    throw error;
  }
};

const createAppointment = async (data) => {
  const { userId, petName, petType, serviceType, date, status = "confirmed" } =
    data || {};

  if (!userId || !petName || !petType || !serviceType || !date) {
    throw new Error(
      "userId, petName, petType, serviceType and date are required"
    );
  }

  try {
    const trimmedPetName = String(petName).trim();
    const trimmedPetType = String(petType).trim();

    let petId = null;

    try {
      const pet = await findPetByNameAndOwner(trimmedPetName, userId);
      if (pet?.id) {
        petId = pet.id;
      }
    } catch (lookupError) {
      console.warn(
        "[AppointmentService] Pet lookup skipped:",
        lookupError.message
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: String(userId),
        petId,
        petName: trimmedPetName,
        petType: trimmedPetType,
        serviceType: String(serviceType).trim(),
        date: date instanceof Date ? date : new Date(date),
        status: String(status).trim(),
      },
    });
    console.log(
      `[AppointmentService] Appointment created (${TIMEZONE} → UTC stored)`
    );
    return appointment;
  } catch (error) {
    console.error("[AppointmentService] createAppointment error:", error.message);
    throw error;
  }
};

const findAppointmentsByDate = async (date) => {
  try {
    let start;
    let end;

    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      ({ start, end } = dayBoundsInTimezone(date));
    } else {
      const key = toDateKey(date instanceof Date ? date : new Date(date));
      ({ start, end } = dayBoundsInTimezone(key));
    }

    return await prisma.appointment.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: "asc" },
    });
  } catch (error) {
    console.error(
      "[AppointmentService] findAppointmentsByDate error:",
      error.message
    );
    throw error;
  }
};

const findAppointmentsByUser = async (userId) => {
  const id = String(userId || "").trim();

  if (!id) {
    throw new Error("userId is required");
  }

  try {
    return await prisma.appointment.findMany({
      where: { userId: id },
      orderBy: { date: "asc" },
    });
  } catch (error) {
    console.error(
      "[AppointmentService] findAppointmentsByUser error:",
      error.message
    );
    throw error;
  }
};

/**
 * true si el slot ya no está disponible (ocupado u horario inválido).
 * @returns {Promise<boolean>}
 */
const checkAppointmentConflict = async ({ date, serviceType, dateKey, hour }) => {
  if (!serviceType) {
    throw new Error("serviceType is required");
  }

  let key = dateKey != null ? toDateKey(dateKey) : null;
  let h = hour != null ? Number(hour) : null;

  if ((!key || !Number.isFinite(h)) && date) {
    const slotDate = date instanceof Date ? date : new Date(date);
    key = toDateKey(slotDate);
    h = getHourInTimezone(slotDate);
  }

  if (!key || !Number.isFinite(h)) {
    throw new Error("dateKey and hour (or date) are required");
  }

  try {
    const availabilityType = mapToAvailabilityServiceType(serviceType);
    const available = await availabilityDb.isSlotAvailable({
      dateKey: key,
      hour: h,
      serviceType: availabilityType,
    });

    if (!available) {
      console.log("[AppointmentService] Conflict detected:", key, h, serviceType);
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      "[AppointmentService] checkAppointmentConflict error:",
      error.message
    );
    throw error;
  }
};

module.exports = {
  TIMEZONE,
  buildAppointmentDateTime,
  mapSessionServiceType,
  mapDbServiceTypeToSession,
  formatAppointmentDateLabel,
  formatAppointmentListLine,
  getUserAppointments,
  createAppointment,
  findAppointmentsByDate,
  findAppointmentsByUser,
  checkAppointmentConflict,
  cancelAppointment,
};
