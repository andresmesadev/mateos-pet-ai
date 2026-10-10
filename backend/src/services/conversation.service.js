// WhatsApp channel adapter.
// Responsibilities: receive session + analysis, orchestrate domain calls, return reply + session patch.
// Business logic lives in domain services; this file manages wizard state and message formatting.

// Fix (2026-09-08): STEPS/BOOKING_STEPS se movieron a domain/booking-steps.js
// (módulo hoja sin dependencias) para romper un ciclo real con
// reminder.service.js — ver ese archivo para el detalle completo. Se siguen
// reexportando desde aquí sin cambios para no romper a quien ya los importa
// de conversation.service.js (whatsapp.service.js, entre otros).
const { STEPS, BOOKING_STEPS } = require("./domain/booking-steps");
const { isAcknowledgementOnly, isFarewellOnly } = require("./booking-turn.service");
const { buildBookingReview } = require("./booking-message.service");
const { isConfirmationMessage, isPickupAddress, classifyManagementRequest, isAvailabilityQuestion } = require("./assistant-protocol.service");
const { handleAppointmentManagement } = require("./conversation-management.service");

const scheduling = require("./scheduling.service");
const { findNextAvailableGroomingSlot, listAvailableSlotsForDate } = require("./availability-db.service");
const { getBusinessHours, getActiveModules } = require("./business-config.service");
const { listBusinessServices } = require("./assistant-business-info.service");
const { isBusinessDay, resolveHourWindow, SERVICE_TYPES } = require("./availability.service");
const { generateReply: generateReplyWithAI } = require("./openai.service");
const { getUserPets } = require("./pet.service");
const {
  getRecordsByPet,
  getRecordsByType,
  formatRecordsForWhatsApp,
} = require("./medical-record.service");
const { findPetByNameAndOwner } = require("./pet.service");

// ─── Domain services ──────────────────────────────────────────────────────────

const {
  normalizeText,
  isMissing,
  capitalize,
  MANAGEMENT_INTENTS,
  detectQueryMedicalHistoryIntent,
  detectHumanTakeoverIntent,
  detectNoAppointmentNeeded,
  parseGroomingService,
  detectDomicilioIntent,
  resolveMedicalHistoryFilter,
} = require("./domain/intent-detector.service");


// ─── Confirmation protocol ────────────────────────────────────────────────────

// ─── WhatsApp formatting helpers ──────────────────────────────────────────────

const getPetLabel = (petType) => {
  if (petType === "dog") return "perrito";
  if (petType === "cat") return "gatito";
  return "mascota";
};

const getPetEmoji = (petType) => {
  if (petType === "dog") return "🐶";
  if (petType === "cat") return "🐱";
  return "🐾";
};

const WEEKDAYS = [
  ["2026-01-05", "lunes"], ["2026-01-06", "martes"],
  ["2026-01-07", "miércoles"], ["2026-01-08", "jueves"],
  ["2026-01-09", "viernes"], ["2026-01-10", "sábado"],
  ["2026-01-11", "domingo"],
];

const formatServiceHours = (serviceType, businessHours) => {
  const groups = new Map();
  for (const [dateKey, dayName] of WEEKDAYS) {
    if (!isBusinessDay(dateKey, businessHours, serviceType)) continue;
    const window = resolveHourWindow(serviceType, dateKey, businessHours);
    if (!window.active) continue;
    const label = `${String(window.startHour).padStart(2, "0")}:00–${String(window.endHourExclusive).padStart(2, "0")}:00`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(dayName);
  }
  if (groups.size === 0) return "sin horario disponible";
  return [...groups].map(([hours, days]) => `${days.join(", ")} de ${hours}`).join("; ");
};

const buildBusinessHoursReply = async (tenantId) => {
  try {
    const businessHours = await getBusinessHours(tenantId);
    return `Veterinaria: ${formatServiceHours(SERVICE_TYPES.VET, businessHours)}. Peluquería: ${formatServiceHours(SERVICE_TYPES.GROOMING, businessHours)}. Los festivos permanecen cerrados salvo apertura especial. ¿Para qué servicio buscas cita?`;
  } catch (error) {
    console.error("[Conversation] No se pudo consultar el horario:", error.message);
    return "No puedo verificar el horario de atención en este momento. Si me dices el servicio y el día, lo revisamos antes de agendar. 🐾";
  }
};

