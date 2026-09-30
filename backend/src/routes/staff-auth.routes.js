const express = require("express");
const prisma = require("../lib/prisma");
const { normalizeEmail, verifyPassword } = require("../services/staff-credential.service");

const router = express.Router();

// Solo el servidor Next.js puede llamar esta ruta (X-Internal-Token).
router.post("/staff-login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== "string") return res.status(401).json({ error: "Credenciales incorrectas" });

  try {
    const credential = await prisma.staffCredential.findUnique({
      where: { email },
      include: { staff: { include: { tenant: { select: { active: true } } } } },
    });
    if (!credential || !credential.active || !credential.staff.active || credential.staff.role !== "vet" || !credential.staff.tenantId || credential.staff.tenant?.active === false) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    if (!(await verifyPassword(password, credential.passwordHash))) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    return res.json({
      staffId: credential.staffId,
      tenantId: credential.staff.tenantId,
      email: credential.email,
      name: credential.staff.name,
      role: "vet",
      sessionVersion: credential.sessionVersion,
    });
  } catch (error) {
    console.error("[StaffAuth] Login error:", error);
    return res.status(503).json({ error: "No se pudo verificar el acceso" });
  }
});

module.exports = router;
