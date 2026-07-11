/**
 * Composition root del contexto Empleados Digitales (Entregable 3.2).
 * Ensambla las implementaciones de infraestructura e inyecta los puertos en
 * los casos de uso de aplicación. Diseño congelado:
 * docs/history/ENTREGABLE_3_2_GATE_REVIEW.md
 *
 * Sin dependencia de Comunicación en este entregable (Etapa 3, sección 3) —
 * por eso no se integra en contexts/index.js. Entregable 5.2: sí depende de
 * Eventos, únicamente para certificar sus propios eventos como Evento de
 * Dominio real (events.registerDomainEvent, reutilizado sin cambios).
 */
const { PrismaDigitalEmployeeRepository } = require("./infrastructure/persistence/prisma-digital-employee.repository");
const { PrismaAgentTaskRepository } = require("./infrastructure/persistence/prisma-agent-task.repository");
const { PrismaAgentDecisionRepository } = require("./infrastructure/persistence/prisma-agent-decision.repository");
const { PrismaEscalationRepository } = require("./infrastructure/persistence/prisma-escalation.repository");
const { AgentsDomainEventsPublisher } = require("./infrastructure/events/agents-domain-events.publisher");
const events = require("../events");

const {
  createRegisterDigitalEmployeeUseCase,
  createPauseDigitalEmployeeUseCase,
  createReactivateDigitalEmployeeUseCase,
  createConfigureAutonomyLimitUseCase,
  createStartAgentTaskUseCase,
  createRegisterAgentDecisionUseCase,
  createCompleteAgentTaskUseCase,
  createGenerateEscalationUseCase,
  createAttendEscalationUseCase,
  createGetDigitalEmployeesUseCase,
  createGetAgentTasksUseCase,
  createGetAgentDecisionsUseCase,
  createGetPendingEscalationsUseCase,
} = require("./application/use-cases");

const digitalEmployeeRepository = new PrismaDigitalEmployeeRepository();
const agentTaskRepository = new PrismaAgentTaskRepository();
const agentDecisionRepository = new PrismaAgentDecisionRepository();
const escalationRepository = new PrismaEscalationRepository();
const eventPublisher = new AgentsDomainEventsPublisher({ registerDomainEvent: events.registerDomainEvent });

const registerDigitalEmployee = createRegisterDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
const pauseDigitalEmployee = createPauseDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
const reactivateDigitalEmployee = createReactivateDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher });
const configureAutonomyLimit = createConfigureAutonomyLimitUseCase({ digitalEmployeeRepository, eventPublisher });
const startAgentTask = createStartAgentTaskUseCase({ digitalEmployeeRepository, agentTaskRepository, eventPublisher });
const registerAgentDecision = createRegisterAgentDecisionUseCase({ agentTaskRepository, agentDecisionRepository, eventPublisher });
const completeAgentTask = createCompleteAgentTaskUseCase({ agentTaskRepository, eventPublisher });
const generateEscalation = createGenerateEscalationUseCase({ agentTaskRepository, escalationRepository, eventPublisher });
const attendEscalation = createAttendEscalationUseCase({ escalationRepository, eventPublisher });
const getDigitalEmployees = createGetDigitalEmployeesUseCase({ digitalEmployeeRepository });
const getAgentTasks = createGetAgentTasksUseCase({ digitalEmployeeRepository, agentTaskRepository });
const getAgentDecisions = createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository });
const getPendingEscalations = createGetPendingEscalationsUseCase({ escalationRepository });

// Entregable 5.3 — Aplicación Real de Límite de Autonomía: expone
// directamente el puerto ya existente desde 3.2 (nunca envuelto hasta ahora
// en ningún caso de uso ni exportado). No es un caso de uso de negocio —
// mismo estatus que las demás operaciones de infraestructura del proyecto
// (p. ej. `listDomainEventsAwaitingRetry` de 5.1).
const getAutonomyLimit = digitalEmployeeRepository.getAutonomyLimit.bind(digitalEmployeeRepository);

module.exports = {
  registerDigitalEmployee,
  pauseDigitalEmployee,
  reactivateDigitalEmployee,
  configureAutonomyLimit,
  startAgentTask,
  registerAgentDecision,
  completeAgentTask,
  generateEscalation,
  attendEscalation,
  getDigitalEmployees,
  getAgentTasks,
  getAgentDecisions,
  getPendingEscalations,
  getAutonomyLimit,
};
