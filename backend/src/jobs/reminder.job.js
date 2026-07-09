const cron = require("node-cron");

const {
  getAppointmentsForReminder,
  getUpcomingVaccineReminders,
  getUpcomingDewormingReminders,
  getUpcomingGroomingReminders,
  getConsultationsForFollowUp,
} = require("../services/reminder.service");

// Entregable 3.5 — Coordinador de Agenda IA: el envío + marcado de cada
// recordatorio ya no invoca directamente reminder.service.js — pasa por el
// caso de uso Procesar Recordatorio, que da auditoría real (Tarea/Decisión)
// sin cambiar el motor de recordatorios ni su comportamiento.
const scheduleCoordinator = require("../contexts/schedule-coordinator");
const { listActiveTenants } = require("../services/tenant.service");

const { TIMEZONE } = require("../lib/timezone");

const CRON_EXPRESSION = "0 9 * * *";

const EMPTY_COUNTS = () => ({
  appointments: { total: 0, sent: 0 },
  vaccines: { total: 0, sent: 0 },
  deworming: { total: 0, sent: 0 },
  grooming: { total: 0, sent: 0 },
  followUps: { total: 0, sent: 0 },
});

const addCounts = (a, b) => ({
  appointments: { total: a.appointments.total + b.appointments.total, sent: a.appointments.sent + b.appointments.sent },
  vaccines: { total: a.vaccines.total + b.vaccines.total, sent: a.vaccines.sent + b.vaccines.sent },
  deworming: { total: a.deworming.total + b.deworming.total, sent: a.deworming.sent + b.deworming.sent },
  grooming: { total: a.grooming.total + b.grooming.total, sent: a.grooming.sent + b.grooming.sent },
  followUps: { total: a.followUps.total + b.followUps.total, sent: a.followUps.sent + b.followUps.sent },
});

/**
 * Procesa los recordatorios de un único tenant. Aislado de otros tenants:
 * un fallo aquí no interrumpe el procesamiento de los demás (Entregable 4.1,
 * mismo principio de aislamiento de fallos de 3.3/3.4/3.5).
 */
const processRemindersForTenant = async (tenantId) => {
  let coordinator = null;
  try {
    coordinator = await scheduleCoordinator.resolveActiveCoordinator(tenantId);
  } catch (error) {
    console.warn(`[ReminderJob] Coordinador de Agenda IA no configurado (tenant ${tenantId}):`, error.message);
  }

  if (!coordinator) {
    console.warn(`[ReminderJob] Coordinador de Agenda IA no disponible (tenant ${tenantId}) — omitido esta ejecución`);
    return EMPTY_COUNTS();
  }

  const digitalEmployeeId = coordinator.id;

  const appointments = await getAppointmentsForReminder(tenantId);
  let appointmentSentCount = 0;

  for (const appointment of appointments) {
    try {
      const { sent } = await scheduleCoordinator.processReminder({
        digitalEmployeeId,
        reminderType: "appointment",
        entity: appointment,
      });
      if (sent) appointmentSentCount += 1;
    } catch (error) {
      console.error("[ReminderJob] Error processing appointment:", appointment.id, error.message);
    }
  }

  const vaccineRecords = await getUpcomingVaccineReminders(tenantId);
  let vaccineSentCount = 0;

  for (const record of vaccineRecords) {
    try {
      const { sent } = await scheduleCoordinator.processReminder({
        digitalEmployeeId,
        reminderType: "vaccine",
        entity: record,
      });
      if (sent) vaccineSentCount += 1;
    } catch (error) {
      console.error("[ReminderJob] Error processing vaccine reminder:", record.id, error.message);
    }
  }

  const dewormingRecords = await getUpcomingDewormingReminders(tenantId);
  let dewormingSentCount = 0;

  for (const record of dewormingRecords) {
    try {
      const { sent } = await scheduleCoordinator.processReminder({
        digitalEmployeeId,
        reminderType: "deworming",
        entity: record,
      });
      if (sent) dewormingSentCount += 1;
    } catch (error) {
      console.error("[ReminderJob] Error processing deworming reminder:", record.id, error.message);
    }
  }

  const groomingReminders = await getUpcomingGroomingReminders(tenantId);
  let groomingSentCount = 0;

  for (const record of groomingReminders) {
    try {
      const { sent } = await scheduleCoordinator.processReminder({
        digitalEmployeeId,
        reminderType: "grooming",
        entity: record,
      });
      if (sent) groomingSentCount += 1;
    } catch (error) {
      console.error("[ReminderJob] Error processing grooming reminder:", record.id, error.message);
    }
  }

  console.log(`[ReminderJob] (tenant ${tenantId}) Appointment reminders sent: ${appointmentSentCount}/${appointments.length}`);
  console.log(`[ReminderJob] (tenant ${tenantId}) Vaccine reminders sent: ${vaccineSentCount}/${vaccineRecords.length}`);
  console.log(`[ReminderJob] (tenant ${tenantId}) Deworming reminders sent: ${dewormingSentCount}/${dewormingRecords.length}`);
  console.log(`[ReminderJob] (tenant ${tenantId}) Grooming reminders sent: ${groomingSentCount}/${groomingReminders.length}`);

  const consultations = await getConsultationsForFollowUp(tenantId);
  let followUpSentCount = 0;

  for (const appointment of consultations) {
    try {
      const { sent } = await scheduleCoordinator.processReminder({
        digitalEmployeeId,
        reminderType: "follow_up",
        entity: appointment,
      });
      if (sent) followUpSentCount += 1;
    } catch (error) {
      console.error("[ReminderJob] Error processing follow-up:", appointment.id, error.message);
    }
  }

  console.log(`[ReminderJob] (tenant ${tenantId}) Follow-ups sent: ${followUpSentCount}/${consultations.length}`);

  return {
    appointments: { total: appointments.length, sent: appointmentSentCount },
    vaccines: { total: vaccineRecords.length, sent: vaccineSentCount },
    deworming: { total: dewormingRecords.length, sent: dewormingSentCount },
    grooming: { total: groomingReminders.length, sent: groomingSentCount },
    followUps: { total: consultations.length, sent: followUpSentCount },
  };
};

/**
 * Entregable 4.1 (Fase 4) — M4: el job pasó de correr una sola vez sin
 * distinción de tenant (deuda registrada en 3.5) a iterar explícitamente
 * cada tenant activo. El fallo de un tenant no interrumpe a los demás.
 */
const processReminders = async () => {
  console.log("[ReminderJob] Running daily reminder job");

  const tenants = await listActiveTenants();

  if (tenants.length === 0) {
    console.warn("[ReminderJob] No hay tenants activos — job omitido esta ejecución");
    return EMPTY_COUNTS();
  }

  let totals = EMPTY_COUNTS();

  for (const tenant of tenants) {
    try {
      const tenantCounts = await processRemindersForTenant(tenant.id);
      totals = addCounts(totals, tenantCounts);
    } catch (error) {
      console.error(`[ReminderJob] Error procesando tenant ${tenant.id}:`, error.message);
    }
  }

  return totals;
};

const startReminderJob = () => {
  cron.schedule(
    CRON_EXPRESSION,
    () => {
      processReminders().catch((error) => {
        console.error("[ReminderJob] Unhandled error:", error.message);
      });
    },
    {
      timezone: TIMEZONE,
    }
  );

  console.log(`[ReminderJob] Scheduled daily at 9:00 AM (${TIMEZONE})`);
};

module.exports = {
  startReminderJob,
  processReminders,
};
