/**
 * Orquestación de agenda entre conversación y disponibilidad (PostgreSQL).
 * Logs con prefijo [scheduling].
 */

const {
  isBusinessDay,
  isWithinBusinessHours,
  toDateKey,
  addOneDay,
  SERVICE_TYPES,
} = require("./availability.service");

const {
  getZonedYearMonthDay,
  dateKeyFromParts,
  getDayOfWeekFromKey,
} = require("../lib/timezone");

const availabilityDb = require("./availability-db.service");

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

const formatRelativeDayLabel = (dateKey, referenceDate = new Date()) => {
  const today = toDateKey(referenceDate);
  if (dateKey === today) return "hoy";
  if (dateKey === addOneDay(today)) return "mañana";
  return dateKey;
};

/** JS getDay(): 0=domingo … 6=sábado */
const WEEKDAY_TO_JS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const MONTH_NAME_TO_INDEX = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const logParsedDate = (input, result) => {
  console.log("[scheduling] Parsed date:", {
    input: String(input),
    result,
  });
  return result;
};

const logFailedDate = (input) => {
  console.log(
    "[scheduling] Failed parsing date:",
    input == null ? input : String(input)
  );
  return null;
};

const localRefParts = (ref) => getZonedYearMonthDay(ref);

const keyFromLocalParts = (y, monthIndex, day) =>
  dateKeyFromParts(y, monthIndex, day);

const parseExplicitYear = (raw) => {
  if (raw == null || raw === "") {
    return null;
  }
  let y = parseInt(String(raw), 10);
  if (!Number.isFinite(y)) {
    return null;
  }
  if (y < 100) {
    y += 2000;
  }
  return y;
};

const bumpYearIfPast = (y, monthIndex, day, ref) => {
  const key = dateKeyFromParts(y, monthIndex, day);
  if (!key) {
    return y;
  }

  const refKey = toDateKey(ref);
  if (key < refKey) {
    return y + 1;
  }

  return y;
};

const nextWeekdayKey = (weekdayName, ref) => {
  const target = WEEKDAY_TO_JS[weekdayName];
  if (target === undefined) {
    return null;
  }

  const refKey = toDateKey(ref);
  if (!refKey) {
    return null;
  }

  const refDay = getDayOfWeekFromKey(refKey);
  let daysAhead = (target - refDay + 7) % 7;
  if (daysAhead === 0) {
    daysAhead = 7;
  }

  let cursor = refKey;
  for (let i = 0; i < daysAhead; i += 1) {
    cursor = addOneDay(cursor);
  }

  return cursor;
};

/**
 * Fechas en lenguaje natural (timezone America/Bogota).
 * @returns {string|null} YYYY-MM-DD
 */
const parseDateToKey = (dateText, referenceDate = new Date()) => {
  if (!dateText || typeof dateText !== "string") {
    return logFailedDate(dateText);
  }

  const trimmed = dateText.trim();
  if (!trimmed) {
    return logFailedDate(trimmed);
  }

  const ref = referenceDate instanceof Date ? referenceDate : new Date();
  const { y: refY, m: refM, d: refD } = localRefParts(ref);

  const iso = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    return logParsedDate(trimmed, iso[1]);
  }

  const n = normalizeText(trimmed);

  if (/\bhoy\b/.test(n)) {
    return logParsedDate(trimmed, toDateKey(ref));
  }

  if (/\bmanana\b/.test(n)) {
    return logParsedDate(
      trimmed,
      keyFromLocalParts(refY, refM, refD + 1)
    );
  }

  const weekdayMatch = n.match(
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/
  );
  if (weekdayMatch) {
    const key = nextWeekdayKey(weekdayMatch[1], ref);
    if (key) {
      return logParsedDate(trimmed, key);
    }
    return logFailedDate(trimmed);
  }

  const dayMonthWord = n.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{2,4}))?\b/
  );
  if (dayMonthWord) {
    const day = parseInt(dayMonthWord[1], 10);
    const monthIndex = MONTH_NAME_TO_INDEX[dayMonthWord[2]];
    let year = parseExplicitYear(dayMonthWord[3]) ?? refY;
    if (dayMonthWord[3] == null) {
      year = bumpYearIfPast(year, monthIndex, day, ref);
    }
    const key = keyFromLocalParts(year, monthIndex, day);
    if (key) {
      return logParsedDate(trimmed, key);
    }
    return logFailedDate(trimmed);
  }

  const slashMatch = n.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/
  );
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const monthIndex = parseInt(slashMatch[2], 10) - 1;
    let year = parseExplicitYear(slashMatch[3]) ?? refY;
    if (slashMatch[3] == null) {
      year = bumpYearIfPast(year, monthIndex, day, ref);
    }
    const key = keyFromLocalParts(year, monthIndex, day);
    if (key) {
      return logParsedDate(trimmed, key);
    }
    return logFailedDate(trimmed);
  }

  const dayOnlyMatch = n.match(/\b(?:el\s+)?(\d{1,2})\b/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1], 10);
    if (day >= 1 && day <= 31) {
      let monthIndex = refM;
      let year = refY;
      if (day < refD) {
        monthIndex += 1;
        if (monthIndex > 11) {
          monthIndex = 0;
          year += 1;
        }
      }
      const key = keyFromLocalParts(year, monthIndex, day);
      if (key) {
        return logParsedDate(trimmed, key);
      }
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const key = toDateKey(parsed);
    if (key) {
      return logParsedDate(trimmed, key);
    }
  }

  return logFailedDate(trimmed);
};

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
 * Disponibilidad veterinaria usando PostgreSQL.
 */
