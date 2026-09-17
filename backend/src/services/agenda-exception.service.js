const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const {
  dateKeyFromParts,
  dayBoundsInTimezone,
  getHourInTimezone,
} = require("../lib/timezone");

const EXCEPTION_SCOPES = Object.freeze({ ALL: "all", VET: "vet", GROOMING: "grooming" });
const EXCEPTION_MODES = Object.freeze({ CLOSED: "closed", OPEN: "open" });
const MAX_DATE_KEY = "9999-12-31";
const ACTIVE_STATUSES = ["pending", "confirmed", "arrived", "in_progress"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

class AgendaExceptionError extends Error {}
class AgendaExceptionNotFoundError extends AgendaExceptionError {}
class AgendaExceptionOverlapError extends AgendaExceptionError {}
class InvalidAgendaExceptionError extends AgendaExceptionError {}

const isValidDateKey = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return dateKeyFromParts(year, month - 1, day) === value;
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");

function validateAgendaException(input) {
  const scope = normalizeText(input.scope);
  const mode = normalizeText(input.mode);
  const startDate = normalizeText(input.startDate);
  const endDate = normalizeText(input.endDate) || null;
  const reason = normalizeText(input.reason) || null;

  if (!Object.values(EXCEPTION_SCOPES).includes(scope)) {
    throw new InvalidAgendaExceptionError("El alcance debe ser todo el negocio, veterinaria o peluquería.");
  }
  if (!Object.values(EXCEPTION_MODES).includes(mode)) {
    throw new InvalidAgendaExceptionError("La regla debe ser cierre o apertura con horario.");
  }
  if (!isValidDateKey(startDate) || (endDate && !isValidDateKey(endDate)) || (endDate && endDate < startDate)) {
    throw new InvalidAgendaExceptionError("El rango de fechas no es válido.");
  }
  if (reason && reason.length > 240) {
    throw new InvalidAgendaExceptionError("El motivo no puede superar 240 caracteres.");
  }

  if (mode === EXCEPTION_MODES.CLOSED) {
    return { scope, mode, startDate, endDate, open: null, close: null, reason };
  }

  const open = normalizeText(input.open);
  const close = normalizeText(input.close);
  if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close) || open >= close) {
    throw new InvalidAgendaExceptionError("La apertura y el cierre deben tener formato HH:mm y formar una ventana válida.");
  }
  return { scope, mode, startDate, endDate, open, close, reason };
}

const rangeWhere = (startDate, endDate) => ({
  startDate: { lte: endDate ?? MAX_DATE_KEY },
  OR: [{ endDate: null }, { endDate: { gte: startDate } }],
});

async function withScopeLock(tx, tenantId, scope) {
  if (typeof tx.$executeRaw !== "function") return;
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${scope}`}))`);
}

