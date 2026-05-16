/**
 * Orquestación de agenda (mock) entre conversación y availability.service.
 * Sin DB ni APIs externas. Logs con prefijo [scheduling].
 */

const {
  isBusinessDay,
  isWithinBusinessHours,
  suggestVetAlternativeSlots,
  getNextAvailableGroomingSlot,
  toDateKey,
  SERVICE_TYPES,
  vetBookedHours,
} = require("./availability.service");

/** Citas mock compartidas en memoria (reemplazar por DB más adelante). */
let mockAppointments = [];

const getMockAppointments = () => mockAppointments;

const pushMockAppointment = (appt) => {
  mockAppointments.push(appt);
  console.log("[scheduling] Mock cita agregada:", appt);
};

const normalizeText = (text) => {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

/**
 * Escalación humana (Lina / urgencia / restricción de horario).
 */
const detectHumanEscalation = (text) => {
  const n = normalizeText(text);
  if (!n) return false;

  const lina =
    n.includes("lina") &&
    (n.includes("hablar") || n.includes("quiero") || n.includes("contacto"));
  const urgent = n.includes("urgente");
  const onlyThatHour =
    n.includes("solo puedo") && n.includes("esa hora");

  const hit = lina || urgent || onlyThatHour;
  if (hit) {
    console.log("[scheduling] Escalación a humano detectada:", n.slice(0, 80));
  }
  return hit;
};

const formatHourAmPm = (hour) => {
  const h = Number(hour);
  if (!Number.isFinite(h)) return String(hour);
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
};

/**
 * Etiqueta relativa "hoy" / "mañana" / fecha ISO legible.
 */
const formatRelativeDayLabel = (dateKey, referenceDate = new Date()) => {
  const today = toDateKey(referenceDate);
  if (dateKey === today) return "hoy";

  const dRef = new Date(`${today}T12:00:00`);
  const dNext = new Date(dRef);
  dNext.setDate(dNext.getDate() + 1);
  if (dateKey === toDateKey(dNext)) return "mañana";

  return dateKey;
};

/**
 * Interpreta fecha en texto libre o ISO.
 */
const parseDateToKey = (dateText, referenceDate = new Date()) => {
  if (!dateText || typeof dateText !== "string") {
    return null;
  }

  const trimmed = dateText.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    return iso[1];
  }

  const n = normalizeText(dateText);
  const ref = referenceDate instanceof Date ? referenceDate : new Date();

  if (n.includes("hoy")) {
    return toDateKey(ref);
  }

  if (n.includes("manana") || n.includes("mañana")) {
    const d = new Date(toDateKey(ref) + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return toDateKey(d);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return toDateKey(parsed);
  }

  return null;
};

/**
 * Hora 0–23 desde texto (ej. "2pm", "14", "las 2").
 */
const parseTimeToHour = (timeText) => {
  if (timeText == null || timeText === "") {
    return null;
  }

  const raw = String(timeText).trim().toLowerCase();
  const s = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const withMeridiem = s.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/
  );
  if (withMeridiem) {
    let h = parseInt(withMeridiem[1], 10);
    const mer = withMeridiem[3].replace(/\./g, "");
    if (mer.startsWith("p")) {
      if (h !== 12) h += 12;
    } else if (mer.startsWith("a")) {
      if (h === 12) h = 0;
    }
    return h;
  }

  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    return parseInt(hm[1], 10);
  }

  const digits = s.match(/(\d{1,2})/);
  if (!digits) {
    return null;
  }

  let h = parseInt(digits[1], 10);
  if (h >= 0 && h <= 23 && h >= 13) {
    return h;
  }

  if (h >= 10 && h <= 12) {
    return h;
  }

  if (h >= 1 && h <= 9) {
    return h + 12;
  }

  return h;
};

const isVetLikeService = (service) =>
  service === "veterinary_consultation" ||
  service === "medication" ||
  service === "general_appointment";

/**
 * Resuelve disponibilidad vet cuando ya hay fecha y hora en la sesión/análisis.
 * @returns {null|{ reply: string, step: string|null, sessionPatch?: object }}
 */
