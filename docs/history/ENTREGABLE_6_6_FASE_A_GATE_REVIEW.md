# Gate Review consolidado — Entregable 6.6 (Operación Centralizada, Fase A)

**Fase:** Fase 6 — Operación Multi-Establecimiento Real
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.22.0). Roadmap interno de la Fase 6 (6.1 → 6.6) completo.

---

## 1. Diseño congelado (Macroetapa 1)

- "Operación Centralizada" no tenía especificación funcional propia — solo una frase de roadmap (`PLAN_MAESTRO.md:448`). El mecanismo `req.tenant.viewAllTenants`, cerrado en la Fase B (`v2.21.0`), no tenía ningún consumidor real — verificado por grep exhaustivo antes de diseñar.
- Alcance congelado: `GET /api/dashboard/tenants/overview`, solo lectura, agregado por tenant, gateado exclusivamente por `viewAllTenants === true`; página administrativa mínima separada de cualquier mecanismo general de impersonación.
- Confirmado explícitamente que las métricas financieras (`revenueTotal`/`expenseTotal`/`netTotal`) son calculables con el modelo actual sin schema nuevo, usando `Transaction`/`Expense` — nunca `DailyClose` (depende de que el tenant haya cerrado el día) ni `Commission` (payroll, fuera de alcance).

## 2. Checkpoint de contradicción (durante Macroetapa 2)

El diseño asumía el patrón sancionado en `CLAUDE.md` para Server Components. El hook `.claude/hooks/block-apiurl.sh` lo bloqueó — más estricto que la regla escrita, sin distinguir Server de Client Components. Reportado y resuelto por decisión explícita: la página consume el endpoint a través del propio proxy Next.js (`proxyUrl` + `?viewAllTenants=1`, cookie de sesión reenviada), sin modificar el hook.

## 3. Implementación (Macroetapa 2)

1. `backend/src/routes/dashboard/tenant.routes.js` — `GET /tenants/overview`, gate único `req.tenant.viewAllTenants`, agregación vía `groupBy` sobre `User`/`Appointment`/`Conversation`/`Transaction`/`Expense`.
2. `frontend/app/dashboard/admin/tenants-overview/page.tsx` — página nueva, gate `session.user.isSuperAdmin`, consumo vía proxy.
3. `backend/src/__tests__/integration/tenants-overview-wiring.test.js` — 7 tests nuevos (autorización, aislamiento, agregación).
4. Sin cambios en `resolveTenant.js`, en el proxy de dashboard, en `Commission`, en `DailyClose`, en Fase 5, ni en el motor conversacional.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **89/89 suites · 560/560 tests** (antes 88/88 · 553 — cero regresiones).
- `git diff --stat -- prisma/` vacío.
- Grep exhaustivo confirma un único punto de gate (`tenant.routes.js`), sin bypass, y un único productor/consumidor del endpoint.
- Invariantes: usuario normal → 403; superadmin impersonando → 403; superadmin sin tenant con `viewAllTenants` → 200; respuesta sin campos de registro individual; tenant sin actividad incluido con ceros; `netTotal = revenueTotal - expenseTotal` verificado; `Transaction.status === "active"` verificado en el `where` del `groupBy`.
- Principio Permanente de la Fase 6: respetado — sin Reconciliación Arquitectónica, sin cambios de schema, sin reapertura de la Fase B, sin contextos de negocio ni Fase 5 tocados.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.22.0` (mismo criterio de cambio funcional relevante aplicado en toda la Fase 6), tag y push realizados bajo autorización explícita del responsable del proyecto. Con este cierre, el roadmap interno completo de la Fase 6 (6.1 → 6.6) queda completo.
