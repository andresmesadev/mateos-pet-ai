// Domain service: automatic medical information capture from free text.
// Channel-agnostic — the caller decides WHEN to invoke; this service decides WHAT to do.
// Any channel (WhatsApp, Portal del Cliente, email) can use this without modification.

const { detectMedicalInfo } = require("../medical-detection.service");
const { findPetByNameAndOwner } = require("../pet.service");
const {
  createRecord,
  recordExists,
} = require("../medical-record.service");
const { isMissing } = require("./intent-detector.service");

const buildMedicalSaveConfirmation = (petName, extracted) => {
  const name = String(petName || "tu mascota").trim();
  const title = String(extracted.title || "").trim();
  if (extracted.type === "allergy") {
    const phrase = title.toLowerCase().startsWith("alergia")
      ? title.toLowerCase()
      : `alergia ${title.toLowerCase()}`;
    return `Anotado ✅ Guardé que ${name} tiene ${phrase}.`;
  }
  return `Anotado ✅ Guardé en el historial de ${name}: ${title}.`;
};

/**
 * Detects medical information in a user message and saves it to the pet's record.
 * Returns a confirmation string if saved, or null if nothing was saved.
 *
 * The caller is responsible for guarding against inappropriate invocation contexts
 * (e.g., active booking wizard steps, history query intents).
 *
 * @param {{ userId: string, petName: string, userMessage: string }} params
 * @returns {Promise<string | null>}
 */
async function trySaveMedicalInfo({ userId, petName, userMessage }) {
  if (!userId || isMissing(petName) || isMissing(userMessage)) return null;

  try {
    const extracted = await detectMedicalInfo(userMessage);
    if (!extracted) return null;

    const pet = await findPetByNameAndOwner(petName, userId);
    if (!pet?.id) return null;

    const duplicate = await recordExists(pet.id, extracted.type, extracted.title);
    if (duplicate) return null;

    await createRecord(pet.id, extracted.type, extracted.title, extracted.detail, extracted.date);
    return buildMedicalSaveConfirmation(pet.name, extracted);
  } catch (error) {
    console.error("[MedicalAutoCapture] trySaveMedicalInfo error:", error.message);
    return null;
  }
}

module.exports = { trySaveMedicalInfo };
