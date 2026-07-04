const express = require("express");
const router = express.Router();
// Entregable 3.2 — Empleados Digitales. Rutas de Administración y Consulta
// únicamente: "Iniciar Tarea/Registrar Decisión/Completar Tarea/Generar
// Escalación" son operaciones reactivas sin invocador real en este entregable
// (Etapa 2/Etapa 3, sección 5 — mismo estatus que el mecanismo de entrega de Eventos).
const {
  registerDigitalEmployee,
  pauseDigitalEmployee,
  reactivateDigitalEmployee,
  configureAutonomyLimit,
  attendEscalation,
  getDigitalEmployees,
  getAgentTasks,
  getAgentDecisions,
  getPendingEscalations,
} = require("../../contexts/agents");
const {
  InvalidDigitalEmployeeAttributesError,
  DigitalEmployeeNotFoundError,
  DigitalEmployeeAlreadyPausedError,
  DigitalEmployeeAlreadyActiveError,
  AgentTaskNotFoundError,
  InvalidEscalationAttributesError,
  EscalationNotFoundError,
  EscalationAlreadyResolvedError,
} = require("../../contexts/agents/domain/errors");

function mapAgentsDomainError(res, error) {
  if (error instanceof InvalidDigitalEmployeeAttributesError || error instanceof InvalidEscalationAttributesError) {
    return res.status(400).json({ error: error.message });
  }
  if (
    error instanceof DigitalEmployeeNotFoundError ||
    error instanceof AgentTaskNotFoundError ||
    error instanceof EscalationNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof DigitalEmployeeAlreadyPausedError || error instanceof DigitalEmployeeAlreadyActiveError || error instanceof EscalationAlreadyResolvedError) {
    return res.status(409).json({ error: error.message });
  }
  return null;
}

// POST /digital-employees — Registrar Empleado Digital (Administración).
router.post("/digital-employees", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { specialization } = req.body ?? {};
    const { digitalEmployee } = await registerDigitalEmployee({ tenantId, specialization });
    res.status(201).json(digitalEmployee);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Register digital employee error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /digital-employees/:id/pause — Pausar Empleado Digital (Administración).
router.post("/digital-employees/:id/pause", async (req, res) => {
  try {
    const { digitalEmployee } = await pauseDigitalEmployee({ digitalEmployeeId: req.params.id });
    res.json(digitalEmployee);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Pause digital employee error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /digital-employees/:id/reactivate — Reactivar Empleado Digital (Administración).
router.post("/digital-employees/:id/reactivate", async (req, res) => {
  try {
    const { digitalEmployee } = await reactivateDigitalEmployee({ digitalEmployeeId: req.params.id });
    res.json(digitalEmployee);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Reactivate digital employee error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /digital-employees/:id/autonomy-limits — Configurar Límite de Autonomía (Administración).
router.post("/digital-employees/:id/autonomy-limits", async (req, res) => {
  try {
    const { action, autoApproved } = req.body ?? {};
    const { limit } = await configureAutonomyLimit({ digitalEmployeeId: req.params.id, action, autoApproved });
    res.status(201).json(limit);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Configure autonomy limit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /digital-employees — Consultar Empleados Digitales.
router.get("/digital-employees", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { digitalEmployees } = await getDigitalEmployees({ tenantId });
    res.json(digitalEmployees);
  } catch (error) {
    console.error("[Dashboard] Get digital employees error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /digital-employees/:id/tasks — Consultar Tareas de un Empleado Digital.
router.get("/digital-employees/:id/tasks", async (req, res) => {
  try {
    const { tasks } = await getAgentTasks({ digitalEmployeeId: req.params.id });
    res.json(tasks);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Get agent tasks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /agent-tasks/:id/decisions — Consultar Decisiones de una Tarea.
router.get("/agent-tasks/:id/decisions", async (req, res) => {
  try {
    const { decisions } = await getAgentDecisions({ agentTaskId: req.params.id });
    res.json(decisions);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Get agent decisions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /escalations/pending — Consultar Escalaciones Pendientes.
router.get("/escalations/pending", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { escalations } = await getPendingEscalations({ tenantId });
    res.json(escalations);
  } catch (error) {
    console.error("[Dashboard] Get pending escalations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /escalations/:id/attend — Atender Escalación (Administración).
router.post("/escalations/:id/attend", async (req, res) => {
  try {
    const { assignedStaffId } = req.body ?? {};
    const { escalation } = await attendEscalation({ escalationId: req.params.id, assignedStaffId });
    res.json(escalation);
  } catch (error) {
    if (mapAgentsDomainError(res, error)) return;
    console.error("[Dashboard] Attend escalation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
