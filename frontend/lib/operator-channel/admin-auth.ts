import { createHash, timingSafeEqual } from "node:crypto";

export function canonicalAdminEmail(email: string) { return email.trim().normalize("NFC").toLowerCase(); }
export function verifyAdminCredential(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword || canonicalAdminEmail(email) !== canonicalAdminEmail(expectedEmail)) return null;
  const hash = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(hash(password), hash(expectedPassword)) ? expectedEmail : null;
}
