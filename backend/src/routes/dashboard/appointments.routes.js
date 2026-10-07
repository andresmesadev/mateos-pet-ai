const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { isMinutePrecisionHour } = require("../../lib/timezone");
const { saveConsultationRecord, ClinicalRevisionError } = require("../../services/clinical-record-revision.service");
const ERRORS = require("../../constants/errors");
const { moduleAllowsAppointment, serviceModule, actorSnapshot } = require("../../services/dashboard-access.service");
const {
  getBogotaYmd,
  bogotaDayStart,
  APPOINTMENT_INCLUDE,
  mapAppointmentRow,
  mapMedicalRecord,
} = require("./shared");
const {
  isValidStatus,
  isAllowedTransition,
  autoTimestamps,
  isArrivalWindowExpired,
  ARRIVAL_GRACE_MS,
} = require("../../services/appointment-status.service");
const {
  createRecord,
  getRecordsByPet,
} = require("../../services/medical-record.service");
const { listInactiveClients } = require("../../services/dashboard-client.service");
const { createAppointment, buildAppointmentDateTime } = require("../../services/appointment.service");
const { assignmentReason, withStaffLock, assertStaffAssignment } = require('../../services/staff-scheduling.service');
const { isSlotAvailable, listAvailableSlotsForDate } = require("../../services/availability-db.service");
const { SlotAlreadyBookedError } = require("../../services/errors/slot-already-booked.error");
const {
  upsertControlFromRecord,
  createGroomingReminderIfNeeded,
} = require("../../services/next-action.service");
// Entregable Puente: Completar Cita pasa por el contexto Agenda; el side-effect
// legacy de comisión (commission.service.js) fue retirado — ver contexts/index.js.
const { completeAppointment } = require("../../contexts");
const { changeServicePrice } = require("../../contexts/services");
const { ServiceNotFoundError, PriceRuleTargetNotFoundError, DuplicatePriceRuleError, InvalidPriceError } = require("../../contexts/services/domain/errors");
const {
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
  UnresolvedPriceError,
} = require("../../contexts/agenda/domain/errors");

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];
const BLOCKED_STATUSES = ["cancelled", "no_show"];
const GROOMING_TYPES = [
  "grooming",
  "bath",
  "baño",
  "peluquer",
  "corte",
  "spa",
  "deslanado",
  "colorimetría",
  "colorimetria",
  "antipulgas",
];

const VETERINARY_APPOINTMENT_FILTER = {
  OR: [
    { service: { is: { category: { is: { name: "veterinary" } } } } },
    { serviceId: null, serviceType: { in: VET_SERVICE_TYPES } },
  ],
};

function mapForActor(req, row) {
  const mapped = mapAppointmentRow(row);
  return (req.access ? !req.access.capabilities.cash && !req.access.capabilities.appointmentPrice : req.actor?.type === "vet") ? { ...mapped, hasResolvedPrice: mapped.finalPrice != null, finalPrice: null, priceResolution: null } : mapped;
}

async function resolveVetAppointment(id, tenantId) {
  const where = tenantId ? { id, tenantId } : { id };
  const appt = await prisma.appointment.findFirst({
    where,
    include: {
      service: { select: { category: { select: { name: true } } } },
      pet: { select: { id: true, weight: true } },
    },
  });
  return appt;
}

function validateVetAppointment(appt) {
  if (!appt) return { status: 404, error: "Cita no encontrada" };
  if (!appt.petId) return { status: 422, error: "La cita no tiene mascota asociada" };
  if (BLOCKED_STATUSES.includes(appt.status)) {
    return { status: 422, error: `No se puede registrar atención en una cita ${appt.status}` };
  }
  const isVet = appt.serviceId
    ? appt.service?.category?.name === "veterinary"
    : VET_SERVICE_TYPES.includes(appt.serviceType?.toLowerCase());
  if (!isVet) {
    return { status: 422, error: "Solo se puede registrar atención clínica en citas veterinarias" };
  }
  return null;
}

