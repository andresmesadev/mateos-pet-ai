const CLINICAL_PATHS = [
  ["GET", /^\/tenant\/profile$/],
  ["GET", /^\/appointments\/week$/],
  ["GET", /^\/appointments\/consultations\/search$/],
  ["GET", /^\/appointments\/[^/]+\/medical-record$/],
  ["PUT", /^\/appointments\/[^/]+\/medical-record$/],
  ["PATCH", /^\/appointments\/[^/]+$/],
  ["POST", /^\/appointments\/[^/]+\/complete$/],
  ["GET", /^\/pets\/[^/]+\/records$/],
  ["GET", /^\/pets\/[^/]+\/records\/[^/]+\/revisions$/],
  ["GET", /^\/pets\/[^/]+$/],
  ["GET", /^\/pets\/[^/]+\/next-actions$/],
  ["POST", /^\/pets\/[^/]+\/next-actions$/],
  ["PATCH", /^\/next-actions\/[^/]+$/],
  ["GET", /^\/staff$/],
];

function allowVeterinaryDashboard(req, res, next) {
  if (req.actor?.type !== "vet") return next();
  if (!CLINICAL_PATHS.some(([method, pattern]) => method === req.method && pattern.test(req.path))) {
    return res.status(403).json({ error: "Esta acción requiere acceso administrativo" });
  }
  if (req.method === "PATCH" && /^\/appointments\/[^/]+$/.test(req.path)) {
    const keys = Object.keys(req.body ?? {});
    if (keys.length !== 1 || keys[0] !== "status" || !["arrived", "in_progress"].includes(req.body.status)) {
      return res.status(403).json({ error: "El profesional solo puede avanzar el estado de atención" });
    }
  }
  return next();
}

module.exports = { allowVeterinaryDashboard };
