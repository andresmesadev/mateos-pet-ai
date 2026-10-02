const prisma = require("../lib/prisma");
const { serviceModule, moduleAllowsAppointment } = require("../services/dashboard-access.service");

// Resource checks supplement the route permission matrix. All identities come
// from resolveTenant, never from request body or cached frontend claims.
async function dashboardOperationScope(req, res, next) {
  try {
    const access = req.access;
    if (!access) return next();
    const appointmentPath = req.path.match(/^\/appointments\/([^/]+)(?:\/(complete|agreed-price|medical-record))?$/);
    if (appointmentPath && ["POST", "PUT", "PATCH"].includes(req.method)) {
      const row = await prisma.appointment.findFirst({
        where: { id: appointmentPath[1], tenantId: req.tenant.tenantId },
        include: { service: { select: { category: { select: { name: true } } } } },
      });
      if (!row) return res.status(404).json({ error: "Cita no encontrada" });
      if (!moduleAllowsAppointment(access, row)) return res.status(403).json({ error: "El módulo de esta cita no está habilitado." });
      const module = serviceModule(row);
      if (["vet", "groomer"].includes(access.role)) {
        if (module !== (access.role === "vet" ? "veterinary" : "grooming")) return res.status(403).json({ error: "Esta cita pertenece a otra área." });
        if (row.staffId && row.staffId !== req.actor.staffId) return res.status(403).json({ error: "La atención está asignada a otro profesional." });
        if (appointmentPath[2] === "complete" && row.staffId !== req.actor.staffId) return res.status(403).json({ error: "Inicia tu atención antes de finalizarla." });
        if (req.body?.completedAt !== undefined) return res.status(403).json({ error: "La fecha de cierre se registra automáticamente." });
      }
    }
    if (/^\/pets\/[^/]+\/records(?:\/[^/]+)?$/.test(req.path) && req.method !== "GET" && !access.capabilities.clinical) {
      return res.status(403).json({ error: "Veterinaria no está habilitada para tu cuenta." });
    }
    return next();
  } catch (error) {
    console.error("[Access] Resource check failed:", error.message);
    return res.status(503).json({ error: "No se pudieron comprobar los permisos de esta operación." });
  }
}
module.exports = { dashboardOperationScope };
