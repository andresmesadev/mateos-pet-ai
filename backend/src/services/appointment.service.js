const prisma = require("../lib/prisma");

/**
 * Construye DateTime de inicio de slot (fecha YYYY-MM-DD + hora 0–23).
 */
const buildAppointmentDateTime = (dateKey, hour) => {
  const key = String(dateKey || "").trim();
  const h = Number(hour);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(h) || h < 0 || h > 23) {
    throw new Error("Invalid dateKey or hour for appointment");
  }

  const hourStr = String(Math.floor(h)).padStart(2, "0");
  return new Date(`${key}T${hourStr}:00:00`);
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

const getSlotRange = (date) => {
  const start = date instanceof Date ? new Date(date) : new Date(date);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { start, end };
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
    const appointment = await prisma.appointment.create({
      data: {
        userId: String(userId),
        petName: String(petName).trim(),
        petType: String(petType).trim(),
        serviceType: String(serviceType).trim(),
        date: date instanceof Date ? date : new Date(date),
        status: String(status).trim(),
      },
    });
    console.log("[AppointmentService] Appointment created");
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
      start = new Date(`${date}T00:00:00`);
      end = new Date(`${date}T23:59:59.999`);
    } else {
      const d = date instanceof Date ? date : new Date(date);
      start = new Date(d);
      start.setHours(0, 0, 0, 0);
      end = new Date(d);
      end.setHours(23, 59, 59, 999);
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
 * Conflicto si ya hay cita en el mismo slot (hora) y mismo serviceType.
 * @returns {Promise<boolean>}
 */
const checkAppointmentConflict = async ({ date, serviceType }) => {
  if (!date || !serviceType) {
    throw new Error("date and serviceType are required");
  }

  try {
    const slotDate = date instanceof Date ? date : new Date(date);
    const { start, end } = getSlotRange(slotDate);
    const type = String(serviceType).trim();

    const existing = await prisma.appointment.findFirst({
      where: {
        serviceType: type,
        date: {
          gte: start,
          lt: end,
        },
        status: {
          not: "cancelled",
        },
      },
    });

    if (existing) {
      console.log("[AppointmentService] Conflict detected");
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
  buildAppointmentDateTime,
  mapSessionServiceType,
  createAppointment,
  findAppointmentsByDate,
  findAppointmentsByUser,
  checkAppointmentConflict,
};
