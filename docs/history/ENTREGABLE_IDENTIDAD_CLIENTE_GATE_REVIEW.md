# Gate Review consolidado — Identidad de Cliente (Portal del Cliente)

**Bloque:** Ecosistema (post-Fase 6)
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.26.0).

---

## 1. Diseño congelado (Macroetapa 1)

- Precondición real: ninguna capacidad de reserva/gestión de citas es segura sin identidad de cliente. `ApiKey` solo identifica app/tenant.
- Login por teléfono + código de un solo uso, entregado exclusivamente por WhatsApp (`send-message.usecase.js`, reutilizado sin cambios).
- Segunda capa de credencial, mismo patrón de hash que `ApiKey`, sin JWT.
- Dos modelos nuevos aditivos: `ClientVerificationCode`, `ClientSession`.

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

Ninguno — estado del código verificado limpio e idéntico al auditado.

## 3. Implementación (Macroetapa 2)

`clientAuthCrypto.js`, `client-auth.service.js`, `clientAuth.js` (middleware, sin montar), `clientAuthRequestCodeRateLimit`, y las rutas `POST /auth/request-code`/`verify-code` dentro del router de API pública ya protegido por `apiKeyAuth`.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **98/98 suites · 627/627 tests** (antes 95/95 · 602 — cero regresiones).
- Verificado exhaustivamente: aislamiento por tenant y por cliente, anti-enumeración, expiración de código y de sesión, consumo único, límite de intentos, hashing en ambos flujos, resolución de sesión, y ausencia de bypass en cualquier camino de error.
- `clientAuth` confirmado sin montar en ningún recurso — alcance respetado estrictamente.
- Motor conversacional, `ApiKey` y autenticación de staff sin cambios.
- Migración aplicada y verificada en la base de datos productiva.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.26.0` (capacidad nueva de identidad de cliente), tag y push realizados bajo autorización explícita del responsable del proyecto.
