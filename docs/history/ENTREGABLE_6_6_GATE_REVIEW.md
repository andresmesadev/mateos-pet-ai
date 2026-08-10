# Gate Review consolidado — Entregable 6.6 (Operación Centralizada, Fase B)

**Fase:** Fase 6 — Operación Multi-Establecimiento Real
**Estado:** ✅ Fase B completa — Macroetapas 1-4 completas. Cierre oficial realizado (v2.21.0). Fase A pendiente de autorización separada.

---

## 1. Diseño congelado (Macroetapa 1)

- **Hallazgo central:** "Operación Centralizada" no tenía ninguna implementación ni especificación funcional. Lo que sí existía era una vista cross-tenant **accidental**: el patrón `tenantId ? {...} : {}`, presente en 13 repositorios de 6+ contextos, otorga datos de todos los tenants a cualquier superadmin sin `tenantId`, sin control de acceso explícito.
- **Checkpoint de contradicción resuelto por el responsable del proyecto:** enfoque "B luego A" — cerrar primero el riesgo de seguridad (Fase B), formalizar después la capacidad deliberada (Fase A).
- **Alcance de Fase B:** cerrar el hueco en todos los contextos identificados, sin priorización parcial (decisión explícita).

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

El diseño asumía sanear 13 repositorios individualmente. El código real de `resolveTenant.js` reveló un único choke point compartido por todos los contextos (`app.js:70`, aplicado globalmente a `/api/dashboard`). Reportado y aprobado: cerrar ahí, logrando el mismo resultado de seguridad sin tocar cada repositorio.

## 3. Implementación (Macroetapa 2) — bloques

1. `resolveTenant.js` — nuevo header `X-View-All-Tenants`, exigido explícitamente para superadmin sin `tenantId`; nuevo campo `req.tenant.viewAllTenants`; logging de cada concesión.
2. `proxy/dashboard/[...path]/route.ts` — nuevo parámetro `?viewAllTenants=1`, solo honrado para superadmin sin tenant seleccionado.
3. `resolveTenant.test.js` — 2 tests actualizados (cambio de comportamiento intencional), 2 nuevos, 3 actualizados por el nuevo campo.
4. Los 13 repositorios con el patrón original permanecen sin cambios — el hueco se cierra por ausencia de acceso, no por modificación de cada uno.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **88/88 suites · 553/553 tests**.
- `git diff --stat -- prisma/` vacío; archivos protegidos del motor conversacional sin diff; solo 3 archivos totales modificados.
- Grep exhaustivo confirma el choke point único y la ausencia de cambios en los 13 repositorios.
- Invariantes: usuario normal nunca accede al flag; superadmin impersonando sin cambios; superadmin sin impersonar y sin flag ahora rechazado (nuevo, intencional); con flag, resultado idéntico al de antes pero deliberado y auditado.
- Principio Permanente de la Fase 6: respetado sin excepción — sin Reconciliación Arquitectónica, sin cambios de schema, sin contextos de negocio tocados.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.21.0` (mismo criterio que 4.1, 6.3, 6.4 y 6.5), tag y push realizados bajo autorización explícita del responsable del proyecto. Pendiente decisión separada sobre si/cuándo se inicia la Macroetapa 1 de la Fase A (endpoint de listado de tenants).
