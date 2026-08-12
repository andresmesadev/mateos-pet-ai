# Gate Review consolidado — Catálogo de Recursos de la API pública v1

**Bloque:** Ecosistema (post-Fase 6)
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.25.0).

---

## 1. Diseño congelado (Macroetapa 1)

- Auditoría de candidatos: solo `list-available-services` y `resolve-staff-availability` tienen aislamiento por `tenantId` verificado y limpio en el código real.
- Checkpoint de contradicción resuelto: `resolve-service-price` tiene un bypass real (`petId`/`clientId` sin scoping por tenant en `PrismaTargetExistenceReader`) — excluido del catálogo v1, documentado como deuda separada.
- "Crear cita" bloqueado por el motor conversacional protegido — sin caso de uso de dominio propio, excluido.

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

Ninguno nuevo — los dos casos de uso elegidos estaban exportados pero sin consumidor real, confirmando que su reutilización no afecta a nadie más.

## 3. Implementación (Macroetapa 2)

`GET /api/public/services` (`read:services`) y `POST /api/public/availability` (`read:availability`), montados bajo `/api/public` con `publicApiRateLimit → apiKeyAuth → publicApiRoutes`. `tenantId` exclusivamente de `req.apiKey.tenantId`. Respuesta pública mapeada a una forma mínima, sin campos internos.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **95/95 suites · 602/602 tests** (antes 93/93 · 587 — cero regresiones).
- Autenticación, scopes, aislamiento cross-tenant, validación de entrada y forma exacta de la respuesta pública — todos verificados por test, con comparación exacta de objetos (no parcial) para las respuestas.
- Rate limiting confirmado aplicado antes de `apiKeyAuth` — protege también el lookup de `ApiKey` contra flood.
- Grep exhaustivo confirma: mount único de `apiKeyAuth`, `requireScope` correctamente asignado sin intercambio, `resolve-service-price` ausente del router público.
- `git diff --stat -- prisma/` vacío; motor conversacional y todos los demás contextos de negocio sin diff.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.25.0` (primer catálogo real de recursos públicos, capacidad nueva observable externamente), tag y push realizados bajo autorización explícita del responsable del proyecto.
