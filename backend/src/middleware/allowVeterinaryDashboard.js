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

const COMMUNICATION_PATHS = [
  ["GET", /^\/conversations$/],
  ["GET", /^\/conversations\/[^/]+\/(messages|context)$/],
  ["POST", /^\/conversations\/[^/]+\/send$/],
  ["PATCH", /^\/conversations\/[^/]+\/control$/],
  ["PATCH", /^\/escalations\/[^/]+\/resolve$/],
];
const RECEPTION_PATHS = [
  ["GET", /^\/tenant\/profile$/],
  ["GET", /^\/clients$/],
  ["GET", /^\/clients\/[^/]+$/],
  ["GET", /^\/services$/],
  ["GET", /^\/appointments\/available-slots$/],
  ["POST", /^\/appointments$/],
];

function allowVeterinaryDashboard(req, res, next) {
  const role = req.actor?.type;
  if (!role || role === "admin") return next();
  const paths = [...COMMUNICATION_PATHS,
    ...(role === "vet" ? CLINICAL_PATHS : []),
    ...(role === "receptionist" ? RECEPTION_PATHS : []),
    ...(role === "groomer" ? [["GET", /^\/tenant\/profile$/], ["GET", /^\/grooming\/pets\/[^/]+\/notes$/]] : []),
  ];
  if (!paths.some(([method, pattern]) => method === req.method && pattern.test(req.path))) {
    return res.status(403).json({ error: "Esta acción requiere acceso administrativo" });
  }
  if (role === "vet" && req.method === "PATCH" && /^\/appointments\/[^/]+$/.test(req.path)) {
    const keys = Object.keys(req.body ?? {});
    if (keys.length !== 1 || keys[0] !== "status" || !["arrived", "in_progress"].includes(req.body.status)) {
      return res.status(403).json({ error: "El profesional solo puede avanzar el estado de atención" });
    }
  }
  return next();
}

module.exports = { allowVeterinaryDashboard };
