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

const { TIMEZONE } = require("../lib/timezone");

const CRON_EXPRESSION = "0 9 * * *";

const processReminders = async () => {
  console.log("[ReminderJob] Running daily reminder job");

  // Resuelto UNA vez por ejecución, no por ítem (Etapa 3, sección 5, Decisión 3).
  let coordinator = null;
  try {
    coordinator = await scheduleCoordinator.resolveActiveCoordinator();
  } catch (error) {
    console.warn("[ReminderJob] Coordinador de Agenda IA no configurado:", error.message);
  }

  if (!coordinator) {
    console.warn("[ReminderJob] Coordinador de Agenda IA no disponible (pausado o no configurado) — job omitido esta ejecución");
    return {
      appointments: { total: 0, sent: 0 },
      vaccines: { total: 0, sent: 0 },
      deworming: { total: 0, sent: 0 },
      grooming: { total: 0, sent: 0 },
      followUps: { total: 0, sent: 0 },
    };
  }

  const digitalEmployeeId = coordinator.id;

  const appointments = await getAppointmentsForReminder();
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

  const vaccineRecords = await getUpcomingVaccineReminders();
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

  const dewormingRecords = await getUpcomingDewormingReminders();
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

  const groomingReminders = await getUpcomingGroomingReminders();
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

  console.log(`[ReminderJob] Appointment reminders sent: ${appointmentSentCount}/${appointments.length}`);
  console.log(`[ReminderJob] Vaccine reminders sent: ${vaccineSentCount}/${vaccineRecords.length}`);
  console.log(`[ReminderJob] Deworming reminders sent: ${dewormingSentCount}/${dewormingRecords.length}`);
  console.log(`[ReminderJob] Grooming reminders sent: ${groomingSentCount}/${groomingReminders.length}`);

  const consultations = await getConsultationsForFollowUp();
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

  console.log(`[ReminderJob] Follow-ups sent: ${followUpSentCount}/${consultations.length}`);

  return {
    appointments: { total: appointments.length, sent: appointmentSentCount },
    vaccines: { total: vaccineRecords.length, sent: vaccineSentCount },
    deworming: { total: dewormingRecords.length, sent: dewormingSentCount },
    grooming: { total: groomingReminders.length, sent: groomingSentCount },
    followUps: { total: consultations.length, sent: followUpSentCount },
  };
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
