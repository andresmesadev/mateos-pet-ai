const {
  sendReminder,
  markReminderSent,
  sendVaccineReminder,
  markVaccineReminderSent,
  sendDewormingReminder,
  markDewormingReminderSent,
  sendGroomingReminder,
  markGroomingReminderSent,
  sendFollowUp,
  markFollowUpSent,
} = require("../../../../services/reminder.service");
const { ReminderEngineAdapterPort } = require("../../application/ports/reminder-engine-adapter.port");

/**
 * Satisface ReminderEngineAdapterPort delegando exclusivamente en el motor
 * de recordatorios existente (services/reminder.service.js) — sin
 * modificarlo (Etapa 1, Decisión 4; Etapa 3, sección 1). Cada método envuelve
 * exactamente el par sendX/markXSent ya existente, tal como lo hacía
 * jobs/reminder.job.js antes de este entregable.
 */
class ReminderEngineAdapter extends ReminderEngineAdapterPort {
  async sendAndMarkAppointmentReminder(appointment) {
    const sent = await sendReminder(appointment);
    if (sent) await markReminderSent(appointment.id);
    return sent;
  }

  async sendAndMarkVaccineReminder(record) {
    const sent = await sendVaccineReminder(record, record.pet?.owner);
    if (sent) await markVaccineReminderSent(record.id);
    return sent;
  }

  async sendAndMarkDewormingReminder(record) {
    const sent = await sendDewormingReminder(record);
    if (sent) await markDewormingReminderSent(record.id);
    return sent;
  }

  async sendAndMarkGroomingReminder(record) {
    const sent = await sendGroomingReminder(record);
    if (sent) await markGroomingReminderSent(record.id);
    return sent;
  }

  async sendAndMarkFollowUp(appointment) {
    const sent = await sendFollowUp(appointment);
    if (sent) await markFollowUpSent(appointment.id);
    return sent;
  }
}

module.exports = { ReminderEngineAdapter };
