/**
 * ReminderEngineAdapterPort — frontera hacia el motor de recordatorios
 * legado (services/reminder.service.js), sin modificarlo. Cinco métodos, uno
 * por categoría ya existente — no se fuerza una interfaz genérica (Etapa 3,
 * sección 2): cada par sendX/markXSent ya existente tiene firma propia.
 */
class ReminderEngineAdapterPort {
  async sendAndMarkAppointmentReminder(_appointment) {
    throw new Error("ReminderEngineAdapterPort.sendAndMarkAppointmentReminder no implementado");
  }
  async sendAndMarkVaccineReminder(_record) {
    throw new Error("ReminderEngineAdapterPort.sendAndMarkVaccineReminder no implementado");
  }
  async sendAndMarkDewormingReminder(_record) {
    throw new Error("ReminderEngineAdapterPort.sendAndMarkDewormingReminder no implementado");
  }
  async sendAndMarkGroomingReminder(_record) {
    throw new Error("ReminderEngineAdapterPort.sendAndMarkGroomingReminder no implementado");
  }
  async sendAndMarkFollowUp(_appointment) {
    throw new Error("ReminderEngineAdapterPort.sendAndMarkFollowUp no implementado");
  }
}

module.exports = { ReminderEngineAdapterPort };
