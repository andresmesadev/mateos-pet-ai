const cron = require("node-cron");

/**
 * Entregable 5.1 (Fase 5) — Outbox de Eventos de Dominio.
 *
 * Antes de este entregable, `EventDelivery` certificaba resultados pero
 * ningún componente volvía a invocar al consumidor fallido — `retryEventDelivery`
 * (3.0) era código muerto. Este job cierra ese hueco para el único consumidor
 * real hoy ("Automatizaciones"): descubre Eventos de Dominio cuya última
 * entrega fue "failed" y reintenta `evaluateAndExecuteRules`, que ya es
 * idempotente por Regla (Entregable 5.1) — no duplica efectos secundarios.
 *
 * Se eligió node-cron (mismo mecanismo que jobs/reminder.job.js) en vez de
 * un worker dedicado o una cola externa (Bull/BullMQ/Redis): no hay ninguna
 * dependencia de cola en el proyecto, y el volumen real de EventDelivery en
 * producción es 0 filas (confirmado en la auditoría de Macroetapa 1) —
 * introducir infraestructura de colas hoy sería desproporcionado.
 *
 * No modifica ningún contexto de negocio (Agenda, Servicios, Staff, Finanzas,
 * Comunicación) ni el motor conversacional — opera exclusivamente sobre
 * Eventos y Automatizaciones, ambos explícitamente en alcance de la Fase 5.
 */
const events = require("../contexts/events");
const automation = require("../contexts/automation");

const CRON_EXPRESSION = "*/15 * * * *";
const CONSUMER = "Automatizaciones";

const retryFailedDeliveries = async () => {
  console.log("[EventDeliveryRetryJob] Running retry sweep for consumer:", CONSUMER);

  let pending = [];
  try {
    pending = await events.listDomainEventsAwaitingRetry(CONSUMER);
  } catch (error) {
    console.error("[EventDeliveryRetryJob] Error discovering pending retries:", error.message);
    return { total: 0, retried: 0 };
  }

  if (pending.length === 0) {
    console.log("[EventDeliveryRetryJob] No hay entregas pendientes de reintento.");
    return { total: 0, retried: 0 };
  }

  let retried = 0;
  for (const domainEvent of pending) {
    try {
      await automation.evaluateAndExecuteRules({ domainEvent, eventPayload: domainEvent.payload });
      retried += 1;
    } catch (error) {
      // evaluateAndExecuteRules ya nunca relanza (Invariante 3.3) — este catch
      // es una salvaguarda adicional para que un fallo inesperado en un
      // reintento no interrumpa el resto del lote.
      console.error("[EventDeliveryRetryJob] Error reintentando Evento:", domainEvent.id, error.message);
    }
  }

  console.log(`[EventDeliveryRetryJob] Reintentos ejecutados: ${retried}/${pending.length}`);
  return { total: pending.length, retried };
};

const startEventDeliveryRetryJob = () => {
  cron.schedule(
    CRON_EXPRESSION,
    () => {
      retryFailedDeliveries().catch((error) => {
        console.error("[EventDeliveryRetryJob] Unhandled error:", error.message);
      });
    }
  );

  console.log(`[EventDeliveryRetryJob] Scheduled every 15 minutes (${CRON_EXPRESSION})`);
};

module.exports = {
  startEventDeliveryRetryJob,
  retryFailedDeliveries,
};
