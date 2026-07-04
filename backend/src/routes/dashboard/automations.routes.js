const express = require("express");
const router = express.Router();
// Entregable 3.3 — Automatizaciones. Rutas de Administración y Consulta
// únicamente: "Evaluar y Ejecutar Reglas" es una operación reactiva sin
// invocador HTTP (Etapa 2/3, sección 5 — mismo estatus que el mecanismo de
// entrega de Eventos y las operaciones reactivas de Empleados Digitales).
const {
  registerAutomationRule,
  activateAutomationRule,
  deactivateAutomationRule,
  registerAutomationTemplate,
  activateAutomationTemplate,
  getAutomationRules,
  getAutomationTemplates,
  getAutomationExecutions,
} = require("../../contexts/automation");
const {
  InvalidAutomationRuleAttributesError,
  AutomationRuleNotFoundError,
  TriggerEventTypeNotFoundError,
  InvalidAutomationTemplateAttributesError,
  AutomationTemplateNotFoundError,
} = require("../../contexts/automation/domain/errors");

function mapAutomationDomainError(res, error) {
  if (error instanceof InvalidAutomationRuleAttributesError || error instanceof InvalidAutomationTemplateAttributesError) {
    return res.status(400).json({ error: error.message });
  }
  if (
    error instanceof AutomationRuleNotFoundError ||
    error instanceof AutomationTemplateNotFoundError ||
    error instanceof TriggerEventTypeNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }
  return null;
}

// POST /automation-rules — Registrar Regla de Automatización (Administración).
router.post("/automation-rules", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, triggerEventTypeName, condition, actionType, actionConfig } = req.body ?? {};
    const { rule } = await registerAutomationRule({ tenantId, name, triggerEventTypeName, condition, actionType, actionConfig });
    res.status(201).json(rule);
  } catch (error) {
    if (mapAutomationDomainError(res, error)) return;
    console.error("[Dashboard] Register automation rule error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /automation-rules/:id/activate — Activar Regla (Administración).
router.post("/automation-rules/:id/activate", async (req, res) => {
  try {
    const { rule } = await activateAutomationRule({ automationRuleId: req.params.id });
    res.json(rule);
  } catch (error) {
    if (mapAutomationDomainError(res, error)) return;
    console.error("[Dashboard] Activate automation rule error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /automation-rules/:id/deactivate — Desactivar Regla (Administración).
router.post("/automation-rules/:id/deactivate", async (req, res) => {
  try {
    const { rule } = await deactivateAutomationRule({ automationRuleId: req.params.id });
    res.json(rule);
  } catch (error) {
    if (mapAutomationDomainError(res, error)) return;
    console.error("[Dashboard] Deactivate automation rule error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /automation-rules — Consultar Reglas de Automatización.
router.get("/automation-rules", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { rules } = await getAutomationRules({ tenantId });
    res.json(rules);
  } catch (error) {
    console.error("[Dashboard] Get automation rules error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /automation-rules/:id/executions — Consultar Historial de Ejecuciones de una Regla.
router.get("/automation-rules/:id/executions", async (req, res) => {
  try {
    const { executions } = await getAutomationExecutions({ automationRuleId: req.params.id });
    res.json(executions);
  } catch (error) {
    if (mapAutomationDomainError(res, error)) return;
    console.error("[Dashboard] Get automation executions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /automation-templates — Registrar Plantilla de Automatización (Administración).
router.post("/automation-templates", async (req, res) => {
  try {
    const { name, description, triggerEventTypeName, defaultCondition, defaultActionType, defaultActionConfig } = req.body ?? {};
    const { template } = await registerAutomationTemplate({
      name,
      description,
      triggerEventTypeName,
      defaultCondition,
      defaultActionType,
      defaultActionConfig,
    });
    res.status(201).json(template);
  } catch (error) {
    if (mapAutomationDomainError(res, error)) return;
    console.error("[Dashboard] Register automation template error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /automation-templates — Consultar Catálogo de Plantillas.
router.get("/automation-templates", async (req, res) => {
  try {
    const { templates } = await getAutomationTemplates();
    res.json(templates);
  } catch (error) {
    console.error("[Dashboard] Get automation templates error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /automation-templates/:id/activate — Activar Plantilla (Administración).
router.post("/automation-templates/:id/activate", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name } = req.body ?? {};
    const { rule } = await activateAutomationTemplate({ tenantId, templateId: req.params.id, name });
    res.status(201).json(rule);
  } catch (error) {
    if (mapAutomationDomainError(res, error)) return;
    console.error("[Dashboard] Activate automation template error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
