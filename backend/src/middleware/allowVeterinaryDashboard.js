const { getActiveModules } = require("../services/business-config.service");
const { effectiveAccess } = require("../services/dashboard-access.service");

const match = (req, rules) => rules.some(([method, regex]) => req.method === method && regex.test(req.path));
const CHAT = [
  ["GET", /^\/conversations$/], ["GET", /^\/conversations\/[^/]+\/(messages|context)$/],
  ["POST", /^\/conversations\/[^/]+\/send$/], ["PATCH", /^\/conversations\/[^/]+\/control$/],
  ["PATCH", /^\/escalations\/[^/]+\/resolve$/],
];
const CLINICAL = [
  ["GET", /^\/appointments\/consultations\/search$/],
  ["GET", /^\/appointments\/[^/]+\/medical-record$/], ["PUT", /^\/appointments\/[^/]+\/medical-record$/],
  ["GET", /^\/pets\/[^/]+\/(records|next-actions|timeline|report)$/],
  ["GET", /^\/pets\/[^/]+\/records\/[^/]+\/revisions$/],
  ["POST", /^\/pets\/[^/]+\/next-actions$/], ["PATCH", /^\/next-actions\/[^/]+$/],
];
const CASH = [
  ["GET", /^\/cash\/operational$/], ["GET", /^\/transactions(\/[^/]+)?$/],
  ["POST", /^\/transactions$/], ["POST", /^\/transactions\/[^/]+\/settle$/],
];
const CONTACT_READ = [["GET", /^\/clients(\/[^/]+)?$/], ["GET", /^\/pets(\/[^/]+)?$/], ["GET", /^\/services$/]];
const CONTACT_WRITE = [
  ["POST", /^\/clients(\/with-pets)?$/], ["PATCH", /^\/clients\/[^/]+$/],
  ["POST", /^\/pets$/], ["PATCH", /^\/pets\/[^/]+$/],
];
const AGENDA_READ = [["GET", /^\/appointments\/(today|upcoming|week|month)$/]];
const GROOMING = [
  ["GET", /^\/grooming\/appointments$/], ["GET", /^\/grooming\/pets\/[^/]+\/notes$/],
  ["PUT", /^\/grooming\/appointments\/[^/]+\/notes$/], ["POST", /^\/grooming\/appointments\/[^/]+\/delivery$/],
];

async function allowVeterinaryDashboard(req, res, next) {
  try {
    req.access = effectiveAccess(req.actor, await getActiveModules(req.tenant?.tenantId));
    const c = req.access.capabilities;
    const admin = c.administration;
    const deny = (message = "No tienes permiso para esta acción.") => res.status(403).json({ error: message });
    if (match(req, [["GET", /^\/(access|workspace|tenant\/profile)$/]])) return next();
    if (match(req, CHAT)) return c.chat ? next() : deny();
    if (match(req, CLINICAL)) {
      if (admin && req.method === "GET") return next(); // Archived history survives module deactivation.
      return c.clinical ? next() : deny("Veterinaria no está habilitada para tu cuenta.");
    }
    if (match(req, GROOMING)) {
      if (admin && req.method === "GET") return next();
      return c.grooming ? next() : deny("Peluquería no está habilitada para tu cuenta.");
    }
    if (match(req, CASH)) return c.cash ? next() : deny("Caja no está habilitada para tu cuenta.");
    if (match(req, [["GET", /^\/appointments\/available-slots$/], ["POST", /^\/appointments$/]])) return c.schedule ? next() : deny();
    if (admin) return next();
    if (match(req, CONTACT_READ)) return (c.contacts || c.cash || c.clinical || c.grooming) ? next() : deny();
    if (match(req, CONTACT_WRITE)) return c.contacts ? next() : deny();
    if (match(req, AGENDA_READ)) return c.agenda ? next() : deny();
    if (match(req, [["GET", /^\/staff$/]])) return c.agenda ? next() : deny();
    if (req.method === "PATCH" && /^\/appointments\/[^/]+$/.test(req.path)) {
      const keys = Object.keys(req.body ?? {});
      if (keys.length === 1 && keys[0] === "finalPrice") return c.appointmentPrice ? next() : deny("No tienes permiso para ajustar el precio.");
      if (req.access.role === "receptionist" && c.schedule) {
        if (keys.some(k => !["status", "staffId", "serviceId"].includes(k)) ||
            (req.body.status && !["confirmed", "arrived", "cancelled", "no_show"].includes(req.body.status))) return deny();
        return next();
      }
      if ((c.clinical || c.grooming) && keys.length === 1 && keys[0] === "status" &&
          ["arrived", "in_progress", ...(c.grooming ? ["confirmed"] : [])].includes(req.body.status)) return next();
      return deny("Solo puedes avanzar el estado de tu atención.");
    }
    if (req.method === "POST" && /^\/appointments\/[^/]+\/complete$/.test(req.path)) return (c.clinical || c.grooming) ? next() : deny();
    return deny("Esta acción requiere acceso administrativo.");
  } catch (error) {
    console.error("[Access] Configuration unavailable:", error.message);
    return res.status(503).json({ error: "No se pudieron comprobar tus permisos. Intenta de nuevo." });
  }
}
module.exports = { allowVeterinaryDashboard };
