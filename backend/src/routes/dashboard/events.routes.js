const express = require("express");
const router = express.Router();
// Entregable 3.0 — Infraestructura de Eventos. Rutas de Administración y
// Consulta únicamente: "Registrar/Reintentar Entrega de Evento" son
// operaciones del mecanismo de entrega, sin adaptador HTTP (Etapa 3, sección 5).
const {
  registerEventType,
  deactivateEventType,
  getEventCatalog,
  listDomainEvents,
  listEventDeliveries,
} = require("../../contexts/events");
const {
  InvalidEventTypeAttributesError,
  DuplicateEventTypeNameError,
  EventTypeNotFoundError,
  EventTypeAlreadyInactiveError,
  DomainEventNotFoundError,
} = require("../../contexts/events/domain/errors");

function mapEventsDomainError(res, error) {
  if (error instanceof InvalidEventTypeAttributesError) return res.status(400).json({ error: error.message });
  if (error instanceof EventTypeNotFoundError || error instanceof DomainEventNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof DuplicateEventTypeNameError || error instanceof EventTypeAlreadyInactiveError) {
    return res.status(409).json({ error: error.message });
  }
  return null;
}

// POST /event-types — Registrar Tipo de Evento en el Catálogo (Administración).
router.post("/event-types", async (req, res) => {
  try {
    const { name, originContext, payloadContractDescription } = req.body ?? {};
    const { eventType } = await registerEventType({ name, originContext, payloadContractDescription });
    res.status(201).json(eventType);
  } catch (error) {
    if (mapEventsDomainError(res, error)) return;
    console.error("[Dashboard] Register event type error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /event-types/:name/deactivate — Desactivar Tipo de Evento (Administración).
router.post("/event-types/:name/deactivate", async (req, res) => {
  try {
    const { eventType } = await deactivateEventType({ name: req.params.name });
    res.json(eventType);
  } catch (error) {
    if (mapEventsDomainError(res, error)) return;
    console.error("[Dashboard] Deactivate event type error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /event-types — Consultar Catálogo de Eventos.
router.get("/event-types", async (req, res) => {
  try {
    const { eventTypes } = await getEventCatalog();
    res.json(eventTypes);
  } catch (error) {
    console.error("[Dashboard] Get event catalog error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /domain-events?eventType=&from=&to= — Consultar Eventos de Dominio.
router.get("/domain-events", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { eventType, from, to } = req.query;
    const { domainEvents } = await listDomainEvents({
      tenantId,
      eventTypeName: eventType || null,
      dateStart: from || null,
      dateEnd: to || null,
    });
    res.json(domainEvents);
  } catch (error) {
    console.error("[Dashboard] List domain events error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /domain-events/:id/deliveries — Consultar Entregas de un Evento.
router.get("/domain-events/:id/deliveries", async (req, res) => {
  try {
    const { deliveries } = await listEventDeliveries({ domainEventId: req.params.id });
    res.json(deliveries);
  } catch (error) {
    if (mapEventsDomainError(res, error)) return;
    console.error("[Dashboard] List event deliveries error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