function visibleRows(req, rows) {
  if (!req.access || req.access.capabilities.administration) return rows;
  return rows.filter(row => moduleAllowsAppointment(req.access, row) &&
    (!["vet", "groomer"].includes(req.access.role) || serviceModule(row) === (req.access.role === "vet" ? "veterinary" : "grooming")));
}
const MEDICAL_RECORD_INCLUDE = {
  staff: { select: { name: true } },
  createdByStaff: { select: { name: true } },
  updatedByStaff: { select: { name: true } },
};

router.get("/appointments/today", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const ymd = getBogotaYmd();
    const start = bogotaDayStart(ymd);
    const end = new Date(start.getTime() + 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: { ...tenantFilter, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      include: APPOINTMENT_INCLUDE,
    });

    res.json(visibleRows(req, rows).map(row => mapForActor(req, row)));
  } catch (error) {
    console.error("[Dashboard] Today appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/appointments/upcoming", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const ymd = getBogotaYmd();
    const todayEnd = new Date(bogotaDayStart(ymd).getTime() + 86_400_000);
    const weekEnd = new Date(todayEnd.getTime() + 6 * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: {
        ...tenantFilter,
        date: { gte: todayEnd, lt: weekEnd },
        status: { not: "cancelled" },
      },
      orderBy: { date: "asc" },
      take: 30,
      include: APPOINTMENT_INCLUDE,
    });

    res.json(visibleRows(req, rows).map(row => mapForActor(req, row)));
  } catch (error) {
    console.error("[Dashboard] Upcoming appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /appointments/month?year=YYYY&month=0-11  (defaults to current Bogotá month)
// Alimenta la vista "Mes" del dashboard (week-calendar.tsx), que hasta ahora
// solo recibía las citas de la semana actual desde el server component y no
// mostraba nada fuera de esa semana en la grilla mensual.
router.get("/appointments/month", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    const nowBogota = new Date(`${getBogotaYmd()}T12:00:00.000Z`);
    const year = Number.isFinite(Number(req.query.year)) ? Number(req.query.year) : nowBogota.getUTCFullYear();
    const month = Number.isFinite(Number(req.query.month)) ? Number(req.query.month) : nowBogota.getUTCMonth();

    const monthStartYmd = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthStart = bogotaDayStart(monthStartYmd);
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const monthEnd = new Date(monthStart.getTime() + daysInMonth * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: { ...tenantFilter, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
      include: APPOINTMENT_INCLUDE,
    });

    res.json({ year, month, appointments: visibleRows(req, rows).map(row => mapForActor(req, row)) });
  } catch (error) {
    console.error("[Dashboard] Month appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /appointments/week?date=YYYY-MM-DD  (defaults to current Bogotá week Mon–Sun)
router.get("/appointments/week", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Resolve anchor date (Bogotá)
    const anchor = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : getBogotaYmd();

    // Find Monday of the anchor's week
    const anchorDate = new Date(`${anchor}T12:00:00.000Z`);
    const dow = anchorDate.getUTCDay(); // 0=Sun
    const daysToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(anchorDate.getTime() + daysToMon * 86_400_000);
    const mondayYmd = monday.toISOString().slice(0, 10);

    const weekStart = bogotaDayStart(mondayYmd);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

    const rows = await prisma.appointment.findMany({
      where: {
        ...tenantFilter,
        date: { gte: weekStart, lt: weekEnd },
        ...(req.actor?.type === "vet" ? VETERINARY_APPOINTMENT_FILTER : {}),
      },
      orderBy: { date: "asc" },
      include: {
        ...APPOINTMENT_INCLUDE,
        medicalRecord: { select: { id: true } },
      },
    });

    res.json({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      mondayYmd,
      appointments: visibleRows(req, rows).map((row) => ({
        ...mapForActor(req, row),
        hasMedicalRecord: Boolean(row.medicalRecord),
      })),
    });
  } catch (error) {
    console.error("[Dashboard] Week appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Busca consultas de cualquier fecha por mascota o propietario dentro del tenant.
router.get("/appointments/consultations/search", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2 || query.length > 80) {
      return res.status(400).json({ error: "Escribe entre 2 y 80 caracteres para buscar." });
    }

    const { tenantId } = req.tenant;
    const nameFilter = { contains: query, mode: "insensitive" };
    const rows = await prisma.appointment.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { notIn: BLOCKED_STATUSES },
        AND: [
          {
            OR: [
              { service: { is: { category: { is: { name: "veterinary" } } } } },
              { serviceId: null, serviceType: { in: VET_SERVICE_TYPES } },
            ],
          },
          {
            OR: [
              { petName: nameFilter },
              { pet: { is: { name: nameFilter } } },
              { user: { is: { name: nameFilter } } },
            ],
          },
        ],
      },
      orderBy: { date: "desc" },
      take: 51,
      include: {
        ...APPOINTMENT_INCLUDE,
        medicalRecord: { select: { id: true } },
      },
    });

    res.json({
      appointments: rows.slice(0, 50).map((row) => ({
        ...mapForActor(req, row),
        hasMedicalRecord: Boolean(row.medicalRecord),
      })),
      hasMore: rows.length > 50,
    });
  } catch (error) {
    console.error("[Dashboard] Consultation search error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/inactive-count", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const clients = await listInactiveClients(tenantId);
    res.json({ count: clients.length });
  } catch (error) {
    console.error("[Dashboard] Inactive count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/appointments", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const tenantFilter = tenantId ? { tenantId } : {};
    const rows = await prisma.appointment.findMany({
      where: tenantFilter,
      orderBy: {
        date: "desc",
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      take: 10,
    });

    const appointments = rows.map((appointment) => ({
      id: appointment.id,
      userId: appointment.userId,
      petId: appointment.petId,
      petName: appointment.pet?.name ?? appointment.petName,
      petType: appointment.pet?.type ?? appointment.petType,
      serviceType: appointment.serviceType,
      date: appointment.date,
      status: appointment.status,
      createdAt: appointment.createdAt,
      pet: appointment.pet,
    }));

    res.json(appointments);
  } catch (error) {
    console.error("[Dashboard] Appointments error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// El formulario recibe solo turnos válidos para el horario y la ocupación
// actuales; el POST vuelve a comprobarlos para cubrir reservas simultáneas.
router.get("/appointments/available-slots", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    if (!tenantId) return res.status(400).json({ error: "Selecciona un establecimiento" });
    const { dateKey, serviceId, staffId } = req.query;
    if (staffId !== undefined && (typeof staffId !== 'string' || !staffId.trim())) return res.status(400).json({ error: 'Profesional no válido.' });
    const calendarDate = typeof dateKey === "string" ? new Date(`${dateKey}T12:00:00.000Z`) : null;
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
        !calendarDate || Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== dateKey ||
        typeof serviceId !== "string" || !serviceId.trim()) {
      return res.status(400).json({ error: "Selecciona un servicio y una fecha válidos" });
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, tenantId, active: true },
      include: { category: { select: { name: true } } },
    });
    if (!service) return res.status(404).json({ error: "Servicio no encontrado en este establecimiento" });
    if (req.access && !moduleAllowsAppointment(req.access, service)) return res.status(403).json({ error: "El módulo de este servicio está desactivado" });
    if (!service.requiresAppointment) return res.status(422).json({ error: "Este servicio no admite citas" });
    const bucket = { veterinary: "vet", grooming: "grooming" }[service.category?.name];
    if (!bucket) return res.status(422).json({ error: "Este servicio no admite reserva de horario" });

    let slots = await listAvailableSlotsForDate({ dateKey, serviceType: bucket, tenantId });
    if (staffId) {
      const available = [];
      for (const hour of slots) if (!await assignmentReason(prisma, { staffId, tenantId, service, date: buildAppointmentDateTime(dateKey, hour) })) available.push(hour);
      slots = available;
    }
    return res.json({ slots });
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
    console.error("[Dashboard] Available slots error:", error);
    return res.status(503).json({ error: "No se pudieron consultar los horarios disponibles" });
  }
});

// Creación manual desde la agenda. La identidad del establecimiento proviene
// exclusivamente de la sesión del dashboard y cada referencia se valida allí.
router.post("/appointments", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    if (!tenantId) return res.status(400).json({ error: "Selecciona un establecimiento" });

    const { userId, petId, serviceId, dateKey, hour, staffId } = req.body ?? {};
    if (staffId !== undefined && staffId !== null && (typeof staffId !== 'string' || !staffId.trim())) return res.status(400).json({ error: 'Profesional no válido.' });
    if (![userId, petId, serviceId].every((value) => typeof value === "string" && value.trim())) {
      return res.status(400).json({ error: "Selecciona cliente, mascota y servicio" });
    }
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
        (typeof hour !== "number" && typeof hour !== "string") || String(hour).trim() === "" ||
        !isMinutePrecisionHour(hour)) {
      return res.status(400).json({ error: "Selecciona una fecha y hora válidas" });
    }
    const calendarDate = new Date(`${dateKey}T12:00:00.000Z`);
    if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== dateKey) {
      return res.status(400).json({ error: "La fecha no es válida" });
    }

    const [user, pet, service] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } }),
      prisma.pet.findFirst({ where: { id: petId, ownerId: userId, tenantId }, select: { id: true, name: true, type: true } }),
      prisma.service.findFirst({ where: { id: serviceId, tenantId, active: true }, include: { category: { select: { name: true } } } }),
    ]);
    if (!user || !pet || !service) {
      return res.status(404).json({ error: "Cliente, mascota o servicio no encontrado en este establecimiento" });
    }
    if (req.access && !moduleAllowsAppointment(req.access, service)) return res.status(403).json({ error: "El módulo de este servicio está desactivado" });
    if (!service.requiresAppointment) {
      return res.status(422).json({ error: "Este servicio no admite citas" });
    }
    const bucket = { veterinary: "vet", grooming: "grooming" }[service.category?.name];
    if (!bucket) return res.status(422).json({ error: "Este servicio no admite reserva de horario" });
    const available = await isSlotAvailable({ dateKey, hour: Number(hour), serviceType: bucket, tenantId });
    if (!available) return res.status(409).json({ error: "El horario no está disponible para este servicio" });

    const appointment = await createAppointment({
      tenantId, userId, petId, serviceId, ...(staffId ? { staffId } : {}),
      petName: pet.name, petType: pet.type,
      serviceType: bucket,
      date: buildAppointmentDateTime(dateKey, Number(hour)),
      status: "confirmed",
    });
    return res.status(201).json({ id: appointment.id, date: appointment.date, status: appointment.status });
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
    if (error instanceof SlotAlreadyBookedError) {
      return res.status(409).json({ error: "El horario acaba de ser reservado. Elige otro." });
    }
    console.error("[Dashboard] Create appointment error:", error);
    return res.status(500).json({ error: "No se pudo crear la cita" });
  }
});

