const express = require("express");
const prisma = require("../lib/prisma");
const { normalizeEmail, verifyPassword } = require("../services/staff-credential.service");

const router = express.Router();

// Revalidación interna para adaptadores fuera del dashboard (facturación).
// El rol de una sesión antigua nunca concede un privilegio revocado en BD.
router.get("/staff-session", async (req, res) => {
  const staffId = req.headers["x-staff-id"];
  const rawVersion = req.headers["x-staff-session-version"];
  const tenantId = req.headers["x-tenant-id"];
  if (typeof staffId !== "string" || typeof tenantId !== "string" ||
      !/^\d+$/.test(String(rawVersion ?? ""))) return res.status(403).json({ error: "Sesión no válida" });
  try {
    const credential = await prisma.staffCredential.findFirst({
      where: { staffId, active: true, sessionVersion: Number(rawVersion), staff: { tenantId, active: true } },
      select: { staff: { select: { role: true } } },
    });
    if (!credential) return res.status(403).json({ error: "El acceso fue revocado" });
    return res.json({ role: credential.staff.role });
  } catch (error) {
    console.error("[StaffAuth] Session error:", error.message);
    return res.status(503).json({ error: "No se pudo verificar el acceso" });
  }
});

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
    if (!credential || !credential.active || !credential.staff.active || !["vet", "groomer", "receptionist", "admin"].includes(credential.staff.role) || !credential.staff.tenantId || credential.staff.tenant?.active === false) {
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
      role: credential.staff.role,
      sessionVersion: credential.sessionVersion,
    });
  } catch (error) {
    console.error("[StaffAuth] Login error:", error);
    return res.status(503).json({ error: "No se pudo verificar el acceso" });
  }
});

module.exports = router;
