const prisma = require("../lib/prisma");

const VALID_TYPES = new Set(["allergy", "vaccine", "consultation", "note", "deworming", "grooming"]);

const normalizeType = (type) => String(type || "").trim().toLowerCase();

const normalizeTitle = (title) => String(title || "").trim();

const normalizeDetail = (detail) => {
  const value = String(detail ?? "").trim();
  return value || null;
};

const normalizeDate = (date) => {
  if (date == null || date === "") {
    return null;
  }

  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }

  return parsed;
};

const createRecord = async (petId, type, title, detail, date, clinical = {}) => {
  const pet = String(petId || "").trim();
  const recordType = normalizeType(type);
  const recordTitle = normalizeTitle(title);

  if (!pet) {
    throw new Error("petId is required");
  }

  if (!VALID_TYPES.has(recordType)) {
    throw new Error(
      "type must be one of: allergy, vaccine, consultation, note, deworming, grooming"
    );
  }

  if (!recordTitle) {
    throw new Error("title is required");
  }

  const {
    reason = null, findings = null, diagnosis = null,
    treatment = null, recommendations = null,
    weight = null, nextControlAt = null, staffId = null,
  } = clinical;

  try {
    const record = await prisma.medicalRecord.create({
      data: {
        petId: pet,
        type: recordType,
        title: recordTitle,
        detail: normalizeDetail(detail),
        date: normalizeDate(date),
        reason: reason ? String(reason).trim() : null,
        findings: findings ? String(findings).trim() : null,
        diagnosis: diagnosis ? String(diagnosis).trim() : null,
        treatment: treatment ? String(treatment).trim() : null,
        recommendations: recommendations ? String(recommendations).trim() : null,
        weight: weight != null ? Number(weight) : null,
        nextControlAt: normalizeDate(nextControlAt),
        staffId: staffId || null,
      },
    });

    console.log("[MedicalRecordService] Record created:", record.id);
    return record;
  } catch (error) {
    console.error("[MedicalRecordService] createRecord error:", error.message);
    throw error;
  }
};

const getRecordsByPet = async (petId) => {
  const pet = String(petId || "").trim();

  if (!pet) {
    throw new Error("petId is required");
  }

  try {
    return await prisma.medicalRecord.findMany({
      where: { petId: pet },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error(
      "[MedicalRecordService] getRecordsByPet error:",
      error.message
    );
    throw error;
  }
};

const getRecordsByType = async (petId, type) => {
  const pet = String(petId || "").trim();
  const recordType = normalizeType(type);

  if (!pet) {
    throw new Error("petId is required");
  }

  if (!VALID_TYPES.has(recordType)) {
    throw new Error(
      "type must be one of: allergy, vaccine, consultation, note"
    );
  }

  try {
    return await prisma.medicalRecord.findMany({
      where: {
        petId: pet,
        type: recordType,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  } catch (error) {
    console.error(
      "[MedicalRecordService] getRecordsByType error:",
      error.message
    );
    throw error;
  }
};

const TYPE_SECTIONS = [
  {
    type: "allergy",
    emoji: "🤧",
    label: "Alergias",
    empty: "Sin alergias registradas.",
  },
  {
    type: "vaccine",
    emoji: "💉",
    label: "Vacunas",
    empty: "Sin vacunas registradas.",
  },
  {
    type: "consultation",
    emoji: "🩺",
    label: "Consultas",
    empty: "Sin consultas registradas.",
  },
  {
    type: "note",
    emoji: "📝",
    label: "Notas",
    empty: "Sin notas registradas.",
  },
];

const formatRecordDate = (date) => {
  if (!date) {
    return null;
  }

  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = parsed.getUTCFullYear();

  return `${day}/${month}/${year}`;
};

const formatRecordLine = (record) => {
  const dateLabel = formatRecordDate(record.date);
  return dateLabel ? `• ${record.title} — ${dateLabel}` : `• ${record.title}`;
};

/**
 * @param {Array} records
 * @param {{ filterType?: string|null }} [options]
 * @returns {string}
 */
const formatRecordsForWhatsApp = (records, options = {}) => {
  const grouped = new Map();

  for (const record of records || []) {
    const type = normalizeType(record.type);

    if (!VALID_TYPES.has(type)) {
      continue;
    }

    if (!grouped.has(type)) {
      grouped.set(type, []);
    }

    grouped.get(type).push(record);
  }

  const filterType = options.filterType
    ? normalizeType(options.filterType)
    : null;
  const sections = filterType
    ? TYPE_SECTIONS.filter((section) => section.type === filterType)
    : TYPE_SECTIONS;

  return sections
    .map((section) => {
      const items = grouped.get(section.type) || [];
      const lines = [`${section.emoji} ${section.label}:`];

      if (items.length) {
        lines.push(...items.map(formatRecordLine));
      } else {
        lines.push(section.empty);
      }

      return lines.join("\n");
    })
    .join("\n");
};

const recordExists = async (petId, type, title) => {
  const pet = String(petId || "").trim();
  const recordType = normalizeType(type);
  const recordTitle = normalizeTitle(title);

  if (!pet || !recordType || !recordTitle) {
    return false;
  }

  try {
    const existing = await prisma.medicalRecord.findFirst({
      where: {
        petId: pet,
        type: recordType,
        title: {
          equals: recordTitle,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    return Boolean(existing);
  } catch (error) {
    console.error("[MedicalRecordService] recordExists error:", error.message);
    throw error;
  }
};

module.exports = {
  createRecord,
  getRecordsByPet,
  getRecordsByType,
  formatRecordsForWhatsApp,
  recordExists,
};
