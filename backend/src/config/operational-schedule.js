const isEnabled = (value) => String(value).trim().toLowerCase() === "true";

/**
 * Agrupa los barridos periódicos en una sola ventana de actividad para que
 * Neon pueda volver a suspender el compute después de atenderlos. Durante el
 * desarrollo, una ejecución por hora conserva la recuperación automática sin
 * despertar la base de datos cuatro veces por hora.
 */
const getOperationalSchedules = ({
  lowUsage = isEnabled(process.env.NEON_LOW_USAGE_MODE),
} = {}) => ({
  mode: lowUsage ? "low-usage" : "standard",
  eventDeliveryRetry: lowUsage ? "0 0 * * * *" : "0 */15 * * * *",
  abandonedConversation: lowUsage ? "15 0 * * * *" : "15 */15 * * * *",
  inboundRecovery: lowUsage ? "30 0 * * * *" : "30 */15 * * * *",
});

module.exports = { getOperationalSchedules };
