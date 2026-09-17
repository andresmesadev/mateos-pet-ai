const express = require("express");
const router = express.Router();
const {
  AgendaExceptionNotFoundError,
  AgendaExceptionOverlapError,
  InvalidAgendaExceptionError,
  listAgendaExceptions,
  previewAgendaException,
  createAgendaException,
  updateAgendaException,
  deleteAgendaException,
} = require("../../services/agenda-exception.service");

function tenantIdFromRequest(req) {
  return req.tenant?.tenantId || (req.tenant?.isSuperAdmin ? process.env.SINGLE_TENANT_ID : null) || null;
}

function sendDomainError(res, error) {
  if (error instanceof AgendaExceptionNotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  if (error instanceof AgendaExceptionOverlapError) {
    res.status(409).json({ error: error.message });
    return true;
  }
  if (error instanceof InvalidAgendaExceptionError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  return false;
}

router.get("/agenda-exceptions", async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });
    const exceptions = await listAgendaExceptions(tenantId, { from: req.query.from, to: req.query.to });
    return res.json({ exceptions });
  } catch (error) {
    if (sendDomainError(res, error)) return;
    console.error("[Dashboard] List agenda exceptions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agenda-exceptions/preview", async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });
    return res.json(await previewAgendaException(tenantId, req.body ?? {}));
  } catch (error) {
    if (sendDomainError(res, error)) return;
    console.error("[Dashboard] Preview agenda exception error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agenda-exceptions", async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });
    const result = await createAgendaException(tenantId, req.body ?? {});
    return res.status(201).json(result);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    console.error("[Dashboard] Create agenda exception error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/agenda-exceptions/:id", async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });
    const result = await updateAgendaException(tenantId, req.params.id, req.body ?? {});
    return res.json(result);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    console.error("[Dashboard] Update agenda exception error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/agenda-exceptions/:id", async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    if (!tenantId) return res.status(403).json({ error: "Forbidden" });
    await deleteAgendaException(tenantId, req.params.id);
    return res.status(204).end();
  } catch (error) {
    if (sendDomainError(res, error)) return;
    console.error("[Dashboard] Delete agenda exception error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