// POST /appointments/:id/complete — Entregable Puente, caso de uso 1.
// Transición + comisión + cobro de sistema en UNA transacción (Etapa 2);
// exige precio resuelto (ADR 007-D4).
router.post("/appointments/:id/complete", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { completedAt } = req.body ?? {};

    if (req.actor?.type === "vet") {
      const clinicalAppointment = await resolveVetAppointment(req.params.id, tenantId);
      const validation = validateVetAppointment(clinicalAppointment);
      if (validation) return res.status(validation.status).json({ error: validation.error });
      if (clinicalAppointment.staffId !== req.actor.staffId) {
        return res.status(403).json({ error: "La atención debe estar asignada a tu usuario para finalizarla" });
      }
      if (completedAt !== undefined) return res.status(403).json({ error: "La fecha de cierre se registra automáticamente" });
      const record = await prisma.medicalRecord.findUnique({ where: { appointmentId: req.params.id }, select: { id: true } });
      if (!record) return res.status(422).json({ error: "Guarda la historia clínica antes de finalizar la cita" });
    }

    const { appointment } = await completeAppointment({
      tenantId,
      appointmentId: req.params.id,
      completedAt,
    });

    const full = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: APPOINTMENT_INCLUDE,
    });

    // Side-effect no financiero preservado de Fase 1: recordatorio de grooming
    // (misma condición que tenía el PATCH legacy).
    if (full.petId) {
      const category = full.service?.category?.name;
      const stype = full.serviceType?.toLowerCase() ?? "";
      if (category === "grooming" || GROOMING_TYPES.includes(stype)) {
        await createGroomingReminderIfNeeded({
          petId: full.petId,
          tenantId: full.tenantId,
          appointmentId: full.id,
          appointmentDate: full.date,
        }).catch((err) => console.error("[NextAction] Grooming reminder error:", err));
      }
    }

    res.json(mapForActor(req, full));
  } catch (error) {
    if (error instanceof AppointmentNotFoundError) return res.status(404).json({ error: error.message });
    if (error instanceof InvalidStatusTransitionError) return res.status(422).json({ error: error.message });
    if (error instanceof UnresolvedPriceError) return res.status(422).json({ error: error.message });
    console.error("[Dashboard] Complete appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Precio acordado para una mascota y un servicio. Servicios administra la
// PriceRule; la cita actual conserva el importe pactado como override.
router.patch("/appointments/:id/agreed-price", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const amount = req.body?.price;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 99999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
      return res.status(400).json({ error: "El precio debe ser un número válido entre 0 y 99.999.999,99." });
    }

    const appointment = await prisma.appointment.findFirst({
      where: tenantId ? { id: req.params.id, tenantId } : { id: req.params.id },
    });
    if (!appointment) return res.status(404).json({ error: ERRORS.NOT_FOUND("Cita") });
    if (["completed", "cancelled", "no_show"].includes(appointment.status)) {
      return res.status(422).json({ error: "No se puede cambiar el precio de una cita cerrada." });
    }
    if (!appointment.petId || !appointment.serviceId) {
      return res.status(422).json({ error: "La cita necesita mascota y servicio para guardar una tarifa propia." });
    }

    await changeServicePrice({
      serviceId: appointment.serviceId,
      tenantId: appointment.tenantId ?? null,
      target: { type: "pet", petId: appointment.petId },
      newPrice: amount,
    });

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { finalPrice: amount, ...actorSnapshot(req.actor, "price") },
      include: APPOINTMENT_INCLUDE,
    });
    res.json(mapForActor(req, updated));
  } catch (error) {
    if (error instanceof ServiceNotFoundError || error instanceof PriceRuleTargetNotFoundError) {
      return res.status(404).json({ error: "Servicio o mascota no encontrado en este establecimiento." });
    }
    if (error instanceof InvalidPriceError) return res.status(400).json({ error: error.message });
    if (error instanceof DuplicatePriceRuleError) return res.status(409).json({ error: "El precio ya cambió. Actualiza la cita e inténtalo de nuevo." });
    console.error("[Dashboard] Agreed appointment price error:", error);
    res.status(500).json({ error: "No se pudo guardar el precio de la mascota." });
  }
});

