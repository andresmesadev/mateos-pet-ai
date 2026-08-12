const crypto = require("crypto");

/**
 * Identidad de Cliente (Ecosistema, Portal del Cliente). Mismo criterio que
 * apiKeyHash.js: nunca se persiste el código ni el token en texto plano,
 * solo su hash SHA-256 determinístico.
 */
function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function generateVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { hashSecret, generateVerificationCode, generateSessionToken };
