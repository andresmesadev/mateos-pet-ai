/**
 * Catálogo de Recursos de la API pública v1 (Ecosistema). Montado en app.js
 * bajo /api/public, protegido en conjunto por apiKeyAuth (req.apiKey ya
 * resuelto antes de llegar aquí). El tenantId de cada operación proviene
 * exclusivamente de req.apiKey.tenantId — nunca de body/params/query.
 *
 * Alcance congelado: GET /services (read:services), POST /availability
 * (read:availability), POST /availability/slots (read:availability),
 * POST /auth/request-code y /auth/verify-code (Identidad de Cliente),
 * POST /appointments (write:appointments — Reserva de Cita), GET
 * /appointments (read:appointments) y POST /appointments/:id/cancel
 * (write:appointments) — Gestión de Cita. Estos cuatro últimos, además de
 * apiKeyAuth, exigen clientAuth. resolve-service-price queda fuera —
 * bypass de aislamiento en petId/clientId, documentado como deuda
 * separada. Sin edición/reprogramación de citas, sin clientes/mascotas/
 * finanzas/Empleados Digitales/Automatizaciones/Eventos/complete-appointment.
 */
const express = require("express");
const router = express.Router();

const { requireScope } = require("../middleware/requireScope");
const { listAvailableServices, getServiceCategory } = require("../contexts/services");
const { ServiceNotFoundError } = require("../contexts/services/domain/errors");
const { resolveStaffAvailability } = require("../contexts/staff");
const { ReferencedServiceNotFoundError } = require("../contexts/staff/domain/errors");
const { clientAuthRequestCodeRateLimit } = require("../middleware/rateLimit");
const {
  suggestAvailableVetSlots,
  findNextAvailableGroomingSlot,
} = require("../services/availability-db.service");
const { requestVerificationCode, verifyCodeAndCreateSession } = require("../services/client-auth.service");
const { clientAuth } = require("../middleware/clientAuth");
const {
  createAppointment,
  buildAppointmentDateTime,
  getUserAppointments,
  syncCancelToCalendar,
} = require("../services/appointment.service");
const { SlotAlreadyBookedError } = require("../services/errors/slot-already-booked.error");
const { isAllowedTransition } = require("../services/appointment-status.service");
const prisma = require("../lib/prisma");

function toPublicService(service) {
  return {
    id: service.id,
    name: service.name,
    categoryId: service.categoryId,
    duration: service.duration,
    basePrice: service.basePrice,
    requiresAppointment: service.requiresAppointment,
  };
}

function toPublicStaff(staff) {
  return { id: staff.id, name: staff.name };
}

function toPublicAppointment(appointment) {
  return {
    id: appointment.id,
    date: appointment.date,
    status: appointment.status,
    petName: appointment.petName,
    petType: appointment.petType,
  };
}

/**
 * GET /api/public/services
 * Query: categoryId? (string)
 */
