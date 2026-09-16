// Entregable 8.1 (Fase 8), D-M1 — Reconciliación Arquitectónica: ADR 010
// (docs/decisions/010-reconciliacion-motor-conversacional-memoria.md).
//
// Antes de este entregable, el historial de `Message` se persistía pero
// nunca se enviaba al LLM: cada llamada a OpenAI llevaba exactamente
// `system` + mensaje actual. Este módulo arma el historial que sí se envía.
//
// Función pura, sin acceso a BD — el llamador (whatsapp.service.js) ya trae
// las filas de `Message` vía getConversationMessages(). Diseño (no código)
// inspirado en context_builder.py de Sancho Agent IA (ver informe externo
// citado en el ADR 010): recorrer el historial newest → oldest acumulando
// contra un presupuesto de caracteres, devolver en orden oldest → newest.
// Reescrito desde cero en JS, sin ninguna dependencia compartida con Sancho.

const MAX_HISTORY_CHARS = 6000;
const MAX_HISTORY_MESSAGES = 20;

/**
 * @param {Array<{role: string, content: string}>} messages Filas de
 *   `Message`, ya ordenadas oldest → newest (orden de getConversationMessages).
 *   El llamador es responsable de excluir el mensaje actual si ya fue
 *   persistido antes de construir el historial.
 * @param {{ maxChars?: number, maxMessages?: number }} [limits]
 * @returns {Array<{ role: "user"|"assistant", content: string }>} listo para
 *   anteponerse al mensaje actual en el array `messages` del SDK de OpenAI.
 */
const buildConversationHistory = (messages, limits = {}) => {
  const maxChars = Number.isFinite(limits.maxChars) ? limits.maxChars : MAX_HISTORY_CHARS;
  const maxMessages = Number.isFinite(limits.maxMessages) ? limits.maxMessages : MAX_HISTORY_MESSAGES;

  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const included = [];
  let charCount = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (included.length >= maxMessages) break;

    const row = messages[i];
    const content = typeof row?.content === "string" ? row.content.trim() : "";
    if (!content) continue;

    if (charCount + content.length > maxChars) break;

    const role = row.role === "assistant" ? "assistant" : "user";
    included.unshift({ role, content });
    charCount += content.length;
  }

  return included;
};

module.exports = {
  buildConversationHistory,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
};
