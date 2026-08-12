/**
 * requireScope — Catálogo de Recursos de la API pública v1. Debe montarse
 * después de apiKeyAuth (requiere req.apiKey.scopes ya resuelto). Rechaza
 * con 403 si la key autenticada no tiene el scope exacto requerido por el
 * recurso — sin herencia ni comodines en esta versión.
 */
function requireScope(scope) {
  return function (req, res, next) {
    const scopes = req.apiKey?.scopes ?? [];
    if (!scopes.includes(scope)) {
      return res.status(403).json({ error: `Scope requerido: ${scope}` });
    }
    return next();
  };
}

module.exports = { requireScope };