// ─── Session patch helpers ────────────────────────────────────────────────────

const handleQueryMedicalHistory = async (userId, session = {}, analysis = {}, userMessage = "") => {
  const petName = analysis?.pet_name ?? session?.pet_name;
  if (isMissing(petName)) {
    return { reply: "¿De qué mascota quieres ver el historial? 🐾", step: null, sessionPatch: {}, forceRuleReply: true };
  }
  if (!userId) {
    return { reply: `Aún no hay historial para ${petName} 🐾`, step: null, sessionPatch: {}, forceRuleReply: true };
  }
  try {
    const pet = await findPetByNameAndOwner(petName, userId);
    if (!pet) {
      return { reply: `Aún no hay historial para ${petName} 🐾`, step: null, sessionPatch: {}, forceRuleReply: true };
    }
    const filterType = resolveMedicalHistoryFilter(userMessage);
    const records = filterType
      ? await getRecordsByType(pet.id, filterType)
      : await getRecordsByPet(pet.id);
    if (!records.length) {
      return { reply: `Aún no hay historial para ${pet.name} 🐾`, step: null, sessionPatch: {}, forceRuleReply: true };
    }
    const emoji = getPetEmoji(pet.type ?? analysis?.pet_type ?? session?.pet_type);
    const body = formatRecordsForWhatsApp(records, { filterType });
    return { reply: `Historial de ${pet.name} ${emoji}:\n${body}`, step: null, sessionPatch: {}, forceRuleReply: true };
  } catch (error) {
    console.error("[Conversation] Query medical history error:", error.message);
    return { reply: "No pude consultar el historial 😔 ¿Intentamos de nuevo?", step: null, sessionPatch: {}, forceRuleReply: true };
  }
};

// ─── Grooming slot formatting ─────────────────────────────────────────────────

const offerNextGroomingSlot = async (petName, referenceDate, tenantId, requestedDate) => {
  const requestedKey = requestedDate && scheduling.parseDateToKey(requestedDate, referenceDate);
  const daySlots = requestedKey ? await listAvailableSlotsForDate({ dateKey: requestedKey, referenceDate, tenantId, serviceType: SERVICE_TYPES.GROOMING }) : [];
  const slot = daySlots.length ? { date: requestedKey, hour: daySlots[0] } : await findNextAvailableGroomingSlot({ referenceDate, tenantId });

  if (!slot) {
    return {
      reply: "Por el momento no tenemos espacios disponibles en grooming 😔 ¿Quieres que te avisemos cuando se libere uno?",
      step: null,
      sessionPatch: {},
    };
  }

  const dayLabel = scheduling.formatRelativeDayLabel(slot.date, referenceDate);
  const timeLabel = scheduling.formatHourAmPm(slot.hour);
  const petPart = petName ? ` para ${petName}` : "";

  return {
    reply: `${requestedKey && !daySlots.length ? "No hay un turno reservable para peluquería en el día solicitado. " : ""}${capitalize(dayLabel)} tenemos disponibilidad a las ${timeLabel}${petPart} 🛁 ¿Te queda bien esa hora?`,
    step: STEPS.AWAITING_GROOMING_SLOT_CONFIRM,
    sessionPatch: {
      scheduling_date_key: slot.date,
      scheduling_hour: slot.hour,
    },
  };
};


// ─── Wizard (WhatsApp conversation state machine) ─────────────────────────────

const isVetLikeService = (service) =>
  service === "veterinary_consultation" ||
  service === "medication" ||
  service === "general_appointment";

const resolveGenerateReplyInput = (input, options = {}) => {
  if (
    input && typeof input === "object" && !Array.isArray(input) &&
    ("analysis" in input || "semanticContext" in input || "session" in input)
  ) {
    return {
      analysis: input.analysis,
      session: input.session || {},
      semanticContext: input.semanticContext || "",
      userMessage: input.userMessage || "",
      // Entregable 8.1 (D-M1): historial ya construido por
      // context-builder.service.js (whatsapp.service.js), pasado tal cual.
      history: Array.isArray(input.history) ? input.history : [],
      options,
    };
  }
  return { analysis: input, session: {}, semanticContext: "", userMessage: "", history: [], options };
};

