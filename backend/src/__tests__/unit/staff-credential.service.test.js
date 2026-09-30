const { hashPassword, verifyPassword, normalizeEmail } = require("../../services/staff-credential.service");

test("stores a salted password hash and accepts only the matching password", async () => {
  const password = "una-clave-segura-de-prueba";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  expect(first).not.toContain(password);
  expect(first).not.toBe(second);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword("clave-incorrecta", first)).toBe(false);
  expect(await verifyPassword(password, "invalid-format")).toBe(false);
});

test("normalizes email and requires a long password", async () => {
  expect(normalizeEmail("  VET@Ejemplo.CO ")).toBe("vet@ejemplo.co");
  await expect(hashPassword("corta")).rejects.toThrow(/12/);
});
