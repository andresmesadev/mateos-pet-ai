const cron = require("node-cron");

/**
 * Mejora post-Fase 8 (2026-09-08) — mismo tipo de cambio que 8.1/8.2/8.3:
 * "Empleado Digital protegido no se reescribe sin diseño formal", no "nunca
 * se edita". Aprobado explícitamente antes de tocar el motor conversacional.
 *
 * Hallazgo (inspección del mapa mental del motor): un cliente que empieza a
 * agendar (session.step en un paso de reserva) y deja de responder nunca
 * recibe seguimiento — a diferencia de citas confirmadas, vacunas,
 * desparasitación y grooming, que sí tienen recordatorio (reminder.job.js).
 *
 * Reutiliza exactamente esa misma infraestructura — jobs/reminder.job.js
 * como plantilla, services/reminder.service.js como motor,
 * contexts/schedule-coordinator como capa de auditoría (Tarea/Decisión +
 * Límite de Autonomía, Entregable 5.3) — un sexto `reminderType`
 * ("abandoned_booking"), no un mecanismo nuevo.
 *
 * Cadencia propia (cada 15 min, no una vez al día como reminder.job.js):
 * el abandono se detecta en minutos, no en días — mismo cron que
 * jobs/event-delivery-retry.job.js. Ventana de 30-90 min desde el último
 * turno (Conversation.updatedAt) — siempre dentro de las 24h de WhatsApp,
 * así que no requiere plantilla pre-aprobada.
 */
const { getAbandonedBookingConversations } = require("../services/reminder.service");
const scheduleCoordinator = require("../contexts/schedule-coordinator");
const { listActiveTenants } = require("../services/tenant.service");
const logger = require("../lib/logger");

const CRON_EXPRESSION = "*/15 * * * *";
const REMINDER_TYPE = "abandoned_booking";

/**
 * Aislado de otros tenants: un fallo aquí no interrumpe el procesamiento de
 * los demás (mismo principio de aislamiento de fallos de reminder.job.js).
 */
const processAbandonedConversationsForTenant = async (tenantId) => {
  let coordinator = null;
  try {
    coordinator = await scheduleCoordinator.resolveActiveCoordinator(tenantId);
  } catch (error) {
    logger.warn(`[AbandonedConversationJob] Coordinador de Agenda IA no configurado (tenant ${tenantId}):`, error.message);
  }

  if (!coordinator) {
    logger.warn(`[AbandonedConversationJob] Coordinador de Agenda IA no disponible (tenant ${tenantId}) — omitido esta ejecución`);
    return { total: 0, sent: 0 };
  }

  const conversations = await getAbandonedBookingConversations(tenantId);
  let sentCount = 0;

  for (const conversation of conversations) {
    try {
      const { sent } = await scheduleCoordinator.processReminder({
        digitalEmployeeId: coordinator.id,
        reminderType: REMINDER_TYPE,
        entity: conversation,
      });
      if (sent) sentCount += 1;
    } catch (error) {
      logger.error(
        `[AbandonedConversationJob] Error procesando conversación ${conversation.id} (tenant ${tenantId}):`,
        error.message
      );
    }
  }

  return { total: conversations.length, sent: sentCount };
};

const runAbandonedConversationSweep = async () => {
  logger.info("[AbandonedConversationJob] Running sweep");

  let tenants = [];
  try {
    tenants = await listActiveTenants();
  } catch (error) {
    logger.error("[AbandonedConversationJob] Error listing active tenants:", error.message);
    return { total: 0, sent: 0 };
  }

  let total = 0;
  let sent = 0;

  for (const tenant of tenants) {
    try {
      const counts = await processAbandonedConversationsForTenant(tenant.id);
      total += counts.total;
      sent += counts.sent;
    } catch (error) {
      logger.error(`[AbandonedConversationJob] Error procesando tenant ${tenant.id}:`, error.message);
    }
  }

  logger.info(`[AbandonedConversationJob] Sweep done — total=${total} sent=${sent}`);
  return { total, sent };
};

const startAbandonedConversationJob = () => {
  cron.schedule(CRON_EXPRESSION, () => {
    runAbandonedConversationSweep().catch((error) => {
      logger.error("[AbandonedConversationJob] Unhandled error:", error.message);
    });
  });

  logger.info(`[AbandonedConversationJob] Scheduled every 15 minutes (${CRON_EXPRESSION})`);
};

module.exports = {
  startAbandonedConversationJob,
  runAbandonedConversationSweep,
  processAbandonedConversationsForTenant,
};