router.patch("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const { status, staffId, serviceId, finalPrice } = req.body ?? {};
    if (staffId !== undefined && staffId !== null && (typeof staffId !== 'string' || !staffId.trim())) return res.status(400).json({ error: 'Profesional no válido.' });
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "date")) {
      return res.status(422).json({ error: "Para reprogramar, cancela esta cita y reserva una nueva en un horario disponible" });
    }

    // Ownership check
    const existing = await prisma.appointment.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!existing) return res.status(404).json({ error: ERRORS.NOT_FOUND("Cita") });
    if (req.actor?.type === "vet") {
      const clinicalAppointment = await resolveVetAppointment(id, tenantId);
      const validation = validateVetAppointment(clinicalAppointment);
      if (validation) return res.status(validation.status).json({ error: validation.error });
      if (clinicalAppointment.staffId && clinicalAppointment.staffId !== req.actor.staffId) {
        return res.status(403).json({ error: "La cita está asignada a otro profesional" });
      }
    }

    const data = {};

    // Status transition
    if (status !== undefined) {
      if (!isValidStatus(status)) {
        return res.status(400).json({ error: ERRORS.INVALID_STATUS });
      }
      if (["pending", "confirmed"].includes(existing.status) && ["confirmed", "arrived"].includes(status) && isArrivalWindowExpired(existing.date)) {
        return res.status(422).json({ error: "Pasaron más de 30 minutos sin registrar la llegada. La cita se marcará como no asistida." });
      }
      if (["vet", "groomer"].includes(req.actor?.type) && existing.status === "arrived" && status === "in_progress" && existing.date < bogotaDayStart(getBogotaYmd())) {
        return res.status(422).json({ error: "Esta llegada pertenece a un día anterior. Solicita al administrador que revise la cita." });
      }
      // Entregable Puente (Etapa 1): la transición a "completed" pasa
      // obligatoriamente por el comando Completar Cita del contexto Agenda.
      if (status === "completed") {
        return res.status(422).json({
          error: "Completar una cita se hace con POST /appointments/:id/complete (Entregable Puente, ADR 007).",
        });
      }
      if (!isAllowedTransition(existing.status, status)) {
        return res.status(422).json({
          error: ERRORS.TRANSITION_NOT_ALLOWED(existing.status, status),
        });
      }
      data.status = status;
      Object.assign(data, autoTimestamps(existing.status, status));
      if (["vet", "groomer"].includes(req.actor?.type) && status === "in_progress" && !existing.staffId) {
        data.staffId = req.actor.staffId;
      }
    }

    // Staff must belong to same tenant
    if (staffId !== undefined) {
      if (['completed', 'cancelled', 'no_show'].includes(existing.status)) return res.status(422).json({ error: 'No se puede reasignar una cita cerrada.' });
      if (staffId) {
        const staff = await prisma.staff.findFirst({
          where: tenantId ? { id: staffId, tenantId } : { id: staffId },
        });
        if (!staff) return res.status(404).json({ error: ERRORS.STAFF_NOT_FOUND });
      }
      data.staffId = staffId || null;
    }

    // Service must belong to same tenant
    if (serviceId !== undefined) {
      if (serviceId) {
        const service = await prisma.service.findFirst({
          where: tenantId ? { id: serviceId, tenantId } : { id: serviceId },
          include: { category: { select: { name: true } } },
        });
        if (!service) return res.status(404).json({ error: ERRORS.SERVICE_NOT_FOUND });
        if (req.access && !moduleAllowsAppointment(req.access, { service })) return res.status(403).json({ error: "El área de ese servicio no está habilitada." });
      }
      data.serviceId = serviceId || null;
    }

    // Manual override: only store finalPrice when operator explicitly provides it.
    // Effective price at display time is resolved by price-resolver.service via mapAppointmentRow.
    if (finalPrice !== undefined) {
      if (["completed", "cancelled", "no_show"].includes(existing.status)) {
        return res.status(422).json({ error: "No se puede cambiar el precio de una cita cerrada." });
      }
      const amount = typeof finalPrice === "number" ? finalPrice : NaN;
      if (finalPrice !== null && (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)) {
        return res.status(400).json({ error: "El precio debe ser un número válido entre 0 y 99.999.999,99." });
      }
      data.finalPrice = finalPrice === null ? null : amount;
      Object.assign(data, actorSnapshot(req.actor, "price"));
    }

    const assignmentId = staffId !== undefined ? data.staffId : (data.staffId || (serviceId !== undefined ? existing.staffId : null));
    const selectedServiceId = serviceId !== undefined ? data.serviceId : existing.serviceId;
    // La disponibilidad se validó con esta combinación de servicio y profesional.
    // Si otra operación la cambia, la asignación debe volver a validarse.
    const assignmentSnapshot = assignmentId || staffId !== undefined || serviceId !== undefined
      ? { staffId: existing.staffId, serviceId: existing.serviceId }
      : {};
    async function write(db) {
    let updated;
    if (["pending", "confirmed"].includes(existing.status) && ["confirmed", "arrived"].includes(status)) {
      // El barrido de ausencias puede correr al mismo tiempo. Solo avanzar si
      // la cita conserva su estado y todavía está dentro de la tolerancia.
      const advanced = await db.appointment.updateMany({
        where: { id, tenantId: existing.tenantId, status: existing.status, ...assignmentSnapshot, date: { gt: new Date(Date.now() - ARRIVAL_GRACE_MS) }, ...(Object.keys(assignmentSnapshot).length ? { AND: [{ date: existing.date }] } : {}) },
        data,
      });
      if (advanced.count !== 1) return res.status(409).json({ error: "La cita cambió de estado o venció la tolerancia. Actualiza la agenda." });
      updated = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    } else if (["vet", "groomer"].includes(req.actor?.type) && status === "in_progress" && !existing.staffId) {
      const claim = await db.appointment.updateMany({
        where: { id, tenantId, staffId: null, status: existing.status, serviceId: existing.serviceId, date: existing.date },
        data,
      });
      if (claim.count !== 1) return res.status(409).json({ error: "Otro profesional acaba de iniciar esta atención. Actualiza la lista." });
      updated = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    } else if (assignmentId || staffId !== undefined || serviceId !== undefined) {
      const changed = await db.appointment.updateMany({ where: { id, tenantId: existing.tenantId, status: existing.status, staffId: existing.staffId, serviceId: existing.serviceId, date: existing.date }, data });
      if (changed.count !== 1) throw new (require('../../services/staff-scheduling.service').StaffUnavailableError)('La cita cambió mientras se reasignaba. Actualiza la agenda.');
      updated = await db.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
    } else {
      updated = await db.appointment.update({ where: { id }, data, include: APPOINTMENT_INCLUDE });
    }
    return updated;
    }
    const updated = assignmentId ? await withStaffLock(assignmentId, async tx => {
      const service = selectedServiceId ? await tx.service.findFirst({ where: { id: selectedServiceId, tenantId }, include: { category: true } }) : null;
      await assertStaffAssignment(tx, { staffId: assignmentId, tenantId, date: existing.date, service, serviceType: existing.serviceType, appointmentId: id });
      return write(tx);
    }) : await write(prisma);
    if (res.headersSent) return;
    res.json(mapForActor(req, updated));
  } catch (error) {
    if (error.code === 'STAFF_UNAVAILABLE') return res.status(error.status).json({ error: error.message });
    console.error("[Dashboard] Patch appointment error:", error);
    if (error.code === "P2025") return res.status(404).json({ error: "Not found" });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ────────────────────────────────────────────────────────────
// Vet appointment medical record (TAREA 10)
// ────────────────────────────────────────────────────────────

router.get("/appointments/:id/medical-record", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const appt = await resolveVetAppointment(id, tenantId);
    if (!appt) return res.status(404).json({ error: "Cita no encontrada" });

    const record = await prisma.medicalRecord.findUnique({
      where: { appointmentId: id },
      include: MEDICAL_RECORD_INCLUDE,
    });

    if (!record) return res.status(404).json({ error: "Sin registro de atención" });
    res.json(mapMedicalRecord(record));
  } catch (error) {
    console.error("[Dashboard] GET medical-record error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/appointments/:id/medical-record", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const {
      reason, findings, diagnosis, treatment, recommendations,
      weight, nextControlAt, staffId, expectedVersion, correctionReason,
    } = req.body ?? {};

    const appt = await resolveVetAppointment(id, tenantId);
    const validationError = validateVetAppointment(appt);
    if (validationError) {
      return res.status(validationError.status).json({ error: validationError.error });
    }
    if (req.actor?.type === "vet") {
      if (appt.staffId !== req.actor.staffId) {
        return res.status(403).json({ error: "La atención debe estar asignada a tu usuario para registrar la historia" });
      }
      if (!["in_progress", "completed"].includes(appt.status)) {
        return res.status(422).json({ error: "Inicia la atención antes de registrar la historia" });
      }
    }

    // Staff must belong to same tenant
    const attendingStaffId = req.actor?.type === "vet" ? req.actor.staffId : staffId;
    const clinicalRoles = req.actor?.type === "admin" ? { in: ["vet", "admin"] } : "vet";
    let actorName = req.actor?.email ?? "Administrador";
    if (attendingStaffId) {
      const staffMember = await prisma.staff.findFirst({
        where: tenantId ? { id: attendingStaffId, tenantId, role: clinicalRoles, active: true } : { id: attendingStaffId, role: clinicalRoles, active: true },
      });
      if (!staffMember) {
        return res.status(404).json({ error: "Profesional no encontrado en este tenant" });
      }
      if (req.actor?.type === "vet") actorName = staffMember.name;
    }

    // El dueño que usa su acceso administrador puede ser también veterinario.
    // Su ficha se vincula por correo dentro del tenant; no necesita otra clave.
    // Si el correo no identifica exactamente a una persona, no atribuimos la
    // historia a un profesional de forma ambigua.
    let authorStaffId = ["vet", "admin"].includes(req.actor?.type) ? req.actor.staffId ?? null : null;
    if (req.actor?.type === "admin" && authorStaffId) actorName = req.actor.name ?? req.actor.email ?? "Administrador";
    if (req.actor?.type === "admin" && !authorStaffId && req.actor.email) {
      const matches = await prisma.staff.findMany({
        where: { tenantId: appt.tenantId, email: { equals: req.actor.email, mode: "insensitive" }, role: { in: ["vet", "admin"] }, active: true },
        select: { id: true, name: true },
        take: 2,
      });
      if (matches.length === 1) { authorStaffId = matches[0].id; actorName = matches[0].name; }
    }

    const recordData = {
      petId: appt.petId,
      appointmentId: id,
      type: "consultation",
      title: "Consulta veterinaria",
      date: appt.date,
      staffId: attendingStaffId ?? null,
      reason: reason?.trim() || null,
      findings: findings?.trim() || null,
      diagnosis: diagnosis?.trim() || null,
      treatment: treatment?.trim() || null,
      recommendations: recommendations?.trim() || null,
      weight: weight === undefined ? undefined : weight === null ? null : Number(weight),
      nextControlAt: nextControlAt ? new Date(nextControlAt) : null,
    };

    // Strip undefined so Prisma doesn't complain on create vs update
    const createData = Object.fromEntries(
      Object.entries(recordData).filter(([, v]) => v !== undefined)
    );
    const updateData = Object.fromEntries(
      Object.entries(recordData).filter(([, v]) => v !== undefined)
    );
    createData.createdByStaffId = authorStaffId;
    createData.updatedByStaffId = authorStaffId;
    updateData.updatedByStaffId = authorStaffId;

    const result = await prisma.$transaction(async (tx) => {
      const record = await saveConsultationRecord(tx, {
        appointment: appt, createData, updateData, include: MEDICAL_RECORD_INCLUDE,
        expectedVersion, correctionReason,
        actor: { type: req.actor?.type ?? "admin", staffId: authorStaffId, name: actorName || "Profesional", email: req.actor?.email ?? null },
      });

      // Update Pet.weight with the most recent measurement
      if (weight !== undefined && weight !== null) {
        await tx.pet.update({
          where: { id: appt.petId },
          data: { weight: Number(weight) },
        });
      }

      return record;
    }, { isolationLevel: "Serializable" });

    // Auto-upsert "control" next action when nextControlAt is set
    await upsertControlFromRecord({
      petId: appt.petId,
      tenantId: appt.tenantId,
      recordId: result.id,
      dueAt: nextControlAt ? new Date(nextControlAt) : null,
      notes: result.diagnosis ? `Seguimiento: ${result.diagnosis}` : null,
    }).catch((err) => console.error("[NextAction] Control upsert error:", err));

    res.json(mapMedicalRecord(result));
  } catch (error) {
    if (error instanceof ClinicalRevisionError) return res.status(error.status).json({ error: error.message });
    if (["P2034", "P2002"].includes(error.code)) return res.status(409).json({ error: "El registro cambió mientras guardabas. Vuelve a abrir la consulta antes de guardar." });
    console.error("[Dashboard] PUT medical-record error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
