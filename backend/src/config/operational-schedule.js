/**
 * Los tres barridos se distribuyen dentro de cada ventana de 15 minutos.
 * PostgreSQL corre de forma persistente en la VPS y en desarrollo local.
 */
const getOperationalSchedules = () => ({
  mode: "standard",
  eventDeliveryRetry: "0 */15 * * * *",
  abandonedConversation: "15 */15 * * * *",
  inboundRecovery: "30 */15 * * * *",
});

module.exports = { getOperationalSchedules };
