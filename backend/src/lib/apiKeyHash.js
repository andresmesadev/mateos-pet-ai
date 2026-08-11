const crypto = require("crypto");

/**
 * API pública, Fase 1 (Ecosistema). La API key nunca se persiste en texto
 * plano — solo su hash (SHA-256, determinístico: permite buscarla por
 * igualdad exacta en ApiKey.keyHash sin guardar la key original).
 */
function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(String(rawKey)).digest("hex");
}

module.exports = { hashApiKey };