const resolveVetScheduling = async ({
  dateText,
  timeText,
  referenceDate = new Date(),
  awaitingStepConstant,
  confirmationStepConstant,
}) => {
  console.log("[Scheduling] Using DB availability");

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
      reply: "Ese día no tenemos atención 😔 ¿Qué otro día te queda bien?",
      step: awaitingStepConstant,
    };
  }

  if (!isWithinBusinessHours(SERVICE_TYPES.VET, hour)) {
    console.log("[scheduling] Hora fuera de horario vet:", hour);
    return {
      reply: "Ese horario está fuera de nuestra atención (11am a 5pm) 😊 ¿Qué otra hora te viene bien?",
      step: awaitingStepConstant,
    };
  }

  const available = await availabilityDb.isSlotAvailable({
    dateKey,
    hour,
    serviceType: SERVICE_TYPES.VET,
  });

  if (available) {
    const dayLabel = formatRelativeDayLabel(dateKey, referenceDate);
    const timeLabel = formatHourAmPm(hour);
    console.log("[Scheduling] Real slot found:", { dateKey, hour });
    return {
      reply: `Perfecto, ${dayLabel} a las ${timeLabel} está disponible ✅ ¿Confirmamos la cita?`,
      step: confirmationStepConstant,
      sessionPatch: {
        scheduling_date_key: dateKey,
        scheduling_hour: hour,
      },
    };
  }

  const { hours: alternatives } = await availabilityDb.suggestAvailableVetSlots({
    dateKey,
    requestedHour: hour,
    limit: 3,
  });

  console.log("[Scheduling] Real alternatives found:", alternatives);

  if (alternatives.length === 0) {
    return {
      reply: "Esa hora ya está ocupada 😔 ¿Te sirve otro día u horario?",
      step: awaitingStepConstant,
    };
  }

  const altList = alternatives.map((h) => formatHourAmPm(h)).join(", ");

  return {
    reply: `Esa hora ya está ocupada 😔 Tenemos disponible a las ${altList}. ¿Alguna te sirve?`,
    step: awaitingStepConstant,
  };
};

/**
 * Próximo turno grooming desde PostgreSQL.
 */
const resolveGroomingNextSlotMessage = async ({
  referenceDate = new Date(),
  awaitingConfirmationStep,
  awaitingDateTimeFallbackStep,
}) => {
  console.log("[Scheduling] Using DB availability");

  const slot = await availabilityDb.findNextAvailableGroomingSlot({
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
  console.log("[Scheduling] Real slot found:", slot);

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

const resolveGroomingScheduling = async ({
  dateText,
  timeText,
  referenceDate = new Date(),
  awaitingStepConstant,
  confirmationStepConstant,
}) => {
  console.log("[Scheduling] Using DB availability (grooming)");

  const dateKey = parseDateToKey(dateText, referenceDate);
  const hour = parseTimeToHour(timeText);

  if (!dateKey || hour === null || Number.isNaN(hour)) {
    return null;
  }

  if (!isBusinessDay(dateKey)) {
    return {
      reply:
        "Ese día no tenemos atención 😔\n¿Deseas otro horario?",
      step: awaitingStepConstant,
    };
  }

  if (!isWithinBusinessHours(SERVICE_TYPES.GROOMING, hour)) {
    return {
      reply:
        "Ese horario está fuera de nuestro horario de grooming (11am a 4pm) 😊\n¿Qué otra hora te viene bien?",
      step: awaitingStepConstant,
    };
  }

  const available = await availabilityDb.isSlotAvailable({
    dateKey,
    hour,
    serviceType: SERVICE_TYPES.GROOMING,
  });

  if (available) {
    const dayLabel = formatRelativeDayLabel(dateKey, referenceDate);
    const timeLabel = formatHourAmPm(hour);
    return {
      reply: `¡Perfecto! 😊 Tenemos disponibilidad ${dayLabel} a las ${timeLabel}. ¿Confirmamos la cita?`,
      step: confirmationStepConstant,
      sessionPatch: {
        scheduling_date_key: dateKey,
        scheduling_hour: hour,
      },
    };
  }

  return {
    reply:
      "No tenemos disponibilidad a esa hora 😔\n¿Te sirve otro día u horario?",
    step: awaitingStepConstant,
  };
};

module.exports = {
  detectHumanEscalation,
  resolveVetScheduling,
  resolveGroomingScheduling,
  resolveGroomingNextSlotMessage,
  parseDateToKey,
  parseTimeToHour,
  formatHourAmPm,
  formatRelativeDayLabel,
};
