# Cierre del Entregable 6.3 — Staff Multi-Establecimiento

**Fecha:** 2026-07-28
**Fase:** Fase 6 — Operación Multi-Establecimiento Real (tercer entregable del roadmap interno: 6.1 → 6.6)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.18.0`.
**Naturaleza del entregable:** saneamiento de aislamiento cross-tenant — mismo tipo de entregable que 4.1 (Saneamiento Tenant-Blind), no introducción de capacidad nueva.

---

## Objetivo del entregable

El modelo de datos de Staff ya soportaba multi-establecimiento desde su nacimiento (Entregable 2.2 — `tenantId` presente desde la primera migración). La auditoría de la Macroetapa 1 encontró que el aislamiento prometido tenía huecos de aplicación real: `PrismaStaffRepository.findById` sin filtro de tenant, usada por 9 de los 13 casos de uso del contexto sin verificar propiedad tras recuperar el registro, y 3 rutas HTTP (`PUT .../availability`, `POST .../absences`, `PUT .../capabilities`) sin ningún chequeo de tenant en absoluto. El objetivo de 6.3 fue cerrar esos huecos, replicando el patrón ya correcto y existente en `void-commission.usecase.js`.

## Checkpoint de contradicción (previo a la Macroetapa 2)

Verificado contra el código real antes de escribir cualquier línea: confirmado exactamente el mismo patrón de `void-commission.usecase.js` (`!x || (tenantId && x.tenantId !== tenantId)` → `throw new XNotFoundError`) como plantilla a replicar. Sin contradicciones — el diseño congelado en la Macroetapa 1 se implementó sin ampliaciones de alcance.

## Resumen de implementación

- **9 casos de uso** (`update-staff`, `deactivate-staff`, `reactivate-staff`, `manage-staff-capabilities`, `update-availability`, `record-unplanned-absence`, `generate-settlement`, `record-commission-on-appointment-completed`) reciben `tenantId` opcional y verifican propiedad tras `findById`, lanzando `StaffNotFoundError` — mismo patrón exacto de `void-commission`, sin revelar la existencia del registro de otro establecimiento.
- **`resolve-staff-availability.usecase.js`** (lectura de lista, no entidad única, sin ningún llamador real en producción hoy) recibe `tenantId` opcional y excluye (`continue`, no `throw`) al staff de otro establecimiento.
- **`staff.routes.js`** — las 3 rutas sin ningún chequeo ahora extraen `req.tenant` y propagan `tenantId`; `PATCH`/`DELETE /staff/:id` (que ya verificaban con un `findFirst` previo) ahora también pasan `tenantId` a los casos de uso subyacentes — protección en dos capas (ruta + caso de uso), sin cambiar el comportamiento funcional observable.
- **Ningún cambio de schema, migración, ni Reconciliación Arquitectónica.**

## 1. Validación Técnica

- **Suite completa:** **81/81 suites · 508/508 tests** en verde (15 tests nuevos: 10 en los casos de uso afectados, 3 de wiring de rutas, 2 adicionales en `resolve-staff-availability` — incluyendo el caso "sin `tenantId`, comportamiento legado preservado").
- `git diff --stat -- prisma/` vacío — **sin cambios de schema, sin migraciones**.
- `git diff --stat -- backend/src/contexts` confirma que **ningún contexto fuera de `staff` fue tocado**.

## 2. Validación Funcional (grep exhaustivo)

- **Grep de todo consumidor de `staffRepository.findById`/`commissionRepository.findById`/`settlementRepository.findActiveByStaffAndPeriod`** en `contexts/staff`: los 9 casos de uso identificados en la auditoría verifican propiedad de tenant tras la recuperación; `void-commission.usecase.js` ya lo hacía; `generate-settlement.usecase.js`'s `findActiveByStaffAndPeriod` corre después de que `staffId` ya fue verificado contra `tenantId` en la misma función — sin necesidad de un chequeo adicional directo.
- **Las 3 rutas antes desprotegidas** (`availability`, `absences`, `capabilities`) confirmadas propagando `tenantId` — verificado por test de wiring (`staff-tenant-wiring.test.js`) y por lectura directa del código.
- **Comportamiento legado preservado sin `tenantId`:** verificado explícitamente por test en `resolve-staff-availability.usecase.test.js` (sin `tenantId`, incluye staff de cualquier establecimiento — igual que antes del cambio) y por el hecho de que `tenantId && ...` nunca evalúa a `true` cuando `tenantId` es `undefined`, en los 10 puntos modificados.
- **Sin llamadas directas a `prisma.staff`/`prisma.commission`/`prisma.settlement` que bypaseen el chequeo:** las únicas llamadas directas restantes en `staff.routes.js` (líneas de disponibilidad legado JSON y `findUnique` posteriores en `PATCH /staff/:id`) ocurren **después** de que la ruta ya verificó `existing = findFirst({id, tenantId})` — sin bypass nuevo.

## 3. Validación de Invariantes

- **Ningún caso de uso revela la existencia de un registro de otro establecimiento:** los 9 casos de uso responden con `StaffNotFoundError` (404) idéntico al caso "no existe", tanto si el registro no existe como si pertenece a otro tenant — mismo patrón ya usado por `void-commission`/`CommissionNotFoundError`.
- **Mismo patrón de error en los 9 casos de uso:** confirmado por grep — todos usan `StaffNotFoundError` de forma consistente.
- **Sin bypass remanentes:** confirmado por grep exhaustivo de todos los consumidores de `findById` en el contexto Staff.

## 4. Validación Arquitectónica

- **Sin Reconciliación Arquitectónica** — confirmado nuevamente: todo el cambio vive dentro de `contexts/staff` y su ruta HTTP; cero contacto con el motor conversacional, Eventos, o Automatizaciones.
- **Ningún otro contexto fue afectado** — verificado por `git diff --stat -- backend/src/contexts`.
- Principio Permanente de la Fase 6 respetado: prioriza el aislamiento entre establecimientos, sin modificar ninguna regla de negocio.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación de la Macroetapa 2 coincidió exactamente con el diseño congelado en la Macroetapa 1.

## Estado final

El contexto Staff cierra su hueco de autorización cross-tenant en los 9 casos de uso y las 3 rutas identificadas, con protección en dos capas (ruta + caso de uso) — mismo criterio de severidad y resolución que el Entregable 4.1. `Staff.tenantId` permanece sin índice dedicado (deuda de rendimiento diferida, decisión explícita de la Macroetapa 1) y `DEFAULT_GENERATES_COMMISSION_BY_ROLE` permanece como mapeo global no configurable por establecimiento (backlog, sin necesidad evidenciada).

## Versionado

Versión declarada del proyecto actualizada de `2.17.0` a `2.18.0` — mismo criterio aplicado al Entregable 4.1 (Saneamiento Tenant-Blind, `v2.9.0`): un cierre de huecos de autorización cross-tenant es un cambio de comportamiento de seguridad real, aunque no introduzca una capacidad de negocio nueva. Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (Macroetapas 1-3)

- ✅ Hueco de autorización cross-tenant cerrado en los 9 casos de uso identificados y las 3 rutas HTTP sin chequeo.
- ✅ Protección en dos capas (ruta + caso de uso), sin cambiar comportamiento funcional observable.
- ✅ Comportamiento legado preservado exactamente cuando no se provee `tenantId`.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Ningún otro contexto afectado — verificado por `git diff --stat`.
- ✅ Suite completa en verde (81/81 · 508/508).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión a `2.18.0`) completada — ver commit y tag correspondientes.