router.get("/services", requireScope("read:services"), async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : null;

    const { services } = await listAvailableServices({ tenantId, categoryId });
    res.json({ services: services.map(toPublicService) });
  } catch (error) {
    console.error("[PublicApi] GET /services error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/public/availability
 * Body: { serviceId: string, rangeStart: ISO string, rangeEnd: ISO string }
 */
router.post("/availability", requireScope("read:availability"), async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { serviceId, rangeStart, rangeEnd } = req.body ?? {};

    if (!serviceId || typeof serviceId !== "string") {
      return res.status(400).json({ error: "serviceId es requerido" });
    }
    if (!rangeStart || !rangeEnd) {
      return res.status(400).json({ error: "rangeStart y rangeEnd son requeridos" });
    }
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "rangeStart y rangeEnd deben ser fechas ISO válidas" });
    }
    if (start >= end) {
      return res.status(400).json({ error: "rangeStart debe ser anterior a rangeEnd" });
    }

    const { availableStaff } = await resolveStaffAvailability({
      serviceId,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      tenantId,
    });

    res.json({ availableStaff: availableStaff.map(toPublicStaff) });
  } catch (error) {
    if (error instanceof ReferencedServiceNotFoundError) {
      return res.status(404).json({ error: "serviceId no encontrado" });
    }
    console.error("[PublicApi] POST /availability error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Puente Servicios → bucket de disponibilidad (Disponibilidad Real de
// Horarios). Solo las dos categorías canónicas del contexto Servicios
// tienen bucket conocido — cualquier otra responde explícitamente "sin
// disponibilidad", nunca un bucket inventado ni un error.
const CATEGORY_TO_AVAILABILITY_BUCKET = { veterinary: "vet", grooming: "grooming" };

/**
 * POST /api/public/availability/slots
 * Body: { serviceId: string, dateKey?: string }
 * Reutiliza suggestAvailableVetSlots/findNextAvailableGroomingSlot
 * (availability-db.service.js) sin modificarlas — mismos exports ya
 * usados por el motor conversacional desde 6.2.
 */
router.post("/availability/slots", requireScope("read:availability"), async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { serviceId, dateKey } = req.body ?? {};

    if (!serviceId || typeof serviceId !== "string") {
      return res.status(400).json({ error: "serviceId es requerido" });
    }

    const { categoryName } = await getServiceCategory({ serviceId, tenantId });
    const bucket = CATEGORY_TO_AVAILABILITY_BUCKET[categoryName] ?? null;

    if (!bucket) {
      return res.json({ available: false, slots: null });
    }

    if (bucket === "vet") {
      const { dateKey: resolvedDateKey, hours } = await suggestAvailableVetSlots({ dateKey, tenantId });
      return res.json({ available: hours.length > 0, slots: { dateKey: resolvedDateKey, hours } });
    }

    const slot = await findNextAvailableGroomingSlot({ tenantId });
    return res.json({ available: Boolean(slot), slots: slot });
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      return res.status(404).json({ error: "serviceId no encontrado" });
    }
    console.error("[PublicApi] POST /availability/slots error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Reserva de Cita (Portal del Cliente) — único recurso del catálogo público
 * que exige clientAuth además de apiKeyAuth: identifica de qué app/tenant
 * viene la request (ApiKey) y de qué cliente específico (ClientSession).
 *
 * POST /api/public/appointments
 * Body: { serviceId, dateKey, hour, petName, petType, address?, groomingBreed?, groomingSize? }
 *
 * userId exclusivamente de req.clientAuth.userId; tenantId exclusivamente
 * de req.apiKey.tenantId, verificado igual a req.clientAuth.tenantId antes
 * de continuar. Reutiliza getServiceCategory (verificación de tenant +
 * bucket) y createAppointment (sin modificarlo) — la protección de doble
 * reserva ya existe en el índice único que createAppointment ya respeta
 * (SlotAlreadyBookedError → 409).
 */
router.post("/appointments", clientAuth, requireScope("write:appointments"), async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { userId, tenantId: clientTenantId } = req.clientAuth;

    if (tenantId !== clientTenantId) {
      return res.status(403).json({ error: "La sesión de cliente no corresponde a esta ApiKey" });
    }

    const { serviceId, dateKey, hour, petName, petType, address, groomingBreed, groomingSize } = req.body ?? {};

    if (!serviceId || typeof serviceId !== "string") {
      return res.status(400).json({ error: "serviceId es requerido" });
    }
    if (!petName || !String(petName).trim()) {
      return res.status(400).json({ error: "petName es requerido" });
    }
    if (!petType || !String(petType).trim()) {
      return res.status(400).json({ error: "petType es requerido" });
    }

    const { categoryName } = await getServiceCategory({ serviceId, tenantId });
    const bucket = CATEGORY_TO_AVAILABILITY_BUCKET[categoryName] ?? null;
    if (!bucket) {
      return res.status(422).json({ error: "Este servicio no admite reserva de horario" });
    }

    let date;
    try {
      date = buildAppointmentDateTime(dateKey, hour);
    } catch (dateError) {
      return res.status(400).json({ error: "dateKey y hour deben ser válidos" });
    }

    const appointment = await createAppointment({
      userId,
      tenantId,
      petName,
      petType,
      serviceType: bucket,
      date,
      status: "confirmed",
      address,
      groomingBreed,
      groomingSize,
    });

    res.status(201).json({
      id: appointment.id,
      date: appointment.date,
      status: appointment.status,
      petName: appointment.petName,
      petType: appointment.petType,
    });
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      return res.status(404).json({ error: "serviceId no encontrado" });
    }
    if (error instanceof SlotAlreadyBookedError) {
      return res.status(409).json({ error: "El horario solicitado ya fue reservado" });
    }
    console.error("[PublicApi] POST /appointments error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Gestión de Cita (Portal del Cliente) — ver y cancelar las propias citas.
 * Mismos middlewares y verificación cruzada que la reserva. Sin edición ni
 * reprogramación en este alcance.
 *
 * GET /api/public/appointments
 * Reutiliza getUserAppointments(userId) sin modificarlo — ya filtra por
 * estados activos y fecha futura; userId ya está acotado a un tenant por
 * ClientSession, sin necesidad de filtro adicional.
 */
router.get("/appointments", clientAuth, requireScope("read:appointments"), async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { userId, tenantId: clientTenantId } = req.clientAuth;

    if (tenantId !== clientTenantId) {
      return res.status(403).json({ error: "La sesión de cliente no corresponde a esta ApiKey" });
    }

    const appointments = await getUserAppointments(userId);
    res.json({ appointments: appointments.map(toPublicAppointment) });
  } catch (error) {
    console.error("[PublicApi] GET /appointments error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/public/appointments/:id/cancel
 * Ownership obligatorio vía (id, userId, tenantId) en una sola consulta.
 * Reutiliza isAllowedTransition (appointment-status.service.js) y
 * syncCancelToCalendar (appointment.service.js, recién exportada) sin
 * duplicar ninguna de las dos.
 */
router.post("/appointments/:id/cancel", clientAuth, requireScope("write:appointments"), async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { userId, tenantId: clientTenantId } = req.clientAuth;

    if (tenantId !== clientTenantId) {
      return res.status(403).json({ error: "La sesión de cliente no corresponde a esta ApiKey" });
    }

    const { id } = req.params;
    const appointment = await prisma.appointment.findFirst({ where: { id, userId, tenantId } });
    if (!appointment) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }
    if (!isAllowedTransition(appointment.status, "cancelled")) {
      return res.status(422).json({ error: `No se puede cancelar una cita en estado "${appointment.status}"` });
    }

    const cancelled = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });
    syncCancelToCalendar(cancelled);

    res.json(toPublicAppointment(cancelled));
  } catch (error) {
    console.error("[PublicApi] POST /appointments/:id/cancel error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Identidad de Cliente (Portal del Cliente) — entregable acotado a
 * autenticación. tenantId siempre de req.apiKey.tenantId.
 *
 * POST /api/public/auth/request-code
 * Body: { phone: string }
 * Respuesta siempre genérica — exista o no el usuario — para evitar
 * enumeración de teléfonos registrados en el tenant.
 */
router.post("/auth/request-code", clientAuthRequestCodeRateLimit, async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { phone } = req.body ?? {};

    const result = await requestVerificationCode({ tenantId, phone });
    if (result.badRequest) {
      return res.status(400).json({ error: "phone es requerido" });
    }
    res.json({ message: "Si el teléfono está registrado, recibirás un código por WhatsApp." });
  } catch (error) {
    console.error("[PublicApi] POST /auth/request-code error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/public/auth/verify-code
 * Body: { phone: string, code: string }
 * Respuesta: { token } — token de sesión de cliente opaco, para usar en
 * X-Client-Token en endpoints futuros que lo requieran.
 */
router.post("/auth/verify-code", async (req, res) => {
  try {
    const { tenantId } = req.apiKey;
    const { phone, code } = req.body ?? {};

    const result = await verifyCodeAndCreateSession({ tenantId, phone, code });
    if (result.badRequest) {
      return res.status(400).json({ error: "phone y code son requeridos" });
    }
    if (!result.ok) {
      return res.status(401).json({ error: "Código inválido o expirado" });
    }
    res.json({ token: result.token });
  } catch (error) {
    console.error("[PublicApi] POST /auth/verify-code error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