// Mejora post-Fase 8 (2026-09-08): antes, cualquier respuesta que avanzara el
// wizard (step en BOOKING_STEPS) se devolvía textual, sin pasar nunca por
// generateReplyWithAI — en la práctica, casi toda una reserva real (nombre de
// mascota, tipo, horario, domicilio, confirmación) salía como texto fijo
// idéntico siempre, mientras el prompt cálido de Lina (REPLY_SYSTEM_PROMPT)
// solo se usaba para ask_info y un par de ramas sueltas. Se quita ese bloqueo
// — el dato (fecha/hora/servicio) lo sigue decidiendo únicamente esta
// función; generateReplyWithAI solo puede adaptar el TONO de `suggestedReply`
// (mismo mecanismo, sin ampliar, que ya usan ask_info y la pregunta de
// veterinaria/grooming desde antes de este cambio). Los intents de gestión
// (cancelar/reprogramar/consultar) y las ramas con forceRuleReply explícito
// (saludo, "sin cita necesaria") siguen fijas — no formaban parte de este
// hallazgo ("el wizard de reserva se siente frío"), y tocarlas es un cambio
// de alcance distinto. Corrección 2026-10-09: las ofertas de peluquería,
// preguntas de recogida y confirmaciones vuelven a preservar el texto de
// reglas: la prueba real mostró que una reformulación anunciaba una reserva
// antes de pedir la dirección. Las preguntas generales siguen usando IA.
const shouldUseRuleReplyOnly = (ruleResult, analysis) => {
  if (ruleResult?.forceRuleReply) return true;
  if (MANAGEMENT_INTENTS.has(analysis?.intent)) return true;
  // Offers, pickup questions and completion must retain the actual operation,
  // rather than letting a tone rewrite claim that a reservation already exists.
  if ([STEPS.AWAITING_GROOMING_SLOT_CONFIRM, STEPS.AWAITING_DOMICILIO,
    STEPS.AWAITING_DOMICILIO_ADDRESS, STEPS.COMPLETED].includes(ruleResult?.step)) return true;
  return false;
};

