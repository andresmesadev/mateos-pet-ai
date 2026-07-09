# Cierre del Entregable 4.3 — Configuración por Establecimiento

**Fecha de cierre:** 2026-07-09
**Fase:** Fase 4 — Plataforma Comercial (tercer entregable del roadmap interno)
**Estado:** ✅ Completado (Alcance A) — Alcance B diferido por Reconciliación Arquitectónica
**Proceso aplicado:** proceso de macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 → Gate Review → Implementación completa → Validación Técnica → Validación Funcional → Documentación y cierre)
**Gate Review previo:** `docs/history/ENTREGABLE_4_3_GATE_REVIEW.md`

---

## Objetivo del entregable

Que cada Establecimiento pueda configurar de forma persistente y consultable los parámetros operativos que hoy son hardcodeados o escritos-sin-efecto: módulos activos, tasa de split de comisión, horarios de atención y zona horaria.

## Reconciliación Arquitectónica — Alcance B (Horarios de Atención, Zona Horaria)

**No implementado, deliberadamente.** El checkpoint obligatorio de la Macroetapa 2 confirmó empíricamente lo anticipado en la auditoría: `isBusinessDay`/`isWithinBusinessHours` (`availability.service.js`) tienen como único consumidor de disponibilidad conversacional a `scheduling.service.js` — uno de los tres archivos del motor conversacional protegidos desde el Entregable 3.4 por el principio "no reescribir el motor conversacional existente". Aplicar horarios de atención y zona horaria reales por tenant dentro del flujo de reserva por WhatsApp exigiría modificar ese archivo, violando ese principio congelado.

Por decisión explícita, **este entregable no cruza esa línea**: la persistencia y aplicación real de horarios/zona-horaria en el flujo conversacional queda registrada como deuda diferida, en la misma categoría que el residuo de M4 dejado por el Entregable 4.1 (disponibilidad tenant-blind dentro del motor). No existe ninguna implementación parcial, ni de persistencia ni de aplicación, de este alcance — ni siquiera un campo de schema fue agregado para `timezone` u horarios adicionales a `businessHours` (que ya existía desde antes de este entregable y permanece igual de no-consultado que al inicio de la auditoría).

## Resumen de implementación (Alcance A)

- **`backend/src/services/business-config.service.js` (nuevo):** única fuente de verdad para `activeModules` y `commissionSplitRate` por tenant. Expone `getActiveModules`/`getCommissionSplitRate` (lectura, con default cuando no hay tenant o el tenant no tiene valores) y `updateActiveModules`/`updateCommissionSplitRate` (escritura, con validación: array de strings no vacías; tasa numérica entre 0 y 1).
- **`contexts/services/infrastructure/persistence/prisma-business-config.reader.js`** y **`contexts/staff/infrastructure/persistence/prisma-business-config.reader.js`**: ambos reescritos para delegar exclusivamente en `business-config.service.js`. Ningún puerto (`BusinessConfigReaderPort`) ni ningún caso de uso que los consume (`create-service`, `update-service`, `list-available-services`, `record-commission-on-appointment-completed`) cambió su contrato ni su firma.
- **`dashboard/tenant.routes.js`:** `GET /tenant/profile` extendido para incluir `activeModules`/`commissionSplitRate` en el perfil; nuevo `PUT /tenant/config` reutiliza la validación centralizada del servicio en vez de duplicarla.

## Cambios de esquema y migración

- Migración `20260709100000_configuracion_establecimiento`: `Tenant.activeModules TEXT[] DEFAULT ARRAY['grooming','veterinary']` y `Tenant.commissionSplitRate DECIMAL(4,3) NOT NULL DEFAULT 0.5`.
- `prisma migrate deploy` aplicada; `prisma migrate diff` posterior vacío; `prisma generate` regenerado y sincronizado.

## Validación Técnica

