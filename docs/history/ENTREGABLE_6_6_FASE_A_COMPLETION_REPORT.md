# Cierre del Entregable 6.6 — Operación Centralizada (Fase A: capacidad administrativa)

**Fecha:** 2026-08-11
**Fase:** Fase 6 — Operación Multi-Establecimiento Real (Fase A del sexto y último entregable del roadmap interno: 6.1 → 6.6)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.22.0`. Con este cierre, el roadmap interno completo de la Fase 6 (6.1 → 6.6) queda completo.
**Naturaleza del entregable:** formalización de una capacidad administrativa nueva, de solo lectura — consume el gate de seguridad ya cerrado en la Fase B (`v2.21.0`), sin reabrirlo.

---

## Objetivo del entregable

Formalizar la vista consolidada cross-establecimiento como una capacidad administrativa deliberada, siguiendo el enfoque "B luego A" decidido explícitamente al congelar el diseño de 6.6: primero se cerró el riesgo de seguridad de la vista accidental (Fase B, `v2.21.0`), y solo después se construye la capacidad real que hace uso legítimo de ese mecanismo.

## Diseño congelado (Macroetapa 1)

- Ningún dato del código o de `domain-model-v1.md` respaldaba "Operación Centralizada" más allá de la frase de roadmap en `PLAN_MAESTRO.md:448`. El mecanismo `req.tenant.viewAllTenants` (Fase B) existía pero **ningún consumidor lo invocaba** — confirmado por grep exhaustivo antes de diseñar.
- Alcance congelado: un único endpoint de solo lectura y agregación (`GET /api/dashboard/tenants/overview`), gateado exclusivamente por `req.tenant.viewAllTenants === true`, más una página administrativa mínima. Sin schema, sin `Commission`/payroll, sin `DailyClose` como fuente, sin selector de tenant/impersonación general.

## Checkpoint de contradicción (durante Macroetapa 2)

Al implementar la página Server Component con el patrón sancionado en `CLAUDE.md` para Server Components (el helper de URL directo al backend combinado con `makeServerHeaders`) — el mismo patrón usado hoy por todas las páginas Server Component del dashboard — el hook `.claude/hooks/block-apiurl.sh` la rechazó: bloquea cualquier `Write`/`Edit` cuyo contenido invoque ese helper, sin distinguir Server Component de Client Component, más estricto que la regla escrita en `CLAUDE.md`.

**Resolución (decisión explícita del responsable del proyecto):** mantener la página como Server Component, pero routearla a través del propio proxy Next.js (`proxyUrl()` + `?viewAllTenants=1`, reenviando la cookie de sesión vía `next/headers`) en vez de llamar al backend directo. El hook `block-apiurl.sh` no fue modificado. Esta es la única desviación entre el diseño originalmente congelado y la implementación real — reportada y resuelta antes de escribir la página.

## Resumen de implementación

- **`backend/src/routes/dashboard/tenant.routes.js`** — nueva ruta `GET /tenants/overview`. Gate único: `if (!req.tenant.viewAllTenants) return res.status(403)`. Lista `Tenant.findMany({ where: { active: true } })` y agrega, vía `groupBy(by: ["tenantId"])`, sobre `User`, `Appointment`, `Conversation` (conteos) y `Transaction`/`Expense` (sumas). `revenueTotal` usa exclusivamente `Transaction` con `status: "active"` (excluye anulaciones, mismo criterio que el resto del sistema desde ADR 009). `netTotal = revenueTotal - expenseTotal`, calculado en memoria. Un tenant activo sin ninguna fila en las tablas agregadas aparece en la respuesta con todos los conteos/sumas en cero (base de la lista es `Tenant`, no un `groupBy` de las tablas de actividad).
- **`frontend/app/dashboard/admin/tenants-overview/page.tsx`** — página nueva, Server Component. Gate: `if (!session?.user?.isSuperAdmin) notFound()`. Llama al endpoint a través de `proxyUrl` con `?viewAllTenants=1`, reenviando `Cookie` vía `(await cookies()).toString()`. Tabla de solo lectura: establecimiento, plan, usuarios, citas, conversaciones, ingresos, gastos, neto.
- **`backend/src/__tests__/integration/tenants-overview-wiring.test.js`** (nuevo, 7 tests) — autorización (usuario normal → 403; superadmin impersonando con `tenantId` → 403; superadmin con `viewAllTenants` → 200), aislamiento (respuesta nunca contiene campos de registro individual; verificado por comparación exacta de las claves del objeto de respuesta; un tenant sin actividad aparece con ceros, no ausente; solo se consultan tenants `active: true`), agregación (`Transaction`/`Expense` agregados correctamente por tenant, `status: "active"` aplicado en el `where` del `groupBy` de `Transaction`, `netTotal` calculado correctamente).
- **Sin cambios en `resolveTenant.js`, en el proxy de dashboard (ya soportaba `viewAllTenants=1` desde la Fase B), en `Commission`, en `DailyClose`, ni en ningún archivo de Fase 5 o del motor conversacional.**

## 1. Validación Técnica

- **Suite completa:** **89/89 suites · 560/560 tests** en verde (antes 88/88 · 553 al cierre de la Fase B — +1 suite, +7 tests, cero regresiones).
- `git diff --stat -- prisma/` vacío — sin cambios de schema, sin migraciones.
- `git diff --stat` total: 1 archivo modificado (`tenant.routes.js`, +81/-0) + 2 rutas nuevas (test backend, página frontend).
- `npx tsc --noEmit` en `frontend/` limpio para los archivos de este entregable (el único error preexistente, en `reactivation/page.tsx`, es ajeno y anterior a este trabajo).

## 2. Validación Funcional (grep exhaustivo)

- `grep -rn "viewAllTenants"` en `backend/src` y `frontend`: confirma que el único punto de verificación del gate en el backend es `tenant.routes.js:173` (`if (!req.tenant.viewAllTenants)`) — **sin ningún bypass ni ruta alternativa**. El resto de ocurrencias son la definición del campo en `resolveTenant.js` (Fase B, sin cambios) y su propagación en el proxy Next.js (Fase B, sin cambios) y en la nueva página.
- `grep -rn "tenants/overview\|tenants-overview"`: confirma que el único productor es la ruta nueva y el único consumidor es la página nueva (y los tests) — sin duplicación, sin acceso paralelo.
- Confirmado: ni `Commission` ni `DailyClose` aparecen en el diff — el diseño congelado sobre esas exclusiones se respetó literalmente.

## 3. Validación de Invariantes

- **Usuario normal** (`isSuperAdmin: false`) → 403, sin llegar a consultar `prisma.tenant.findMany` (verificado por `expect(prisma.tenant.findMany).not.toHaveBeenCalled()`).
- **Superadmin impersonando** (`tenantId` presente) → 403 — el endpoint es exclusivo de la vista no-impersonada, consistente con que `resolveTenant.js` fuerza `viewAllTenants: false` en cuanto hay `tenantId`.
- **Superadmin sin tenant, con `viewAllTenants: true`** → 200, con agregados correctos.
- **Aislamiento de datos:** la respuesta nunca contiene `id`/`phone`/`userId`/`appointmentId` ni ninguna fila individual — solo los 10 campos agregados por tenant, verificado exhaustivamente por comparación de claves en los tests.
- **Tenant sin actividad:** aparece en la lista con todos los conteos/sumas en cero — no desaparece silenciosamente.
- **`netTotal`:** verificado igual a `revenueTotal - expenseTotal` en los tests de agregación (100000 - 30000 = 70000).
- **`Transaction.status === "active"`:** verificado como parte explícita del `where` pasado a `prisma.transaction.groupBy`.

## 4. Validación Arquitectónica

- **Sin Reconciliación Arquitectónica** — cambios en una ruta de dashboard existente y una página nueva, ninguno de los dos es un archivo protegido del motor conversacional (confirmado: `git diff --stat` vacío sobre los 5 archivos protegidos).
- **Sin reapertura de la Fase B** — `resolveTenant.js` y el proxy de dashboard no fueron tocados; el entregable consume el mecanismo, no lo modifica.
- **Sin cambios en Fase 5** (Eventos/Automatizaciones) ni en ningún contexto de negocio.
- **`block-apiurl.sh` sin modificar** — la resolución del checkpoint fue adaptar la implementación (Server Component vía proxy), no la herramienta.

## Alcance restante

Ninguno. Con esta Fase A, el Entregable 6.6 y el roadmap interno completo de la Fase 6 (6.1 → 6.6) quedan completos.

## Versionado

Versión declarada del proyecto actualizada de `2.21.0` a `2.22.0`. A diferencia de 4.1/6.3/6.4/6.5/6.6-Fase-B (saneamientos de huecos de autorización), este entregable **introduce una capacidad administrativa nueva** — el mismo criterio de "cambio funcional relevante" (regla de `CLAUDE.md` sobre versionado) exige igualmente el bump. Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva de "Operación Centralizada" antes de asumir trabajo por el nombre del entregable.
- ✅ Checkpoint de contradicción (`block-apiurl.sh` vs. patrón sancionado en `CLAUDE.md`) reportado y resuelto antes de continuar la implementación.
- ✅ Capacidad implementada exactamente dentro del alcance de los 8 puntos autorizados, sin ampliación silenciosa.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Sin reapertura de la Fase B, sin cambios en Fase 5 ni en el motor conversacional.
- ✅ Suite completa en verde (89/89 · 560/560).
- ✅ Macroetapa 4 (versionado a `2.22.0`, commit, tag, push) completada — ver commit y tag correspondientes.
