# Cierre del Entregable 4.2 — Onboarding Autónomo

**Fecha de cierre:** 2026-07-09
**Fase:** Fase 4 — Plataforma Comercial (segundo entregable del roadmap interno)
**Estado:** ✅ Completado
**Proceso aplicado:** proceso de macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 → Gate Review → Implementación completa → Validación Técnica → Validación Funcional → Documentación y cierre)
**Gate Review previo:** `docs/history/ENTREGABLE_4_2_GATE_REVIEW.md`

---

## Objetivo del entregable

Que un nuevo Establecimiento pueda registrarse y quedar completamente operativo — con sus Empleados Digitales base activos y su suscripción iniciada cuando aplique — sin intervención manual del equipo de desarrollo.

## Decisión de arquitectura congelada

`Tenant` no se reemplazó ni se renombró. Se extendió de forma aditiva. El Contexto Negocio completo (`Establecimiento`, `Módulo`, `Configuración del Negocio`, eventos propios), identificado durante la auditoría como deuda de implementación del Modelo de Dominio (§1), queda explícitamente diferido al Entregable 4.3 — fuera del alcance de 4.2. Ver `docs/history/ENTREGABLE_4_2_GATE_REVIEW.md` para el detalle de esta decisión y su justificación.

## Resumen de implementación

- **`backend/src/services/tenant-provisioning.service.js` (nuevo):** único punto responsable del aprovisionamiento automático de Empleados Digitales por defecto (`DEFAULT_SPECIALIZATIONS = ["recepcionista", "coordinador_agenda"]`). Reutiliza exclusivamente `agents.registerDigitalEmployee`/`agents.getDigitalEmployees` — cero acceso a capas internas de Empleados Digitales. Cada especialización se aprovisiona de forma aislada: el fallo de una no impide las demás (mismo principio de aislamiento de fallos de 3.3/3.4/3.5).
- **`scripts/seed-digital-employees.js` refactorizado:** consume `tenant-provisioning.service.js` en vez de duplicar la lista de especializaciones y la lógica de "ensure-o-crea". Queda como herramienta de backfill manual para tenants que no pasaron por el registro autónomo.
- **`onboarding.routes.js` (`POST /register`):** invoca `provisionDefaultDigitalEmployees(tenant.id)` tras crear el tenant, de forma aislada (try/catch propio) — un fallo de aprovisionamiento no revierte la creación del tenant ni interrumpe el registro; se refleja en la respuesta (`provisioning`). El flujo de checkout de Stripe para planes pagos permanece sin cambios.

## Validación Técnica

- Suite completa: **66/66 suites · 403/403 tests** en verde (9 tests nuevos: 3 de `tenant-provisioning.service.js` — incluida idempotencia y aislamiento de fallos —, 6 de wiring HTTP del registro, incluidos los casos explícitos de plan gratuito y plan pago).
- `prisma migrate status` → 32 migraciones, base de datos al día; `prisma migrate diff` vacío — sin cambios de schema, conforme a la decisión de no tocar `Tenant`.
- **Grep exhaustivo confirma que `tenant-provisioning.service.js` es el único módulo que exporta/consume `DEFAULT_SPECIALIZATIONS`/`provisionDefaultDigitalEmployees`** — `onboarding.routes.js` y `scripts/seed-digital-employees.js` lo consumen, ninguno duplica su lógica.
- **Grep exhaustivo confirma que `scripts/seed-digital-employees.js` ya no contiene ninguna referencia a `getDigitalEmployees`, `registerDigitalEmployee`, `SPECIALIZATIONS_TO_SEED` ni `ensureDigitalEmployeeForTenant`** — delega en su totalidad al servicio nuevo.
- **Grep exhaustivo confirma aislamiento de contextos:** el único otro llamador de `agents.registerDigitalEmployee` en todo el repositorio es `dashboard/agents.routes.js` (alta manual desde el dashboard humano, caso de uso legítimamente distinto — no duplica la política de especializaciones por defecto). `tenant-provisioning.service.js` solo importa la raíz de composición pública de `contexts/agents`.
- Cero cambios en `billing.routes.js`/`stripe.service.js` (confirmado por `git diff --stat`).

## Validación Funcional

- **Aprovisionamiento automático confirmado:** un registro nuevo aprovisiona `recepcionista` y `coordinador_agenda` sin intervención manual, cerrando la brecha encontrada en la auditoría.
- **Idempotencia confirmada:** si una especialización ya existe para el tenant, no se duplica.
- **Aislamiento de fallos confirmado:** el fallo de una especialización no impide aprovisionar las demás; el fallo del aprovisionamiento completo no revierte ni interrumpe el registro del tenant.
- **Plan gratuito:** el registro aprovisiona los Empleados Digitales y no inicia ningún checkout de Stripe — verificado explícitamente por test.
- **Plan pago:** el registro aprovisiona los Empleados Digitales Y además inicia el checkout de Stripe — verificado explícitamente por test; ambos flujos son independientes entre sí.
- Sin regresión: la suite completa del backend (Fase 2, Puente, Eventos, Comunicación, Empleados Digitales, Automatizaciones, Recepcionista IA, Coordinador de Agenda IA, saneamiento tenant-blind de 4.1) permanece en verde.

## Hallazgos encontrados durante la implementación y su resolución

Ninguno nuevo. La implementación coincidió exactamente con el diseño congelado en la Macroetapa 1 y con la decisión de arquitectura aprobada antes de iniciar la Macroetapa 2 — no fue necesario ningún ajuste de alcance.

## Estado final

El registro de un nuevo tenant queda operativo sin intervención manual del equipo de desarrollo para su capacidad base (Recepcionista IA, Coordinador de Agenda IA) y para el inicio de su suscripción cuando aplica. El Contexto Negocio completo permanece como deuda reconocida, explícitamente diferida al Entregable 4.3, junto con el resto del backlog arquitectónico general de la Fase 4 (Outbox de Eventos, `AgentAutonomyLimit` sin aplicar, certificación de eventos propios de Empleados Digitales, Dominio Clínico, `InventoryItem`, pertenencia de `Commission`, y el residuo de M4 dentro del motor conversacional registrado al cerrar 4.1).

## Versionado

Versión declarada del proyecto actualizada de `2.9.0` a `2.10.0` (nueva capacidad funcional: aprovisionamiento automático de Empleados Digitales en el registro, segundo entregable de la Fase 4) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Un nuevo tenant queda con `recepcionista` y `coordinador_agenda` activos sin intervención manual.
- ✅ `tenant-provisioning.service.js` es el único punto responsable del aprovisionamiento automático (verificado por grep exhaustivo).
- ✅ `scripts/seed-digital-employees.js` reutiliza ese servicio, sin lógica duplicada (verificado por grep exhaustivo).
- ✅ Onboarding funciona para plan gratuito (sin checkout) y plan pago (con checkout), ambos con aprovisionamiento — verificado explícitamente por test.
- ✅ `Tenant` sin renombrar, sin migración, sin refactor masivo — conforme a la decisión de arquitectura congelada.
- ✅ Suite completa en verde (66/66 · 403/403).
- ✅ Migraciones consistentes (`migrate status` limpio, `migrate diff` vacío).
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.10.0`).