- `prisma migrate status` → 33 migraciones, base de datos al día, sin diferencias. `prisma migrate diff` → vacío. Sin inconsistencias entre schema y base.
- Suite completa: **70/70 suites · 419/419 tests** en verde (16 tests nuevos: 8 de `business-config.service.js`, 2 de delegación de cada `PrismaBusinessConfigReader`, 3 de wiring HTTP de `PUT /tenant/config`).
- **Grep exhaustivo confirma que `business-config.service.js` es la única fuente de verdad**: no existe ningún otro acceso directo de Prisma a `Tenant.activeModules`/`Tenant.commissionSplitRate` fuera de este servicio, los dos readers que delegan en él, y `tenant.routes.js` (que solo lee para el perfil y escribe exclusivamente a través de las funciones de actualización del servicio).
- **Grep exhaustivo confirma cero valores hardcodeados remanentes**: la única coincidencia de `"grooming", "veterinary"` fuera del servicio nuevo es un comentario descriptivo en el reader de Servicios, documentando qué se reemplazó — no código activo.
- **Grep exhaustivo confirma que ningún puerto ni caso de uso cambió su contrato**: `git diff --stat` vacío para ambos `business-config-reader.port.js`, para `create-service`/`update-service`/`list-available-services.usecase.js` (Servicios) y para `record-commission-on-appointment-completed`/`void-commission.usecase.js` (Staff).
- **Grep exhaustivo confirma cero cambios en el motor conversacional**: `git diff --stat` vacío para `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js` y `availability-db.service.js`.

## Validación Funcional

- **Módulos activos:** un tenant sin configuración explícita opera con el conjunto por defecto (`["grooming","veterinary"]`, preservando el comportamiento previo); un tenant con módulos configurados los usa realmente para gatear la creación/listado de servicios por categoría — verificado por test contra el servicio y contra el reader.
- **Tasa de split:** un tenant sin tasa configurada usa `0.5` (comportamiento idéntico al hardcodeado anterior); un tenant con tasa configurada la usa realmente al registrar una comisión — verificado por test.
- **`void-commission.usecase.js` (ADR 009) confirmado sin cambios**: por diseño, una corrección de comisión preserva la tasa histórica registrada en la comisión original, no consulta la configuración vigente — este caso de uso nunca invocó `businessConfigReader` y queda, correctamente, fuera del alcance de este cambio.
- **Reconciliación del Alcance B correctamente documentada, sin implementación parcial ni implícita** — confirmado por ausencia total de cambios de schema u código relacionados con `timezone`/horarios más allá de lo que ya existía antes de este entregable.
- Sin regresión: la suite completa del backend (Fase 2, Puente, Eventos, Comunicación, Empleados Digitales, Automatizaciones, Recepcionista IA, Coordinador de Agenda IA, saneamiento tenant-blind de 4.1, onboarding autónomo de 4.2) permanece en verde.

## Hallazgos encontrados durante la implementación y su resolución

Ninguno nuevo respecto de lo ya identificado y reconciliado en la Macroetapa 1/2 (choque Alcance A/B). La implementación de Alcance A coincidió exactamente con el diseño congelado.

## Estado final

Módulos activos y tasa de split de comisión son ahora configuración real por establecimiento, con una única fuente de verdad y sin ninguna modificación de contrato en los contextos consumidores. Horarios de atención y zona horaria permanecen como deuda explícitamente diferida — no resuelta en este entregable, por preservar el principio de no reescribir el motor conversacional establecido desde el Entregable 3.4. Backlog arquitectónico general de la Fase 4 (Outbox de Eventos, `AgentAutonomyLimit` sin aplicar, certificación de eventos propios de Empleados Digitales, Dominio Clínico, `InventoryItem`, pertenencia de `Commission`, residuo de M4) permanece sin cambios.

## Versionado

Versión declarada del proyecto actualizada de `2.10.0` a `2.11.0` (nueva capacidad funcional: configuración real de módulos activos y tasa de split por establecimiento, tercer entregable de la Fase 4) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ `business-config.service.js` es la única fuente de verdad para módulos activos y tasa de split (verificado por grep exhaustivo).
- ✅ Ambos `PrismaBusinessConfigReader` delegan exclusivamente en el servicio central, sin valores hardcodeados remanentes.
- ✅ Ningún puerto ni caso de uso cambió su contrato público (verificado por `git diff --stat`).
- ✅ Consumidores de Servicios y Staff funcionan sin modificaciones arquitectónicas.
- ✅ Motor conversacional completamente intacto (verificado por grep exhaustivo y `git diff --stat`).
- ✅ Reconciliación Arquitectónica del Alcance B documentada explícitamente, sin implementación parcial ni implícita.
- ✅ Suite completa en verde (70/70 · 419/419).
- ✅ Migraciones consistentes (`migrate status` limpio, `migrate diff` vacío, `prisma generate` sincronizado).
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.11.0`).
