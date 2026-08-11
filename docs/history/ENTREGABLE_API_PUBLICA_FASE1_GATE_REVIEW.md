# Gate Review consolidado — API pública, Fase 1 (autenticación de terceros + cierre de A5)

**Bloque:** Ecosistema (post-Fase 6)
**Estado:** ✅ Código y schema cerrados (Macroetapas 1-4 completas, v2.24.0). ⚠️ No operativo hasta aplicar la migración pendiente contra la base de datos productiva.

---

## 1. Diseño congelado (Macroetapa 1)

- No existe autenticación de terceros ni autenticación humana por tenant (hallazgo nuevo, dashboard usa una única cuenta admin compartida). Decisión de alcance: construir solo `ApiKey` (mecanismo de máquina); la ausencia de login humano por tenant queda documentada y fuera de este entregable.
- Sin catálogo de recursos — solo el mecanismo de identidad.

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

El diseño dejaba abierto un fork sobre el cierre de A5. La evidencia (`frontend/app/api/proxy/billing/route.ts` ya enviaba `X-Internal-Token`, nunca validado por el backend) mostró que la intención original ya era esa. Resuelto: cerrar A5 con `requireInternalToken`, sin `ApiKey` para billing.

## 3. Implementación (Macroetapa 2)

1. `prisma/schema.prisma` — modelo `ApiKey` nuevo, aditivo.
2. `backend/src/lib/apiKeyHash.js` — hash SHA-256, sin texto plano persistido.
3. `backend/src/middleware/apiKeyAuth.js` — middleware de autenticación por key, no montado en ninguna ruta.
4. `backend/src/middleware/requireInternalToken.js` + `app.js` — gate en `/api/billing/*` (excepto webhook).

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **93/93 suites · 587/587 tests** (antes 90/90 · 568 — cero regresiones).
- `apiKeyAuth` confirmado sin montar en ninguna ruta — catálogo de recursos sigue fuera de alcance.
- `tenantId` de una API key verificado como exclusivo de `ApiKey.tenantId`, nunca de `body`/`params`/`query`.
- Solo `keyHash` se almacena/consulta — nunca la key en texto plano.
- Rechazo de keys inválidas/revocadas, actualización de `lastUsedAt` y auditoría por `logger` — verificados.
- Los 4 endpoints de `/api/billing/*` (excepto webhook, protegido por firma Stripe) exigen `X-Internal-Token` — verificado exhaustivamente.
- `/api/onboarding/*` confirmado sin cambios, sigue público por diseño.
- Motor conversacional y otros contextos de negocio sin cambios — confirmado por `git diff --stat`.
- **`npx prisma generate` exitoso; `npx prisma db push` no pudo ejecutarse (P1001, sin conectividad a Neon desde este entorno) — la migración real queda pendiente de ejecutarse en un entorno con acceso a la base de datos, antes de cualquier despliegue. No se da por aplicada.**

## 5. Decisión del Gate

**Aprobado y cerrado, con una condición operativa explícita.** Macroetapa 4 ejecutada: commit, bump de versión a `2.24.0`, tag y push realizados bajo autorización explícita del responsable del proyecto. Sin regla institucional que condicione el cierre a la aplicación de la migración — el código y el diseño quedan validados y cerrados; **la base de datos productiva no contiene necesariamente el modelo `ApiKey` todavía**, y el entregable no debe considerarse operativo para consumidores de API key hasta que `npx prisma db push` (o equivalente) se ejecute exitosamente desde un entorno con conectividad real a Neon. `apiKeyAuth` permanece sin montar en ninguna ruta, por lo que no hay riesgo de fallo en producción mientras esto no ocurra.
