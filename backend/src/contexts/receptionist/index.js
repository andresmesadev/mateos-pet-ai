/**
 * Composition root del contexto Recepcionista IA (Entregable 3.4). Ensambla
 * el adaptador del motor conversacional legado e inyecta los casos de uso ya
 * expuestos por Empleados Digitales (3.2) y Comunicación (3.1). Diseño
 * congelado: docs/history/ENTREGABLE_3_4_GATE_REVIEW.md
 *
 * Sin capa de dominio propia ni entidades nuevas — Recepcionista IA es,
 * exclusivamente, una especialización del DigitalEmployee ya implementado.
 */
const { LegacyWhatsappEngineAdapter } = require("./infrastructure/engine/legacy-whatsapp-engine.adapter");
const { resolveTenantId } = require("./infrastructure/engine/resolve-tenant-id");
const { createProcessIncomingMessageUseCase } = require("./application/use-cases/process-incoming-message.usecase");
// Entregable 8.3 (D-E2): STEPS.HUMAN_TAKEOVER, ya el vocabulario cerrado del
// motor legado — evita repetir el string literal en este composition root.
const { STEPS } = require("../../services/conversation.service");

const agents = require("../agents");
const { DigitalEmployeeNotActiveError } = require("../agents/domain/errors");
const communication = require("../communication");
const { ConversationAlreadyEscalatedError } = require("../communication/domain/errors");
const logger = require("../../lib/logger");

const conversationalEngine = new LegacyWhatsappEngineAdapter();

const processIncomingMessage = createProcessIncomingMessageUseCase({
  getDigitalEmployees: agents.getDigitalEmployees,
  startAgentTask: agents.startAgentTask,
  registerAgentDecision: agents.registerAgentDecision,
  completeAgentTask: agents.completeAgentTask,
  generateEscalation: agents.generateEscalation,
  escalateConversation: communication.escalateConversation,
  DigitalEmployeeNotActiveErrorClass: DigitalEmployeeNotActiveError,
  ConversationAlreadyEscalatedErrorClass: ConversationAlreadyEscalatedError,
  conversationalEngine,
  resolveTenantId,
  logger,
  humanTakeoverStep: STEPS.HUMAN_TAKEOVER,
});

module.exports = {
  processIncomingMessage,
};