const resolveVetScheduling = ({
  dateText,
  timeText,
  mockAppointments: appointments,
  referenceDate = new Date(),
  awaitingStepConstant,
  confirmationStepConstant,
}) => {
  const dateKey = parseDateToKey(dateText, referenceDate);
  const hour = parseTimeToHour(timeText);

  console.log("[scheduling] resolveVetScheduling:", {
    dateText,
    timeText,
    dateKey,
    hour,
  });

  if (!dateKey || hour === null || Number.isNaN(hour)) {
    console.log("[scheduling] Fecha u hora no parseable → seguir flujo normal");
    return null;
  }

  if (!isBusinessDay(dateKey)) {
    console.log("[scheduling] CASO 3: día no hábil", dateKey);
    return {
      reply:
        "Ese día no tenemos atención 😔\n¿Deseas otro horario?",
      step: awaitingStepConstant,
    };
  }

  if (!isWithinBusinessHours(SERVICE_TYPES.VET, hour)) {
    console.log("[scheduling] Hora fuera de horario vet:", hour);
    return {
      reply:
        "Ese horario está fuera de nuestro horario de consultas (11am a 5pm) 😊\n¿Qué otra hora te viene bien?",
      step: awaitingStepConstant,
    };
  }

  const booked = vetBookedHours(appointments, dateKey);
  const occupied = booked.has(Number(hour));

  if (!occupied) {
    const dayLabel = formatRelativeDayLabel(dateKey, referenceDate);
    const timeLabel = formatHourAmPm(hour);
    console.log("[scheduling] CASO 1: slot vet libre", { dateKey, hour });
    return {
      reply: `¡Perfecto! 😊 Tenemos disponibilidad ${dayLabel} a las ${timeLabel}. ¿Confirmamos la cita?`,
      step: confirmationStepConstant,
      sessionPatch: {
        scheduling_date_key: dateKey,
        scheduling_hour: hour,
      },
    };
  }

  const alternatives = suggestVetAlternativeSlots(hour, appointments, dateKey);
  console.log("[scheduling] CASO 2: vet ocupado, alternativas:", alternatives);

  if (alternatives.length === 0) {
    return {
      reply:
        "No tenemos disponibilidad a esa hora 😔\n¿Te sirve otro día u horario?",
      step: awaitingStepConstant,
    };
  }

  const bullets = alternatives
    .map((h) => `• ${formatHourAmPm(h)}`)
    .join("\n");

  return {
    reply: `No tenemos disponibilidad a esa hora 😔\n\nTenemos disponibles:\n${bullets}\n\n¿Alguno te sirve? 😊`,
    step: awaitingStepConstant,
  };
};

/**
 * Próximo turno grooming + mensaje CASO 4.
 */
const resolveGroomingNextSlotMessage = ({
  mockAppointments: appointments,
  referenceDate = new Date(),
  awaitingConfirmationStep,
  awaitingDateTimeFallbackStep,
}) => {
  const slot = getNextAvailableGroomingSlot(appointments, {
    referenceDate,
  });

  if (!slot) {
    console.log("[scheduling] Grooming: sin slot disponible en ventana");
    return {
      reply:
        "Ahora mismo no encontramos un turno de grooming libre 😔\n¿Te parece si te contactamos en un momento?",
      step: awaitingDateTimeFallbackStep,
    };
  }

  const dayLabel = formatRelativeDayLabel(slot.date, referenceDate);
  const timeLabel = formatHourAmPm(slot.hour);
  console.log("[scheduling] CASO 4: grooming próximo slot", slot);

  return {
    reply: `El siguiente turno disponible para grooming es:\n${dayLabel} a las ${timeLabel} 🛁`,
    step: awaitingConfirmationStep,
    sessionPatch: {
      scheduling_date_key: slot.date,
      scheduling_hour: slot.hour,
      date: dayLabel,
      time: timeLabel,
    },
  };
};

module.exports = {
  getMockAppointments,
  pushMockAppointment,
  detectHumanEscalation,
  resolveVetScheduling,
  resolveGroomingNextSlotMessage,
  parseDateToKey,
  parseTimeToHour,
  formatHourAmPm,
  formatRelativeDayLabel,
};
