# Cierre del Entregable 6.6 — Operación Centralizada (Fase B: saneamiento de la vista cross-tenant accidental)

**Fecha:** 2026-08-10
**Fase:** Fase 6 — Operación Multi-Establecimiento Real (sexto y último entregable del roadmap interno: 6.1 → 6.6)
**Estado:** ✅ Fase B completada — Macroetapas 1-4 completas. Versión oficial: `2.21.0`. Fase A (endpoint de listado de tenants) pendiente de autorización separada — ver "Alcance restante" al final.
**Naturaleza del entregable:** saneamiento de un hueco de seguridad real y transversal — no introducción de capacidad nueva.

---

## Objetivo del entregable (redefinido en la Macroetapa 1)

El roadmap definía 6.6 únicamente como "Operación Centralizada... visibilidad del equipo interno sobre el estado operativo de todos los establecimientos", sin especificación funcional alguna. La auditoría de la Macroetapa 1 encontró que **esa visibilidad ya existía hoy, de forma accidental**: el patrón `tenantId ? {...} : {}`, replicado en 13 repositorios a través de 6+ contextos (Finanzas, Staff, Automatizaciones, Empleados Digitales, Comunicación, Eventos), otorga una vista cross-tenant sin filtro a cualquier request de un superadmin que no especifique `tenantId` — sin control de acceso explícito, sin auditoría, sin que ningún documento del proyecto la hubiera autorizado como capacidad de producto.

**Decisión adoptada (checkpoint resuelto explícitamente por el responsable del proyecto):** enfoque **"B luego A"** — primero cerrar el hueco de seguridad (Fase B, este cierre), y solo después formalizar la vista consolidada como capacidad administrativa deliberada (Fase A, pendiente).

## Checkpoint de contradicción (previo a Macroetapa 2)

El diseño congelado en Macroetapa 1 asumía sanear los 13 repositorios individualmente. Al revisar el código real de `resolveTenant.js` se encontró que **todos los contextos comparten un único punto de entrada**: `req.tenant` se resuelve una sola vez, antes de llegar a cualquier ruta. Reportado y aprobado por el responsable del proyecto: cerrar el hueco en ese choke point único, sin modificar los 13 repositorios — logra el mismo resultado de seguridad con una superficie de cambio mínima.

## Resumen de implementación

- **`backend/src/middleware/resolveTenant.js`** — nuevo header `X-View-All-Tenants`. Un superadmin sin `tenantId` ya no obtiene paso silencioso; debe declarar la intención explícitamente. Sin ese header, la request se rechaza con 403. `req.tenant` gana el campo `viewAllTenants: boolean`. Cada concesión de vista cross-tenant se registra vía el logger existente (auditoría mínima, sin nueva persistencia).
- **`frontend/app/api/proxy/dashboard/[...path]/route.ts`** — nuevo parámetro `?viewAllTenants=1`, solo honrado si `isSuperAdmin && !tenantId`; se traduce al header. Un usuario normal nunca puede activarlo.
- **`backend/src/__tests__/unit/resolveTenant.test.js`** — 2 tests preexistentes actualizados (el comportamiento cambió intencionalmente, de 200 implícito a 403), 2 tests nuevos cubren el flag explícito, 3 tests existentes actualizados para incluir el nuevo campo `viewAllTenants` en las aserciones.
- **Ninguno de los 13 repositorios con el patrón `tenantId ? {...} : {}` fue modificado** — confirmado por `git diff --stat`. El hueco queda cerrado porque la request ya no llega a ellos con `tenantId: null` salvo intención explícita del superadmin.
- **Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.**

## Efecto colateral esperado (documentado, no oculto)

Las páginas de Server Components del dashboard que usan `makeServerHeaders` (`app/dashboard/page.tsx` y análogas) no recibieron el parámetro `viewAllTenants` — construir esa UI queda explícitamente fuera de 6.6 por instrucción directa del responsable del proyecto. Consecuencia: un superadmin que navegue a esas páginas sin seleccionar tenant recibirá ahora 403, donde antes obtenía —accidentalmente— una vista agregada sin sentido de datos mezclados de todos los tenants. Este es exactamente el resultado que la Fase B buscaba: esa vista mezclada nunca fue una capacidad de producto deliberada.

