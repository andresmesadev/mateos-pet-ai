/**
 * Los barridos se distribuyen dentro de cada ventana operativa.
 * PostgreSQL corre de forma persistente en la VPS y en desarrollo local.
 */
const getOperationalSchedules = () => ({
  mode: "standard",
  eventDeliveryRetry: "0 */15 * * * *",
  abandonedConversation: "15 */15 * * * *",
  inboundRecovery: "30 */15 * * * *",
  appointmentNoShow: "45 */5 * * * *",
});

module.exports = { getOperationalSchedules };
