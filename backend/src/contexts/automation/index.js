/**
 * Composition root del contexto Automatizaciones (Entregable 3.3). Ensambla
 * las implementaciones de infraestructura e inyecta los puertos en los casos
 * de uso de aplicación. Diseño congelado:
 * docs/history/ENTREGABLE_3_3_GATE_REVIEW.md
 *
 * A diferencia de 3.0/3.1/3.2, este es el primer contexto de Fase 3 que, por
 * diseño, invoca directamente los composition roots de otros contextos ya
 * construidos (Comunicación, Empleados Digitales, Eventos) — Modelo de
 * Dominio §8: "Contextos que conoce: Todos". Nunca su lógica interna, solo
 * sus casos de uso ya expuestos.
 */
const { PrismaAutomationRuleRepository } = require("./infrastructure/persistence/prisma-automation-rule.repository");
const { PrismaAutomationTemplateRepository } = require("./infrastructure/persistence/prisma-automation-template.repository");
const { PrismaAutomationExecutionRepository } = require("./infrastructure/persistence/prisma-automation-execution.repository");
const { PrismaEventTypeLookupRepository } = require("./infrastructure/persistence/prisma-event-type-lookup.repository");
const { AutomationDomainEventsPublisher } = require("./infrastructure/events/automation-domain-events.publisher");
const { EventsRegisterEventDeliveryAdapter } = require("./infrastructure/events/event-delivery.adapter");
const { UseCaseActionExecutor } = require("./infrastructure/actions/use-case-action-executor");

const {
  createRegisterAutomationRuleUseCase,
  createActivateAutomationRuleUseCase,
  createDeactivateAutomationRuleUseCase,
  createRegisterAutomationTemplateUseCase,
  createActivateAutomationTemplateUseCase,
  createGetAutomationRulesUseCase,
  createGetAutomationTemplatesUseCase,
  createGetAutomationExecutionsUseCase,
  createEvaluateAndExecuteRulesMechanism,
} = require("./application/use-cases");

const communication = require("../communication");
const agents = require("../agents");
const events = require("../events");
const logger = require("../../lib/logger");

const automationRuleRepository = new PrismaAutomationRuleRepository();
const automationTemplateRepository = new PrismaAutomationTemplateRepository();
const automationExecutionRepository = new PrismaAutomationExecutionRepository();
const eventTypeLookup = new PrismaEventTypeLookupRepository();
const eventPublisher = new AutomationDomainEventsPublisher({ registerDomainEvent: events.registerDomainEvent });
const eventDelivery = new EventsRegisterEventDeliveryAdapter({ registerEventDelivery: events.registerEventDelivery });
const actionExecutor = new UseCaseActionExecutor({
  sendMessage: communication.sendMessage,
  startAgentTask: agents.startAgentTask,
});

const registerAutomationRule = createRegisterAutomationRuleUseCase({ automationRuleRepository, eventTypeLookup, eventPublisher });
const activateAutomationRule = createActivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
const deactivateAutomationRule = createDeactivateAutomationRuleUseCase({ automationRuleRepository, eventPublisher });
const registerAutomationTemplate = createRegisterAutomationTemplateUseCase({ automationTemplateRepository, eventTypeLookup, eventPublisher });
const activateAutomationTemplate = createActivateAutomationTemplateUseCase({
  automationTemplateRepository,
  automationRuleRepository,
  eventPublisher,
});
const getAutomationRules = createGetAutomationRulesUseCase({ automationRuleRepository });
const getAutomationTemplates = createGetAutomationTemplatesUseCase({ automationTemplateRepository });
const getAutomationExecutions = createGetAutomationExecutionsUseCase({ automationRuleRepository, automationExecutionRepository });

const evaluateAndExecuteRules = createEvaluateAndExecuteRulesMechanism({
  automationRuleRepository,
  automationExecutionRepository,
  actionExecutor,
  eventDelivery,
  logger,
});

module.exports = {
  registerAutomationRule,
  activateAutomationRule,
  deactivateAutomationRule,
  registerAutomationTemplate,
  activateAutomationTemplate,
  getAutomationRules,
  getAutomationTemplates,
  getAutomationExecutions,
  // Operación de infraestructura reactiva — no exponer vía HTTP (ver Etapa 2/3, sección 5).
  evaluateAndExecuteRules,
};