## 1. Validación Técnica

- **Suite completa:** **88/88 suites · 553/553 tests** en verde (+2 tests respecto al cierre de 6.5).
- `git diff --stat -- prisma/` vacío — sin cambios de schema, sin migraciones.
- `git diff --stat` total: exactamente 3 archivos (middleware + su test + proxy Next.js).

## 2. Validación Funcional (grep exhaustivo)

- Confirmado (`app.js:70`): `resolveTenant` se aplica globalmente a `/api/dashboard` — único choke point real para todas las rutas de dashboard, en todos los contextos.
- Confirmado: el canal de WhatsApp (motor conversacional) usa un mecanismo de resolución de tenant completamente distinto (`contexts/receptionist/infrastructure/engine/resolve-tenant-id.js`), sin relación con `resolveTenant.js` — sin impacto, sin superadmin en ese canal.
- Los 13 repositorios con el patrón `tenantId ? {...} : {}` permanecen exactamente iguales — grep confirma cero cambios.

## 3. Validación de Invariantes

- Un usuario normal (no superadmin) nunca pudo ni puede activar `viewAllTenants` — el flag solo se evalúa cuando `isSuperAdmin === true`.
- Un superadmin impersonando un tenant específico (`X-Tenant-Id` presente) mantiene el comportamiento exacto de antes — sin cambios.
- Un superadmin sin impersonar y sin el flag explícito ahora es rechazado — comportamiento nuevo, intencional, verificado por test.
- Un superadmin sin impersonar y con el flag explícito obtiene exactamente el mismo resultado que antes (los repos no cambiaron) — pero ahora es una decisión deliberada y auditada, no un efecto colateral.

## 4. Validación Arquitectónica

- **Sin Reconciliación Arquitectónica** — el cambio vive en un middleware compartido y el proxy Next.js, ninguno de los dos es un archivo protegido del motor conversacional.
- **Motor conversacional sin cambios** — confirmado por `git diff --stat` sobre los 5 archivos protegidos.
- **Ningún contexto de negocio (Finanzas/Staff/Agenda/Automatizaciones/Empleados Digitales) modificado.**

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación de la Macroetapa 2 coincidió exactamente con el diseño del checkpoint aprobado.

## Alcance restante (Fase A, no incluida en este cierre)

La Fase A — formalizar la vista cross-tenant como capacidad administrativa real (endpoint de listado de tenants con resumen operativo, UI dedicada) — sigue pendiente. No tiene fecha ni Macroetapa 1 propia todavía; requiere autorización explícita separada del responsable del proyecto para iniciarse, siguiendo el mismo protocolo institucional.

## Criterio de cierre cumplido (Fase B, Macroetapas 1-3)

- ✅ Auditoría exhaustiva del estado real de "Operación Centralizada" — sin asumir trabajo por el nombre del entregable.
- ✅ Riesgo de seguridad real identificado y cuantificado (13 repos, 6+ contextos) antes de proponer cualquier diseño.
- ✅ Checkpoint de contradicción (choke point vs. repos individuales) reportado y resuelto antes de implementar.
- ✅ Hueco cerrado en el 100% de los contextos identificados, con superficie de cambio mínima (3 archivos).
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional y contextos de negocio sin cambios — verificado por `git diff --stat`.
- ✅ Suite completa en verde (88/88 · 553/553).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión a `2.21.0`) completada — ver commit y tag correspondientes.

## Versionado

Versión declarada del proyecto actualizada de `2.20.0` a `2.21.0` — mismo criterio aplicado a 4.1 (`v2.9.0`), 6.3 (`v2.18.0`), 6.4 (`v2.19.0`) y 6.5 (`v2.20.0`): el cierre de un hueco real de autorización cross-tenant es un cambio de comportamiento de seguridad, independientemente de la superficie de código afectada (aquí, 3 archivos que cierran el hueco en 13 repositorios de 6+ contextos). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.
