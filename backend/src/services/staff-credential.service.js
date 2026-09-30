const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const deriveKey = promisify(scrypt);

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

async function hashPassword(password) {
  if (!validPassword(password)) throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const [algorithm, salt, digest] = stored.split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(digest ?? "")) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = await deriveKey(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

module.exports = { normalizeEmail, validPassword, hashPassword, verifyPassword };