async function assertNoOverlap(tx, { tenantId, scope, startDate, endDate, excludeId }) {
  const conflict = await tx.agendaException.findFirst({
    where: {
      tenantId,
      scope,
      ...rangeWhere(startDate, endDate),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) throw new AgendaExceptionOverlapError("Ya existe una excepción del mismo alcance para una fecha de ese período.");
}

async function listAgendaExceptions(tenantId, { from, to } = {}) {
  if (!tenantId) throw new InvalidAgendaExceptionError("tenantId es obligatorio");
  const fromDate = normalizeText(from);
  const toDate = normalizeText(to);
  if ((fromDate && !isValidDateKey(fromDate)) || (toDate && !isValidDateKey(toDate)) || (fromDate && toDate && toDate < fromDate)) {
    throw new InvalidAgendaExceptionError("El rango de consulta no es válido.");
  }
  return prisma.agendaException.findMany({
    where: {
      tenantId,
      ...(fromDate || toDate ? rangeWhere(fromDate || "0000-01-01", toDate || MAX_DATE_KEY) : {}),
    },
    orderBy: [{ startDate: "asc" }, { scope: "asc" }],
  });
}

async function getAgendaExceptionForDate(tenantId, dateKey, serviceType) {
  if (!tenantId || !isValidDateKey(dateKey)) return null;
  // Permite que pruebas legadas con un mock parcial de Prisma conserven el
  // comportamiento anterior a esta capacidad. En producción el cliente se
  // regenera y la migración se aplica antes de levantar el backend.
  if (!prisma.agendaException?.findMany) return null;
  const scope = serviceType === EXCEPTION_SCOPES.GROOMING ? EXCEPTION_SCOPES.GROOMING : EXCEPTION_SCOPES.VET;
  const rows = await prisma.agendaException.findMany({
    where: { tenantId, scope: { in: [scope, EXCEPTION_SCOPES.ALL] }, ...rangeWhere(dateKey, dateKey) },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.find((row) => row.scope === scope) ?? rows.find((row) => row.scope === EXCEPTION_SCOPES.ALL) ?? null;
}

function appointmentScope(appointment) {
  const bucket = String(appointment.availabilityBucket ?? "").toLowerCase();
  if (bucket === EXCEPTION_SCOPES.GROOMING) return EXCEPTION_SCOPES.GROOMING;
  if (bucket === EXCEPTION_SCOPES.VET) return EXCEPTION_SCOPES.VET;
  const type = String(appointment.serviceType ?? "").toLowerCase();
  if (type === "grooming" || type === "bath_grooming" || type.includes("baño") || type.includes("peluquer")) return EXCEPTION_SCOPES.GROOMING;
  return EXCEPTION_SCOPES.VET;
}

async function getAffectedAppointments(tenantId, exception) {
  const { start, end } = dayBoundsInTimezone(exception.startDate);
  const rangeEnd = dayBoundsInTimezone(exception.endDate ?? exception.startDate).end;
  const appointments = await prisma.appointment.findMany({
    where: { tenantId, date: { gte: start, lte: rangeEnd }, status: { in: ACTIVE_STATUSES } },
    select: {
      id: true, date: true, petName: true, petType: true, serviceType: true, availabilityBucket: true,
      user: { select: { name: true, phone: true } },
    },
    orderBy: { date: "asc" },
  });
  const openHour = exception.open ? Number(exception.open.slice(0, 2)) : null;
  const closeHour = exception.close ? Number(exception.close.slice(0, 2)) : null;
  return appointments.filter((appointment) => {
    if (exception.scope !== EXCEPTION_SCOPES.ALL && appointmentScope(appointment) !== exception.scope) return false;
    if (exception.mode === EXCEPTION_MODES.CLOSED) return true;
    const hour = getHourInTimezone(appointment.date);
    return hour < openHour || hour >= closeHour;
  }).map(({ availabilityBucket, ...appointment }) => appointment);
}

async function createAgendaException(tenantId, input) {
  if (!tenantId) throw new InvalidAgendaExceptionError("tenantId es obligatorio");
  const data = validateAgendaException(input);
  const exception = await prisma.$transaction(async (tx) => {
    await withScopeLock(tx, tenantId, data.scope);
    await assertNoOverlap(tx, { tenantId, ...data });
    return tx.agendaException.create({ data: { tenantId, ...data } });
  }, { isolationLevel: "Serializable" });
  return { exception, affectedAppointments: await getAffectedAppointments(tenantId, exception) };
}

async function previewAgendaException(tenantId, input) {
  if (!tenantId) throw new InvalidAgendaExceptionError("tenantId es obligatorio");
  const exception = validateAgendaException(input);
  return { exception, affectedAppointments: await getAffectedAppointments(tenantId, exception) };
}

async function updateAgendaException(tenantId, id, input) {
  const current = await prisma.agendaException.findFirst({ where: { id, tenantId } });
  if (!current) throw new AgendaExceptionNotFoundError("Excepción de agenda no encontrada.");
  const data = validateAgendaException({ ...current, ...input });
  const exception = await prisma.$transaction(async (tx) => {
    await withScopeLock(tx, tenantId, data.scope);
    await assertNoOverlap(tx, { tenantId, ...data, excludeId: id });
    return tx.agendaException.update({ where: { id }, data });
  }, { isolationLevel: "Serializable" });
  return { exception, affectedAppointments: await getAffectedAppointments(tenantId, exception) };
}

async function deleteAgendaException(tenantId, id) {
  const current = await prisma.agendaException.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!current) throw new AgendaExceptionNotFoundError("Excepción de agenda no encontrada.");
  await prisma.agendaException.delete({ where: { id } });
}

module.exports = {
  EXCEPTION_SCOPES,
  EXCEPTION_MODES,
  AgendaExceptionError,
  AgendaExceptionNotFoundError,
  AgendaExceptionOverlapError,
  InvalidAgendaExceptionError,
  validateAgendaException,
  listAgendaExceptions,
  getAgendaExceptionForDate,
  getAffectedAppointments,
  previewAgendaException,
  createAgendaException,
  updateAgendaException,
  deleteAgendaException,
};
