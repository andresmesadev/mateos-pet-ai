# Cierre del Entregable 6.4 — Finanzas por Establecimiento (alcance reducido; "Consolidadas" remitido a 6.6)

**Fecha:** 2026-07-28
**Fase:** Fase 6 — Operación Multi-Establecimiento Real (cuarto entregable del roadmap interno: 6.1 → 6.6)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.19.0`.
**Naturaleza del entregable:** verificación + endurecimiento incidental — no introducción de capacidad nueva. Alcance reducido respecto al título original del roadmap: "Consolidadas" fue removida y remitida explícitamente al Entregable 6.6.

---

## Objetivo del entregable (redefinido en la Macroetapa 1)

El objetivo original del roadmap ("Finanzas por Establecimiento y Consolidadas") se auditó contra la evidencia real antes de diseñar cualquier implementación. La auditoría encontró que:
1. El contexto Finanzas **ya** cumplía el aislamiento por establecimiento — a diferencia de Staff (6.3), Finanzas pasó por su propio saneamiento durante el Entregable Puente (Fase 2, ADR 007/008/009), antes de que existiera el concepto de "Fase 6".
2. "Consolidadas" no tenía ningún esqueleto en ningún lado (ni modelo, ni caso de uso, ni ruta, ni mención en `domain-model-v1.md`), y **`PLAN_MAESTRO.md` ya asigna esa responsabilidad explícitamente al Entregable 6.6** ("Operación Centralizada... visibilidad... de todos los establecimientos").

**Decisión adoptada:** "Consolidadas" queda oficialmente fuera del alcance de 6.4, remitida a 6.6. El alcance definitivo de 6.4 se redujo a: verificar formalmente el aislamiento ya existente, cerrar la única inconsistencia real encontrada, y completar la cobertura de tests faltante.

## Checkpoint de contradicción (previo a la Macroetapa 2)

Confirmado el patrón exacto ya existente en `settle-system-charge.usecase.js`/`void-manual-sale.usecase.js` (`!x || (tenantId && x.tenantId !== tenantId)`) como plantilla única a replicar en el tercer hermano del módulo `pos/`. Sin contradicciones.

## Resumen de implementación

- **`guard-manual-sale-link.usecase.js`** — única inconsistencia real encontrada: el `systemCharge` recuperado ahora se verifica contra `tenantId` con el mismo criterio que sus 2 hermanos del módulo `pos/` (`settle-system-charge`, `void-manual-sale`), tratando un cobro de otro establecimiento igual que si no existiera.
- **`fakes.js`** (contexto Finanzas) — extendido con los métodos de `Transaction` que faltaban en el fake (`findById`, `findActiveByAppointment`, `settle`, `void`) y un nuevo fake de `completedAppointmentsReader`, necesarios para testear los 3 casos de uso del POS.
- **3 archivos de test nuevos** (`pos/guard-manual-sale-link.usecase.test.js`, `pos/settle-system-charge.usecase.test.js`, `pos/void-manual-sale.usecase.test.js`) — cierran la brecha de cobertura identificada en la Macroetapa 1 (única brecha de test encontrada en todo el contexto), incluyendo el caso cross-tenant en cada uno.
- **`puente-money-paths.test.js`** (test preexistente) — ajuste de un fixture (`tenantId` agregado al mock de `prisma.transaction.findFirst`) para reflejar un dato realista, roto por el nuevo chequeo de `guard-manual-sale-link` — no es un cambio de comportamiento esperado del test, es una corrección del fixture.
- **Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.**

## 1. Validación Técnica

- **Suite completa:** **84/84 suites · 526/526 tests** en verde (+18 tests nuevos respecto al cierre de 6.3).
- `git diff --stat -- prisma/` vacío — **sin cambios de schema, sin migraciones**.
- `git diff --stat -- backend/src/contexts` confirma que **únicamente el contexto `finance` fue modificado** (más el ajuste de un fixture en un test de integración preexistente, fuera de `contexts/` pero necesario por el mismo cambio).

## 2. Validación Funcional (grep exhaustivo)

- **Los 3 casos de uso del POS usan ahora el mismo patrón de verificación**, confirmado por grep: `guard-manual-sale-link` (`systemCharge`), `settle-system-charge` (`charge`), `void-manual-sale` (`transaction`) — los tres con la expresión `(tenantId && x.tenantId !== tenantId)`.
- **Sin inconsistencias equivalentes remanentes:** grep exhaustivo de todo `findById`/`findActiveByAppointment`/`findByDate` en el contexto Finanzas confirma que los únicos dos puntos con `findById` sin scoping a nivel de query (`void-expense.usecase.js`, y los 3 del POS) ya verifican propiedad tras la recuperación; todos los `findByDate` (generate-daily-close, get-daily-close, register-expense, void-expense, void-manual-sale) ya pasan `tenantId` directamente como parámetro de la consulta — forma más estricta, no un hueco.
- **Sin implementación parcial de "Consolidadas":** grep de "consolidad" en todo el contexto Finanzas y en `backend/` (fuera de tests) — cero resultados.

## 3. Validación de Invariantes

- **Comportamiento uniforme frente a registros de otro establecimiento:** los 3 casos de uso del POS responden de forma equivalente (tratan el registro de otro tenant igual que si no existiera) — verificado por test dedicado en cada uno.
- **Sin bypass remanentes:** confirmado por el grep exhaustivo de la sección 2.
- **Sin regresión respecto al comportamiento existente:** la suite completa permanece en verde; el único ajuste necesario fue un fixture de test que no reflejaba un dato realista (`tenantId` ausente en un mock), no una regresión de comportamiento real.

## 4. Validación Arquitectónica

- **Sin Reconciliación Arquitectónica** — confirmado nuevamente: el cambio completo vive dentro de `contexts/finance`.
- **Alcance reducido de 6.4 respetado íntegramente:** ninguna funcionalidad de reporting consolidado, consultas cross-tenant intencionales, ni capacidades de operación centralizada fue construida — verificado por el grep de "consolidad" y por `git diff --stat`.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación de la Macroetapa 2 coincidió exactamente con el diseño congelado en la Macroetapa 1.

## Estado final

El contexto Finanzas queda verificado y documentado como ya-aislado por establecimiento desde su propio saneamiento en el Entregable Puente (Fase 2), con su única inconsistencia real cerrada y su brecha de cobertura de tests completada. "Consolidadas" queda formalmente fuera de su alcance, como responsabilidad exclusiva y ya declarada del Entregable 6.6.

## Versionado

Versión declarada del proyecto actualizada de `2.18.0` a `2.19.0` — mismo criterio aplicado a 4.1 (`v2.9.0`) y 6.3 (`v2.18.0`): el cierre de una inconsistencia real de autorización cross-tenant es un cambio de comportamiento de seguridad, independientemente de su tamaño (aquí, un único caso de uso). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (Macroetapas 1-3)

- ✅ Verificación formal de que Finanzas ya cumple el aislamiento por establecimiento.
- ✅ Única inconsistencia real encontrada (`guard-manual-sale-link`) cerrada, mismo patrón que sus hermanos.
- ✅ Cobertura de tests completada para los 3 casos de uso del POS.
- ✅ "Consolidadas" removida del alcance, remitida explícitamente a 6.6 — sin implementación parcial.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Ningún otro contexto afectado — verificado por `git diff --stat`.
- ✅ Suite completa en verde (84/84 · 526/526).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión a `2.19.0`) completada — ver commit y tag correspondientes.