const buildRuleBasedReply = async (analysis, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const session = options.session || {};
  const userMessage = options.userMessage || "";
  const userId = options.userId;
  const tenantId = options.tenantId;
  const needsClientName = Boolean(options.needsClientName);
  let currentStep = session.step ?? analysis?.step;

  if (isAcknowledgementOnly(userMessage) || isFarewellOnly(userMessage)) {
    return { reply: isFarewellOnly(userMessage) ? "¡Hasta pronto! Que tengas un buen día 🐾" : "¡Con mucho gusto! Que tengas un buen día. ¡Hasta pronto! 🐾", step: currentStep === STEPS.COMPLETED ? null : currentStep ?? null,
      sessionPatch: {}, forceRuleReply: true };
  }

  if (!analysis || typeof analysis !== "object") {
    return { reply: "No pude entender ese mensaje. ¿Puedes decirlo de otra forma? Conservé los datos que ya me diste. 🐾", step: currentStep ?? null, sessionPatch: {}, forceRuleReply: true };
  }

  const management = classifyManagementRequest(userMessage, analysis.intent, session);
  const intent = !management && session.requested_service && ["query_appointments", "ask_info", "greeting"].includes(analysis.intent)
    && isAvailabilityQuestion(userMessage) ? "schedule_appointment" : analysis.intent;

  // ── 0. Transferencia a humano (prioridad absoluta) ────────────────────────────
  if (detectHumanTakeoverIntent(userMessage)) {
    return {
      reply: "Con gusto 🐾 Solicitaré que una persona del equipo revise tu conversación. Si es urgente, contacta directamente al establecimiento.",
      step: STEPS.HUMAN_TAKEOVER,
      sessionPatch: { requires_human_attention: true },
      forceRuleReply: true,
    };
  }

  // ── 1. Gestión (máxima prioridad) ────────────────────────────────────────────
  if (management || [STEPS.AWAITING_APPOINTMENT_SELECTION, STEPS.AWAITING_MANAGEMENT_CONFIRM].includes(currentStep)) {
    return handleAppointmentManagement({ action: management, userId, tenantId, session, userMessage, now, petName: analysis.pet_name });
  }
  if (detectQueryMedicalHistoryIntent(userMessage, intent)) {
    return handleQueryMedicalHistory(userId, session, analysis, userMessage);
  }

  // ── 1b. Identificación inicial del cliente ────────────────────────────────────
  // El teléfono identifica la conversación, pero no reemplaza el nombre de la
  // persona. Este paso se ejecuta antes de pedir datos de la mascota.
  if (currentStep === STEPS.AWAITING_CLIENT_NAME) {
    if (isMissing(analysis.client_name)) {
      return {
        reply: "Antes de continuar, ¿con quién tengo el gusto? 😊",
        step: STEPS.AWAITING_CLIENT_NAME,
        sessionPatch: {},
        forceRuleReply: true,
      };
    }
    return {
      reply: `¡Mucho gusto, ${analysis.client_name}! 🐾 ¿En qué te podemos colaborar?`,
      step: null,
      sessionPatch: { client_name: analysis.client_name },
      forceRuleReply: true,
    };
  }

  if (needsClientName) {
    return {
      reply: `¡Hola! Soy Lina, asistente virtual de ${options.businessName || "el establecimiento"} 🐾 ¿Con quién tengo el gusto?`,
      step: STEPS.AWAITING_CLIENT_NAME,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  // ── 2. Saludo (siempre reinicia, sin importar el estado anterior) ────────────
  if (intent === "greeting") {
    if (currentStep && currentStep !== STEPS.COMPLETED) return { reply: "¡Hola de nuevo! Conservé tu reserva en curso. Dime cómo seguimos. 🐾", step: currentStep, sessionPatch: {}, forceRuleReply: true };
    const userName = options.userName ? `, ${options.userName.split(" ")[0]}` : "";
    return {
      reply: `¡Hola${userName}! Soy Lina 😊 ¿En qué te podemos colaborar hoy? 🐾`,
      step: null,
      sessionPatch: {
        step: null,
        requested_service: null,
        scheduling_date_key: null,
        scheduling_hour: null,
        pet_name: null,
        pet_type: null,
      },
      forceRuleReply: true,
    };
  }

  // ── 2b. Sin cita: vacunación / desparasitación ────────────────────────────────
  if (detectNoAppointmentNeeded(userMessage)) {
    return {
      reply: "Para vacunación y desparasitación no necesitas cita 🐾 Puedes venir durante el horario de atención del establecimiento, excepto los días cerrados y festivos. ¡Te esperamos!",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  // ── 3. Wizard grooming activo ─────────────────────────────────────────────────

  // 3a. Usuario responde al slot ofrecido
  const petChanged = analysis.pet_name && normalizeText(analysis.pet_name) !== normalizeText(session.pet_name || "");
  const freshTerms = scheduling.extractExplicitSchedulingTerms(userMessage, now);
  if (petChanged || freshTerms.dateText || freshTerms.timeText || isAvailabilityQuestion(userMessage)) {
    if ([STEPS.AWAITING_GROOMING_SLOT_CONFIRM, STEPS.AWAITING_DOMICILIO, STEPS.AWAITING_DOMICILIO_ADDRESS].includes(currentStep)) currentStep = null;
  }
  if (currentStep === STEPS.AWAITING_GROOMING_SLOT_CONFIRM) {
    if (isConfirmationMessage(userMessage)) {
      return {
        reply: "¡Perfecto! ¿Lo traes tú al salón o prefieres que lo recojamos en casa? 🏠",
        step: STEPS.AWAITING_DOMICILIO,
        sessionPatch: {},
      };
    }
    const nextSlot = await offerNextGroomingSlot(session.pet_name, now, tenantId);
    return nextSlot;
  }

  // 3b. Usuario responde sobre domicilio
  if (currentStep === STEPS.AWAITING_DOMICILIO) {
    const wantsDomicilio = detectDomicilioIntent(userMessage);

    if (wantsDomicilio === true) {
      return {
        reply: "Con gusto 🐾 ¿Cuál es la dirección de recogida?",
        step: STEPS.AWAITING_DOMICILIO_ADDRESS,
        sessionPatch: { domicilio: true },
      };
    }

    if (wantsDomicilio === false) {
      return {
        reply: buildBookingReview({ ...session, domicilio: false, domicilio_address: null }),
        step: STEPS.AWAITING_CONFIRMATION,
        sessionPatch: { domicilio: false, domicilio_address: null },
        forceRuleReply: true,
      };
    }

    return {
      reply: "¿Lo traes tú al salón o te lo recogemos? 🐾",
      step: STEPS.AWAITING_DOMICILIO,
      sessionPatch: {},
    };
  }

  // 3c. Usuario da la dirección
  if (currentStep === STEPS.AWAITING_DOMICILIO_ADDRESS) {
    const address = userMessage.trim();
    if (!isPickupAddress(address)) {
      return {
        reply: "¿Cuál es la dirección exacta de recogida? 📍",
        step: STEPS.AWAITING_DOMICILIO_ADDRESS,
        sessionPatch: {},
      };
    }
    return {
      reply: buildBookingReview({ ...session, domicilio_address: address }),
      step: STEPS.AWAITING_CONFIRMATION,
      sessionPatch: { domicilio_address: address },
      forceRuleReply: true,
    };
  }

  // ── 4. Flujo completado ───────────────────────────────────────────────────────
  if (currentStep === STEPS.COMPLETED) {
    return {
      reply: "¡Hola de nuevo! 😊 Soy Lina, ¿en qué te podemos colaborar hoy? 🐾",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  let petType = analysis.pet_type;
  const petName = analysis.pet_name;
  const service = analysis.requested_service;
  const date = analysis.date;
  const time = analysis.time;

  // ── 5. Info / otros ──────────────────────────────────────────────────────────
  if (intent === "ask_info") {
    if (/precio|cuanto cuesta|costo|valor|tarifa/i.test(normalizeText(userMessage))) return {
      reply: "Para confirmar el precio correcto necesitamos verificar el servicio y la mascota con el equipo. No he modificado tu reserva. 🐾",
      step: currentStep ?? null, sessionPatch: {}, forceRuleReply: true,
    };
    if (/servicios|ofrecen|laboratorio|rayos|cirugia/i.test(normalizeText(userMessage))) return {
      reply: await listBusinessServices(tenantId), step: currentStep ?? null, sessionPatch: {}, forceRuleReply: true,
    };
    if (/\b(horarios?|hora de atenci[oó]n|a qu[eé] hora|abren|cierran)\b/i.test(userMessage)) {
      return { reply: await buildBusinessHoursReply(tenantId), step: currentStep ?? null, sessionPatch: {}, forceRuleReply: true };
    }
    return {
      reply:
        "Puedo ayudarte con reservas y consultas sobre el establecimiento. Para precios o servicios específicos necesito información verificada; si no la tengo, lo revisa el equipo. 🐾",
      step: currentStep ?? null,
      sessionPatch: {},
    };
  }

  if (intent === "save_medical_info") {
    if (isMissing(petName)) {
      return { reply: "¿Cómo se llama tu mascota? 🐾", step: null, sessionPatch: {} };
    }
    return { reply: "Gracias por contarnos. Esa información debe revisarla el equipo veterinario; no la añadiré automáticamente a una ficha clínica. 🐾", step: currentStep ?? null, sessionPatch: {}, forceRuleReply: true };
  }

  // ── 6. Agendamiento ───────────────────────────────────────────────────────────
  const isBooking =
    !MANAGEMENT_INTENTS.has(intent) &&
    (intent === "schedule_appointment" || !isMissing(service));

  if (isBooking) {
    if (tenantId && typeof getActiveModules === "function" && service) {
      const modules = await getActiveModules(tenantId);
      const required = service === "bath_grooming" ? "grooming" : "veterinary";
      if (!modules.includes(required)) return { reply: "Ese servicio no está habilitado en este establecimiento. El equipo puede orientarte. 🐾", step: currentStep ?? null, sessionPatch: {}, forceRuleReply: true };
    }
    if (petName && userId) {
      const registered = await findPetByNameAndOwner(petName, userId);
      if (registered) petType = analysis.pet_type = registered.type;
    }
    if (isMissing(service)) {
      return {
        reply: "¡Con gusto te agendo! 🐾 ¿Es para veterinaria o grooming?",
        step: null,
        sessionPatch: {},
        forceRuleReply: true,
      };
    }

    if (isMissing(petName)) {
      if (userId) {
        try {
          const userPets = await getUserPets(userId);
          if (userPets && userPets.length > 0) {
            const petList = userPets.map((p) => `• ${p.name}`).join("\n");
            return {
              reply: `¿Para qué mascota es esta cita? 🐾\nTengo registrada${userPets.length === 1 ? "" : "s"}:\n${petList}\n\nDime su nombre; también puede ser otra mascota.`,
              step: STEPS.AWAITING_PET_NAME,
              sessionPatch: {},
              forceRuleReply: true,
            };
          }
        } catch { /* si falla el lookup, caemos al flujo normal */ }
      }
      const label = getPetLabel(petType);
      return {
        reply: service === "bath_grooming"
          ? `¡Claro! ¿Cómo se llama tu ${label}? 🐾`
          : `¡Con gusto! ¿Cómo se llama tu ${label}? 🐾`,
        step: STEPS.AWAITING_PET_NAME,
        sessionPatch: {},
        // La fecha/hora solicitada aún no se ha validado: la IA no debe
        // convertir esta pregunta de datos en una promesa de reserva.
        forceRuleReply: !isMissing(date) || !isMissing(time),
      };
    }

    if (isMissing(petType)) {
      return {
        reply: `¿${petName} es perro o gato? 🐶🐱`,
        step: STEPS.AWAITING_PET_TYPE,
        sessionPatch: {},
        forceRuleReply: !isMissing(date) || !isMissing(time),
      };
    }

    // ── Grooming ─────────────────────────────────────────────────────────────────
    if (service === "bath_grooming") {
      const groomSvc = parseGroomingService(userMessage) || session.grooming_service;
      const requestedTerms = scheduling.extractExplicitSchedulingTerms(userMessage, now);
      let slotResult;

      // Peluquería se asigna por orden de agenda. Una fecha y hora propuestas
      // solo se aceptan si coinciden con el siguiente turno consecutivo; si
      // no, se explica la regla y se conserva la propuesta real del sistema.
      if (requestedTerms.dateText && requestedTerms.timeText) {
        const requested = await scheduling.resolveGroomingScheduling({
          dateText: requestedTerms.dateText,
          timeText: requestedTerms.timeText,
          referenceDate: now,
          awaitingStepConstant: STEPS.AWAITING_GROOMING_SLOT_CONFIRM,
          confirmationStepConstant: STEPS.AWAITING_GROOMING_SLOT_CONFIRM,
          tenantId,
          excludeAppointmentId: session.reschedule_appointment_id,
        });

        if (requested?.sessionPatch) {
          slotResult = {
            ...requested,
            reply: `🐾 Mascota: ${petName}\n${requested.reply.replace(/¿Confirmamos la cita\?$/i, "").trim()} ¿Te queda bien ese turno?`,
          };
        } else {
          const nextSlot = await offerNextGroomingSlot(petName, now, tenantId);
          slotResult = {
            ...nextSlot,
            reply: `Para peluquería asignamos los turnos en el orden disponible 🐾 ${requested?.reply || "No podemos reservar esa hora."}\n\n${nextSlot.reply}`,
          };
        }
      } else {
        slotResult = await offerNextGroomingSlot(petName, now, tenantId, requestedTerms.dateText || date);
      }

      if (groomSvc && slotResult.sessionPatch) {
        slotResult.sessionPatch.grooming_service = groomSvc;
      }
      return slotResult;
    }

    // ── Veterinaria ───────────────────────────────────────────────────────────────
    if (isVetLikeService(service)) {
      if (isMissing(date) || isMissing(time)) {
        return {
          reply: "¡Con gusto te agendo! ¿Para qué día y hora te queda mejor? 📅 Revisaré el horario disponible para ese día.",
          step: STEPS.AWAITING_DATE_TIME,
          sessionPatch: {},
        };
      }

      const vet = await scheduling.resolveVetScheduling({
        dateText: date,
        timeText: time,
        referenceDate: now,
        awaitingStepConstant: STEPS.AWAITING_DATE_TIME,
        confirmationStepConstant: STEPS.AWAITING_CONFIRMATION,
        tenantId,
        excludeAppointmentId: session.reschedule_appointment_id,
      });

      if (vet) {
        return { reply: vet.step === STEPS.AWAITING_CONFIRMATION ? buildBookingReview({ ...session, ...analysis, ...vet.sessionPatch }) : vet.reply, step: vet.step, sessionPatch: vet.sessionPatch || {}, forceRuleReply: true };
      }

      return {
        reply: "¿Me dices el día y la hora de nuevo? 📅 (ej. mañana a las 2pm)",
        step: STEPS.AWAITING_DATE_TIME,
        sessionPatch: {},
      };
    }

    if (isMissing(date) || isMissing(time)) {
      return {
        reply: "¿Qué día y hora te queda mejor? 📅",
        step: STEPS.AWAITING_DATE_TIME,
        sessionPatch: {},
      };
    }

    return {
      reply: `¡Listo! Cita para ${petName} el ${date} a las ${time} 🐾 ¿Confirmamos?`,
      step: STEPS.AWAITING_CONFIRMATION,
      sessionPatch: {},
    };
  }

  return {
    reply: "¡Hola! Soy Lina 😊 ¿En qué te podemos colaborar hoy? 🐾",
    step: null,
    sessionPatch: {},
  };
};

// ─── Entry point ──────────────────────────────────────────────────────────────

const generateReply = async (input, legacyOptions) => {
  const { analysis, session, semanticContext, userMessage, history, options } =
    resolveGenerateReplyInput(input, legacyOptions);

  const ruleResult = await buildRuleBasedReply(analysis, {
    ...options,
    session,
    userMessage,
  });

  const contextText = typeof semanticContext === "string" ? semanticContext.trim() : "";

  // Entregable 8.1 (D-F4): antes, sin contexto semántico (contextText vacío)
  // ni siquiera se intentaba redactar con IA — un cliente nuevo sin historial
  // embebido recibía solo la plantilla de reglas. semanticContext vacío ya no
  // corta el intento; generateReplyWithAI (openai.service.js) redacta con lo
  // que haya, incluso sin memorias relevantes.
  if (shouldUseRuleReplyOnly(ruleResult, analysis) || analysis?.intent !== "ask_info" || !contextText) {
    return ruleResult;
  }

  try {
    const aiReply = await generateReplyWithAI({
      analysis,
      session,
      semanticContext: contextText,
      userMessage,
      suggestedReply: ruleResult.reply,
      history,
      // Mejora post-Fase 8 (2026-09-08): antes generateReplyWithAI nunca
      // recibía el nombre real del cliente (User.name) — solo la rama de
      // saludo lo usaba, y únicamente ahí. Se pasa aquí para que, con el
      // wizard ya elegible para reformularse (ver shouldUseRuleReplyOnly),
      // Lina pueda usarlo quien es donde suene natural, en vez de que
      // desaparezca después del primer "hola".
      clientName: options?.userName || null,
    });
    if (aiReply) return { ...ruleResult, reply: aiReply };
  } catch (error) {
    console.error("[Conversation] AI reply failed, using rule-based:", error.message);
  }

  return ruleResult;
};

module.exports = {
  // Reexportados desde domain/booking-steps.js — ver el fix del 2026-09-08
  // arriba (import) para por qué viven ahí y no aquí.
  STEPS,
  BOOKING_STEPS,
  normalizeText,
  isConfirmationMessage,
  generateReply,
};
