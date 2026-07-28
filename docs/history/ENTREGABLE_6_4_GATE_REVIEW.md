# Gate Review consolidado — Entregable 6.4 (Finanzas por Establecimiento; "Consolidadas" remitida a 6.6)

**Fase:** Fase 6 — Operación Multi-Establecimiento Real
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.19.0).

---

## 1. Diseño congelado (Macroetapa 1)

- **Hallazgo central:** Finanzas ya cumplía el aislamiento por establecimiento (saneado en el Entregable Puente, Fase 2, ADR 007/008/009) — sin hueco equivalente al de Staff (6.3).
- **Contradicción de alcance detectada y resuelta:** "Consolidadas" (parte del nombre original del entregable) no tenía ningún esqueleto en el código ni en el modelo de dominio, y `PLAN_MAESTRO.md` ya la asigna explícitamente a 6.6. **Decisión adoptada: "Consolidadas" queda oficialmente fuera de 6.4**, remitida a 6.6.
- **Alcance definitivo:** verificar el aislamiento existente, cerrar la única inconsistencia real (`guard-manual-sale-link`), completar la cobertura de tests del POS.

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

Confirmado el patrón exacto a replicar (`settle-system-charge`/`void-manual-sale`: `!x || (tenantId && x.tenantId !== tenantId)`) — sin contradicciones, implementación autorizada a proceder sin Reconciliación Arquitectónica.

## 3. Implementación (Macroetapa 2) — bloques

1. `guard-manual-sale-link.usecase.js` — mismo patrón de verificación de tenant que sus 2 hermanos del módulo `pos/`.
2. `fakes.js` (finance) — extendido con métodos faltantes para poder testear el POS.
3. 3 archivos de test nuevos para `pos/guard-manual-sale-link`, `pos/settle-system-charge`, `pos/void-manual-sale` — brecha de cobertura cerrada.
4. Ajuste de un fixture en `puente-money-paths.test.js` (test preexistente), sin cambio de comportamiento esperado.

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **84/84 suites · 526/526 tests**.
- `git diff --stat -- prisma/` vacío; `git diff --stat -- backend/src/contexts` confirma que solo `finance` fue tocado.
- Grep exhaustivo: los 3 casos de uso del POS usan el mismo patrón; ningún otro `findById`/`findActiveByAppointment` sin verificación posterior o sin scoping de query; cero rastro de "Consolidadas" en el código.
- Invariantes: comportamiento uniforme frente a registros de otro establecimiento en los 3 casos de uso; sin bypass remanentes; sin regresión (el único ajuste fue un fixture de test no realista).
- Principio Permanente de la Fase 6: respetado sin excepción — sin Reconciliación Arquitectónica, alcance reducido respetado íntegramente.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.19.0` (mismo criterio que 4.1 y 6.3), tag y push realizados bajo autorización explícita del responsable del proyecto.
