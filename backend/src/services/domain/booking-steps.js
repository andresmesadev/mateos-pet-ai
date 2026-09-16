// Fix (2026-09-08): STEPS/BOOKING_STEPS vivían solo dentro de
// conversation.service.js. Cuando reminder.service.js empezó a necesitar
// BOOKING_STEPS (recordatorio de wizard abandonado) e importarlo desde ahí,
// se creó un ciclo real: conversation.service.js → appointment.service.js →
// reminder.service.js → conversation.service.js — Node advertía
// "Accessing non-existent property 'BOOKING_STEPS' of module exports inside
// circular dependency", y según el orden de carga (no determinista, depende
// de qué se requiere primero en cada arranque del proceso), reminder.service.js
// podía quedarse con BOOKING_STEPS = undefined de forma permanente —
// getAbandonedBookingConversations habría reventado con
// "Array.from(undefined) is not iterable" la primera vez que el orden de
// carga fuera desfavorable.
//
// Extraído a un módulo hoja sin dependencias — conversation.service.js y
// reminder.service.js importan de aquí, ninguno del otro. Rompe el ciclo
// de raíz en vez de solo evitarlo por orden de carga.
const STEPS = {
  AWAITING_PET_NAME: "awaiting_pet_name",
  AWAITING_PET_TYPE: "awaiting_pet_type",
  AWAITING_GROOMING_SLOT_CONFIRM: "awaiting_grooming_slot_confirm",
  AWAITING_DOMICILIO: "awaiting_domicilio",
  AWAITING_DOMICILIO_ADDRESS: "awaiting_domicilio_address",
  AWAITING_DATE_TIME: "awaiting_date_time",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  COMPLETED: "completed",
  // Entregable 8.3 (D-E1): antes "human_takeover" vivía como string literal
  // fuera de este enum — ver conversation.service.js para el historial
  // completo de esta decisión.
  HUMAN_TAKEOVER: "human_takeover",
};

const BOOKING_STEPS = new Set([
  STEPS.AWAITING_PET_NAME,
  STEPS.AWAITING_PET_TYPE,
  STEPS.AWAITING_GROOMING_SLOT_CONFIRM,
  STEPS.AWAITING_DOMICILIO,
  STEPS.AWAITING_DOMICILIO_ADDRESS,
  STEPS.AWAITING_DATE_TIME,
  STEPS.AWAITING_CONFIRMATION,
]);

module.exports = { STEPS, BOOKING_STEPS };
