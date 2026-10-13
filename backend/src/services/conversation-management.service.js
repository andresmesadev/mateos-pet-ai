const { STEPS } = require("./domain/booking-steps");
const { normalizeText } = require("./domain/intent-detector.service");
const { isConfirmationMessage } = require("./assistant-protocol.service");
const { getUserAppointments, cancelAppointment, formatAppointmentListLine, mapDbServiceTypeToSession } = require("./appointment.service");
const scheduling = require("./scheduling.service");
const { toDateKey } = require("./availability.service");

const result = (reply, step, sessionPatch = {}) => ({ reply, step, sessionPatch, forceRuleReply: true });
const clearManagement = { management_action: null, management_appointment_id: null, management_candidates: null, management_resume_step: null };
const clearRescheduling = {
  reschedule_appointment_id: null, pet_name: null, pet_type: null,
  requested_service: null, grooming_service: null,
  date: null, time: null, scheduling_date_key: null, scheduling_hour: null,
  domicilio: null, domicilio_address: null,
};

const handleAppointmentManagement = async ({ action, userId, tenantId, session = {}, userMessage = "", now = new Date(), petName }) => {
  const pendingManagement = [STEPS.AWAITING_APPOINTMENT_SELECTION, STEPS.AWAITING_MANAGEMENT_CONFIRM].includes(session.step);
  let resume = pendingManagement && session.management_resume_step !== undefined ? session.management_resume_step : session.step ?? null;
  if (!userId || !tenantId) return result("No puedo verificar tus citas en este momento. 🐾", resume);
  if (session.step === STEPS.AWAITING_MANAGEMENT_CONFIRM && (!action || action === session.management_action)) {
    if (!isConfirmationMessage(userMessage)) {
      return result("No he cancelado ninguna cita. Puedes confirmar la cancelación o decir «No, conservarla».",
        /\bno\b/i.test(userMessage) ? resume : session.step,
        /\bno\b/i.test(userMessage) ? clearManagement : {});
    }
    const cancelled = await cancelAppointment(userId, session.management_appointment_id, tenantId);
    const endsRescheduling = session.reschedule_appointment_id && session.reschedule_appointment_id === session.management_appointment_id;
    return result(cancelled ? `✅ Cita cancelada:\n${formatAppointmentListLine(cancelled)}\n\n¡Hasta pronto! 🐾` : "Esa cita ya no está activa. No cancelé ninguna otra.",
      endsRescheduling ? null : resume, { ...clearManagement, ...(endsRescheduling ? clearRescheduling : {}) });
  }
  const appointments = await getUserAppointments(userId, { tenantId, limit: 50 });
  // Recover old persisted selections without modifying an appointment.
  const staleRescheduling = session.reschedule_appointment_id && appointments.length < 50 && !appointments.some(a => a.id === session.reschedule_appointment_id);
  if (staleRescheduling) resume = null;
  const managementResult = (reply, step, patch = {}) => result(reply, step, {
    ...(staleRescheduling ? clearRescheduling : {}), ...patch,
  });
  if (action === "query_appointments") {
    return managementResult(appointments.length ? `Tus citas:\n${appointments.map(formatAppointmentListLine).join("\n")}\n\n${session.requested_service && !staleRescheduling ? "Podemos seguir con la nueva reserva." : ""}` : "No tienes citas activas. 🐾", resume);
  }
  const requestedAction = action || session.management_action;
  if (!requestedAction) return null;
  let candidates = appointments;
  const text = normalizeText(userMessage);
  const namedPets = appointments.filter(a => text.includes(normalizeText(a.petName)));
  if (namedPets.length) candidates = namedPets;
  if (petName && (` ${text} `).includes(` ${normalizeText(petName)} `)) candidates = candidates.filter(a => normalizeText(a.petName) === normalizeText(petName));
  if (/peluquer|grooming|bano/.test(text)) candidates = candidates.filter(a => mapDbServiceTypeToSession(a.serviceType) === "bath_grooming");
  else if (/veterinari|consulta/.test(text)) candidates = candidates.filter(a => mapDbServiceTypeToSession(a.serviceType) !== "bath_grooming");
  // Al reprogramar, la fecha del mensaje puede ser el destino, no la cita original.
  if (requestedAction === "cancel_appointment") {
    const terms = scheduling.extractExplicitSchedulingTerms(userMessage, now);
    const date = terms.dateText && scheduling.parseDateToKey(terms.dateText, now);
    if (date) candidates = candidates.filter(a => toDateKey(a.date) === toDateKey(date));
  }
  if (session.step === STEPS.AWAITING_APPOINTMENT_SELECTION && /^\d+$/.test(text)) {
    const selected = session.management_candidates?.[Number(text) - 1];
    candidates = appointments.filter(a => a.id === selected);
  }
  if (!candidates.length) return managementResult("No encontré una cita activa que coincida. Dime mascota y servicio; no he modificado ninguna cita.", resume, clearManagement);
  if (candidates.length > 1) {
    return managementResult(`¿Cuál cita quieres ${requestedAction === "cancel_appointment" ? "cancelar" : "mover"}?\n${candidates.map((a, i) => `${i + 1}. ${formatAppointmentListLine(a)}`).join("\n")}\n\nResponde con su número.`, STEPS.AWAITING_APPOINTMENT_SELECTION, {
      management_action: requestedAction, management_candidates: candidates.map(a => a.id), management_resume_step: resume,
    });
  }
  const selected = candidates[0];
  if (requestedAction === "reschedule_appointment") return managementResult(`Vamos a mover:\n${formatAppointmentListLine(selected)}\n\n¿Para qué día y hora? Tu cita original sigue reservada.`, STEPS.AWAITING_DATE_TIME, {
    ...clearManagement, reschedule_appointment_id: selected.id, pet_name: selected.petName,
    pet_type: selected.petType, requested_service: mapDbServiceTypeToSession(selected.serviceType),
    grooming_service: null, domicilio: Boolean(selected.address), domicilio_address: selected.address,
    intent: "schedule_appointment", date: null, time: null, scheduling_date_key: null, scheduling_hour: null,
  });
  return managementResult(`¿Confirmas cancelar esta cita?\n${formatAppointmentListLine(selected)}\n\nResponde «Sí, confirmo» o «No, conservarla».`, STEPS.AWAITING_MANAGEMENT_CONFIRM, {
    management_action: requestedAction, management_appointment_id: selected.id, management_resume_step: resume,
  });
};

module.exports = { handleAppointmentManagement };
