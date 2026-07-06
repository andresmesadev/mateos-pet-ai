/**
 * Composition root del contexto Coordinador de Agenda IA (Entregable 3.5).
 * Ensambla el adaptador del motor de recordatorios legado e inyecta los
 * casos de uso ya expuestos por Empleados Digitales (3.2). Diseño congelado:
 * docs/history/ENTREGABLE_3_5_GATE_REVIEW.md
 *
 * Sin capa de dominio propia ni entidades nuevas — Coordinador de Agenda IA
 * es, exclusivamente, una especialización del DigitalEmployee ya implementado.
 */
const { ReminderEngineAdapter } = require("./infrastructure/engine/reminder-engine.adapter");
const { createProcessReminderUseCase } = require("./application/use-cases/process-reminder.usecase");
const { ScheduleCoordinatorNotConfiguredError } = require("./application/errors/schedule-coordinator-not-configured.error");

const agents = require("../agents");
const logger = require("../../lib/logger");

const SPECIALIZATION = "coordinador_agenda";

const reminderEngine = new ReminderEngineAdapter();

const processReminderForEmployee = createProcessReminderUseCase({
  startAgentTask: agents.startAgentTask,
  registerAgentDecision: agents.registerAgentDecision,
  completeAgentTask: agents.completeAgentTask,
  reminderEngine,
  logger,
});

/**
 * Resuelve el Coordinador de Agenda IA activo. Se invoca UNA vez por
 * ejecución del job de recordatorios, no por ítem (Etapa 3, sección 5,
 * Decisión 3) — el job no segrega por tenant hoy (mismo comportamiento
 * preexistente a este entregable), por lo que se resuelve sin filtro de
 * tenant, tomando el primero activo del catálogo global/por tenant.
 */
async function resolveActiveCoordinator() {
  const { digitalEmployees } = await agents.getDigitalEmployees({});
  const candidates = digitalEmployees.filter((e) => e.specialization === SPECIALIZATION);
  if (candidates.length === 0) {
    throw new ScheduleCoordinatorNotConfiguredError(null);
  }
  return candidates.find((e) => e.status === "activo") ?? null;
}

/**
 * Procesa un recordatorio individual bajo el Coordinador ya resuelto para
 * esta ejecución del job.
 */
async function processReminder({ digitalEmployeeId, reminderType, entity }) {
  return processReminderForEmployee({ digitalEmployeeId, reminderType, entity });
}

module.exports = {
  resolveActiveCoordinator,
  processReminder,
};
