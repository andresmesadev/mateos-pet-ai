# Cierre del Entregable 6.2 — Agenda Multi-Establecimiento

**Fecha:** 2026-07-28
**Fase:** Fase 6 — Operación Multi-Establecimiento Real (segundo entregable del roadmap interno: 6.1 → 6.6)
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.17.0`.
**Naturaleza del entregable:** primera Reconciliación Arquitectónica puntual real de la Fase 6 — el patrón de wrapper aditivo usado en 4.3/6.1 no era suficiente aquí.

---

## Objetivo del entregable

Que una reserva por WhatsApp respete el horario de atención real configurado por cada establecimiento (`Tenant.businessHours`), en vez del horario fijo hardcodeado global (11am-5pm vet, 11am-4pm grooming) — sin tocar zona horaria (deliberadamente diferida, backlog) y sin modificar ninguna regla de negocio ni el algoritmo de disponibilidad.

## Auditoría (Macroetapa 1) — hallazgo central

`isBusinessDay`/`isWithinBusinessHours` (`availability.service.js`) no tenían ningún parámetro `tenantId`; sus dos únicos consumidores de producción vivían dentro de archivos protegidos desde 3.4 (`scheduling.service.js`, y — como se descubrió durante la implementación — `availability-db.service.js`). A diferencia de 4.3 (donde el wrapper de `business-config.service.js` evitó tocar el motor porque sus consumidores vivían fuera de él), aquí no existía ninguna vía de inyección externa: se aceptó una **Reconciliación Arquitectónica puntual y mínima**, acotada exclusivamente a reemplazar el origen de la configuración (constantes fijas → `Tenant.businessHours`), preservando el algoritmo exacto.

## Ampliaciones del alcance descubiertas durante la Macroetapa 2 (3 checkpoints, todos reportados y autorizados antes de escribir el código correspondiente)

1. **`whatsapp.service.js` y `conversation.service.js`** — el diseño congelado asumía que `tenantId` ya fluía hasta `scheduling.service.js`; no era así. Se amplió el transporte (sin cambiar máquina de estados ni I/O) para llevar `tenantId` (ya disponible en `user`) desde el punto de entrada real hasta los resolvers.
2. **`availability-db.service.js`** — segundo consumidor real de la misma regla, con 8 puntos de uso y constantes propias duplicadas para generar sugerencias de horario. Se amplió la Reconciliación para que validación y sugerencias usen exactamente la misma fuente — de lo contrario el sistema podría sugerir un horario que la propia validación luego rechazara.
3. **`appointment.service.js` (`checkAppointmentConflict`) y su llamador en `whatsapp.service.js`** — detectado por grep exhaustivo ya en la Macroetapa 3 (validación), no en la auditoría inicial: el guard de conflicto en el paso de **confirmación final** de la reserva era el único consumidor real de `isSlotAvailable` que no transportaba `tenantId` — un bypass real, no solo una brecha. Se cerró con el mismo mecanismo y criterio de las dos ampliaciones anteriores.

En los tres casos: mismo criterio, sin excepción — transporte de un identificador ya disponible, cero cambio de algoritmo, cero regla de negocio nueva, cero nueva consulta estructural.

## Resumen de implementación

- **`business-config.service.js`** — nuevo `getBusinessHours(tenantId)`, mismo patrón de 4.3, `null` si no hay tenant o configuración.
- **`availability.service.js`** — `isBusinessDay(date, businessHours)` / `isWithinBusinessHours(serviceType, hour, dateKey, businessHours)` reciben configuración opcional; nuevo `resolveHourWindow` (fuente única de la ventana horaria efectiva, reutilizado también por `availability-db.service.js`). Sin configuración, comportamiento idéntico al legado — invariante verificado por 20 tests de regresión escritos **antes** del cambio.
- **`availability-db.service.js`** — `isSlotAvailable`, `suggestAvailableVetSlots`, `findNextAvailableGroomingSlot` reciben `tenantId`; constantes de horario duplicadas eliminadas en favor de `resolveHourWindow`; nueva función interna `isSlotAvailableWithConfig` evita refetch redundante de configuración dentro de los bucles de búsqueda.
- **`scheduling.service.js`** — `resolveVetScheduling`/`resolveGroomingScheduling` reciben `tenantId`, leen la configuración una vez y la propagan a los 4 guards y a los 3 llamados a `availabilityDb`.
- **`conversation.service.js` / `whatsapp.service.js`** — transporte puro de `tenantId` (ya disponible en `user`) hasta los resolvers y hasta `checkAppointmentConflict`.
- **`appointment.service.js`** — `checkAppointmentConflict` recibe y propaga `tenantId` a `isSlotAvailable`, cerrando el bypass de la confirmación final.
- **`tenant.routes.js`** — validación de `businessHours` endurecida (claves de día válidas, formato `HH:mm`, `active` booleano obligatorio) ahora que el campo es vinculante, no decorativo.

## 1. Validación Técnica

- **Suite completa:** **80/80 suites · 495/495 tests** en verde (3 archivos de test nuevos, 32 tests nuevos: `availability.service.test.js` (20), `availability-db.service.test.js` (9), `check-appointment-conflict.test.js` (3)).
- La cobertura de regresión para `availability.service.js`/`availability-db.service.js` se escribió **antes** de tocar su código, capturando el comportamiento legado exacto como baseline (exigido por la Macroetapa 1, dado que esta capa no tenía ninguna prueba previa).
- `prisma generate` ejecutado sin errores. `git diff --stat -- prisma/` vacío — **sin cambios de schema, sin migraciones nuevas**.

## 2. Validación Funcional (grep exhaustivo)

- **Único punto de configuración:** `getBusinessHours` definido una sola vez (`business-config.service.js`), consumido por `availability-db.service.js` (3 puntos) y `scheduling.service.js` (2 puntos) — ningún otro punto de lectura de `Tenant.businessHours` existe.
- **`isSlotAvailable` tiene exactamente 3 llamadores reales en producción**, los tres transportando `tenantId`: `appointment.service.js` (confirmación final), y dos en `scheduling.service.js` (vet, grooming).
- **`checkAppointmentConflict` tiene exactamente 1 llamador real** (`whatsapp.service.js`), transportando `tenantId`.
- **Sin bypass remanente:** grep exhaustivo de todo consumidor de `availability-db.service.js` confirma que los 4 exports que dependen de horario (`isSlotAvailable`, `suggestAvailableVetSlots`, `findNextAvailableGroomingSlot`, y transitivamente `checkAppointmentConflict`) reciben `tenantId` en sus únicos puntos de invocación real.
- **`resolveHourWindow` es la única fuente de la ventana horaria efectiva**, reutilizada por `availability.service.js` (definición) y `availability-db.service.js` (3 usos) — ninguna constante de horario duplicada permanece fuera de `availability.service.js`.

## 3. Validación de Invariantes

- **Sin configuración de establecimiento, el comportamiento es exactamente el legado:** verificado explícitamente por los 20 tests de `availability.service.test.js` (baseline capturado antes del cambio) y reconfirmado después de la implementación — ningún test de comportamiento legado cambió su resultado esperado.
- **Un festivo colombiano cierra siempre**, incluso si el establecimiento configuró ese día como activo — no es configurable por diseño (verificado por test).
- **Un fallo leyendo `Tenant.businessHours` nunca rompe la verificación de disponibilidad** — cae al comportamiento legado, con logging explícito (verificado por test en los 3 puntos: `isSlotAvailable`, `suggestAvailableVetSlots`, `findNextAvailableGroomingSlot`).
- **Validación y sugerencias de horario usan la misma fuente de verdad** — verificado por test explícito (`suggestAvailableVetSlots` nunca sugiere una hora fuera del horario configurado del establecimiento).

## 4. Validación Arquitectónica

- **Principio Permanente de la Fase 6:** respetado — la Reconciliación Arquitectónica fue puntual, mínima, documentada explícitamente en cada archivo tocado, y limitada a transporte de un identificador + sustitución de fuente de configuración. Ninguna regla de negocio nueva, ningún cambio de algoritmo.
- **Sin cambios en contextos de negocio** (`backend/src/contexts`) — `git diff --stat` vacío.
- **Zona horaria permanece explícitamente fuera de alcance** (backlog, sin fecha) — `lib/timezone.js`, `reminder.job.js`, `reminder.service.js`, `google-calendar.service.js` sin ningún cambio, verificado por `git diff --stat`.
- **Tres Reconciliaciones Arquitectónicas puntuales, todas dentro del mismo criterio aprobado** — ninguna requirió detener el entregable ni reabrir el diseño funcional; todas fueron ampliaciones de superficie de transporte de un identificador ya existente, reportadas y autorizadas explícitamente antes de implementarse.

## Hallazgos encontrados durante la Macroetapa 3

Uno: el bypass de `checkAppointmentConflict` (ver "Ampliaciones del alcance", punto 3) — encontrado por grep exhaustivo, reportado antes de declarar la validación completa, corregido, y revalidado con la suite completa en verde.

## Estado final

El flujo completo de reserva por WhatsApp — ofrecimiento inicial y confirmación final — respeta ahora `Tenant.businessHours` como única fuente de verdad, con el comportamiento legado preservado exactamente para cualquier establecimiento sin configuración propia. Zona horaria queda como backlog explícito, sin fecha, hasta que exista un establecimiento real fuera de Bogotá.

## Versionado

Versión declarada del proyecto actualizada de `2.16.0` a `2.17.0` (nueva capacidad funcional: horario de atención real por establecimiento, antes inerte, aplicado a todo el flujo de reserva por WhatsApp) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido (Macroetapas 1-3)

- ✅ Horario de atención real por establecimiento aplicado en la validación de disponibilidad y en las sugerencias de horario, en todo el recorrido real de la reserva (oferta + confirmación).
- ✅ Zona horaria permanece explícitamente fuera de alcance, sin ambigüedad.
- ✅ Reconciliación Arquitectónica puntual, documentada, sin cambio de algoritmo ni de regla de negocio.
- ✅ Cobertura de regresión construida antes del cambio (invariante de "sin configuración, comportamiento legado" verificado explícitamente).
- ✅ Sin bypass remanente — verificado por grep exhaustivo tras el cierre del hallazgo de la Macroetapa 3.
- ✅ Sin cambios de schema, migraciones, ni en contextos de negocio.
- ✅ Suite completa en verde (80/80 · 495/495).
- ✅ Macroetapa 4 (git add/commit/push/tag, bump de versión a `2.17.0`) completada — ver commit y tag correspondientes.
