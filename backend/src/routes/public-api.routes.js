/**
 * Catálogo de Recursos de la API pública v1 (Ecosistema). Montado en app.js
 * bajo /api/public, protegido en conjunto por apiKeyAuth (req.apiKey ya
 * resuelto antes de llegar aquí). El tenantId de cada operación proviene
 * exclusivamente de req.apiKey.tenantId — nunca de body/params/query.
 *
 * Alcance congelado: GET /services (read:services), POST /availability
 * (read:availability). resolve-service-price queda fuera — bypass de
 * aislamiento en petId/clientId, documentado como deuda separada. Sin
 * creación/modificación de citas, sin clientes/mascotas/finanzas/Empleados
 * Digitales/Automatizaciones/Eventos/complete-appointment.
 */
const express = require("express");
const router = express.Router();

const { requireScope } = require("../middleware/requireScope");
const { listAvailableServices } = require("../contexts/services");
const { resolveStaffAvailability } = require("../contexts/staff");
const { ReferencedServiceNotFoundError } = require("../contexts/staff/domain/errors");

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

module.exports = router;
