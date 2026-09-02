const cron = require("node-cron");

/**
 * Entregable 8.2 (Fase 8) — D-F1, cola durable de mensajes entrantes.
 *
 * Antes de este entregable, webhook.controller.js procesaba el mensaje
 * inline dentro del ciclo de vida de la petición HTTP: un crash del proceso
 * a mitad de turno (Whisper/Vision/LLM/Prisma) perdía el mensaje del cliente
 * para siempre — y, desde 8.1 (D-E4), un reintento de Meta para ese mismo
 * wamid ya ni siquiera reprocesaba: la deduplicación lo descartaba en
 * silencio. Este worker reclama jobs de `InboundJob` (encolados por
 * webhook.controller.js, que ahora solo encola y responde 200) y ejecuta el
 * mismo pipeline de siempre — sin duplicar ni un fragmento de su lógica.
 *
 * Mismo mecanismo que jobs/event-delivery-retry.job.js (5.1): node-cron
 * sobre PostgreSQL, sin Redis ni cola externa. Intervalo corto (5s, con
 * campo de segundos — node-cron 4.x lo soporta) porque, a diferencia del
 * reintento de Automatizaciones, esto es la vía primaria de respuesta al
 * cliente — cada tick drena la cola completa, no un job por tick, para no
 * acumular atraso bajo ráfagas de mensajes.
 *
 * D-F6 (informe externo, corregido en este mismo entregable): un fallo de
 * `sendMessage` se registraba y se descartaba en silencio — el job quedaba
 * `done` (el análisis sí ocurrió) pero el cliente nunca recibía su respuesta
 * y nada la reintentaba. Reintentar todo el job reprocesaría el pipeline
 * completo desde cero (arriesgando efectos duplicados — otra cita, otra
 * mascota creada), así que el reintento vive aquí, acotado al envío: hasta
 * `MAX_SEND_ATTEMPTS` intentos con backoff corto, dentro de la misma
 * ejecución del job. Cubre el caso real (falla transitoria de Meta/red); un
 * fallo permanente (token inválido) seguiría fallando igual en un reintento
 * completo del job, así que no se ganaría nada difiriéndolo.
 */
const { processIncomingMessage } = require("../contexts/receptionist");
const { sendMessage } = require("../contexts/communication");
const {
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
} = require("../services/inbound-job.service");

const CRON_EXPRESSION = "*/5 * * * * *";
const MAX_SEND_ATTEMPTS = 3;
const SEND_RETRY_DELAY_MS = 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const deliverReply = async (result) => {
  if (!result?.processed || !result?.from || !result?.reply) {
    return;
  }

  if (result.user?.id) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
      try {
        await sendMessage({
          tenantId: result.user.tenantId ?? null,
          userId: result.user.id,
          conversationId: result.conversation?.id ?? null,
          phone: result.from,
          content: result.reply,
          origin: "agente",
        });
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_SEND_ATTEMPTS) {
          await delay(SEND_RETRY_DELAY_MS * attempt);
        }
      }
    }

    console.error(
      `[InboundMessageJob] No se pudo enviar respuesta a ${result.from} tras ${MAX_SEND_ATTEMPTS} intentos:`,
      lastError.message
    );
  } else {
    // Caso residual: no se pudo resolver user/conversation. Sin Comunicación
    // no hay a qué conversación adjuntar el mensaje — se registra, no se
    // envía en silencio.
    console.error(
      `[InboundMessageJob] No se pudo enviar respuesta a ${result.from}: usuario no resuelto`
    );
  }
};

const processOneJob = async () => {
  const job = await claimNextInboundJob();
  if (!job) return false;

  try {
    const result = await processIncomingMessage(job.payload);
    await deliverReply(result);
    await markInboundJobDone(job.id);
  } catch (error) {
    console.error("[InboundMessageJob] Error procesando job:", job.id, error.message);
    await markInboundJobFailed(job.id, error).catch((markError) =>
      console.error("[InboundMessageJob] Error marcando job como fallido:", markError.message)
    );
  }

  return true;
};

const drainInboundJobs = async () => {
  let processed = 0;
  // Drena la cola completa en cada tick — evita atraso creciente si llegan
  // varios mensajes entre disparos de cron. Tope defensivo por tick, no por
  // diseño de negocio: nunca debería alcanzarse en el volumen real de hoy.
  const MAX_PER_TICK = 50;

  while (processed < MAX_PER_TICK) {
    const didWork = await processOneJob();
    if (!didWork) break;
    processed += 1;
  }

  return processed;
};

const startInboundMessageJob = () => {
  cron.schedule(CRON_EXPRESSION, () => {
    drainInboundJobs().catch((error) => {
      console.error("[InboundMessageJob] Unhandled error:", error.message);
    });
  });

  console.log(`[InboundMessageJob] Scheduled every 5 seconds (${CRON_EXPRESSION})`);
};

module.exports = {
  startInboundMessageJob,
  drainInboundJobs,
  processOneJob,
};
