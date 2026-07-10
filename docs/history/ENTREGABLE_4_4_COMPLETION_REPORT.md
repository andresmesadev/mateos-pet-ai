# Cierre del Entregable 4.4 — Facturación / Habilitación Comercial del SaaS

**Fecha de cierre:** 2026-07-10
**Fase:** Fase 4 — Plataforma Comercial (cuarto y último entregable del roadmap interno: 4.1 → 4.4 completo)
**Estado:** ✅ Completado
**Proceso aplicado:** proceso de macroetapas institucionalizado desde la Fase 3 (Auditoría → Diseño Etapas 1-5 → Gate Review → Implementación completa → Validación Técnica → Validación Funcional → Documentación y cierre)
**Gate Review previo:** `docs/history/ENTREGABLE_4_4_GATE_REVIEW.md`

---

## Objetivo del entregable

Cerrar la brecha entre "Facturación" (parcialmente construida desde 4.2) y "Habilitación Comercial" (inexistente): permitir cancelación real de suscripción, corregir el cambio de plan entre planes pagos, y aplicar suspensión comercial real cuando un tenant deja de pagar — unificando esa política entre el canal de WhatsApp (ya vigente desde 4.1) y el dashboard/API.

## Política comercial oficial (congelada por el responsable del proyecto)

`Tenant.active === false` implica suspensión inmediata del acceso operativo. Sin período de gracia. Sin mecanismos de dunning. Sin políticas comerciales adicionales. Misma política que ya aplicaba el canal de WhatsApp desde el Entregable 4.1 — el objetivo fue unificar el comportamiento comercial entre todos los canales del sistema, no inventar una política nueva.

## Resumen de implementación

- **Cancelación real (Hallazgo crítico 1 resuelto):** `POST /api/billing/cancel` conecta `stripe.service.cancelSubscription` (existente desde antes de este entregable, nunca invocada) — la única función que faltaba conectar, no una construcción desde cero. Actualiza `Tenant` de forma defensiva e inmediata (`subscriptionStatus: "canceled"`, `active: false`), sin depender solo de la latencia del webhook `customer.subscription.deleted`. `billing-view.tsx` ahora tiene un botón real de cancelación (con confirmación), y el texto que prometía la capacidad sin respaldo fue corregido para reflejar la funcionalidad real.
- **Cambio de plan corregido (Hallazgo crítico 2 resuelto):** nueva función `stripe.service.updateSubscriptionPrice` (Stripe Subscription Item Update) + `POST /api/billing/change-plan`, que actualiza la suscripción existente en vez de crear una segunda vía Checkout Session. `billing-view.tsx` detecta si el tenant ya tiene `stripeSubscriptionId` y enruta a `change-plan` en ese caso; el alta inicial (sin suscripción previa) sigue usando `checkout` sin cambios.
- **Suspensión comercial real (Hallazgo crítico 3 resuelto):** `resolveTenant.js` (middleware de toda la API del dashboard) ahora consulta `Tenant.active` y responde `402` si es `false`, sin excepción para superAdmin cuando impersona un tenant concreto. `/api/billing` y `/api/onboarding` nunca se montaron bajo este middleware — no requirieron ninguna exclusión adicional, la topología existente ya los dejaba fuera del gate.
- **`app/api/proxy/billing/route.ts`** extendido para despachar `action: "checkout" | "cancel" | "change-plan"`, siempre forzando `tenantId` desde la sesión de NextAuth, nunca desde el cliente.

## Validación Técnica

- `prisma migrate status` → 33 migraciones, base de datos al día, sin diferencias. `prisma migrate diff` → vacío. **Sin cambios de schema en este entregable** — `Tenant.active/subscriptionStatus/stripeSubscriptionId` ya existentes fueron suficientes.
- Suite completa: **71/71 suites · 428/428 tests** en verde (9 tests nuevos: 5 de `billing.routes.js` — cancelación, cambio de plan, casos de error — y 4 de suspensión comercial en `resolveTenant.js`).
- `tsc --noEmit` en frontend sin errores nuevos (persisten los 2 preexistentes ajenos ya documentados desde entregables anteriores).
- **Grep exhaustivo confirma que `cancelSubscription` tiene ahora exactamente un consumidor real** (`billing.routes.js`), dejando de ser código muerto.
- **Grep exhaustivo confirma que `/change-plan` no invoca `createCheckoutSession`** — es un camino de código completamente separado del alta inicial, usando `updateSubscriptionPrice` en su lugar. Cero llamadas que dupliquen suscripciones para cambios entre planes pagos.
- **Grep exhaustivo confirma que `resolveTenant.js` aplica el gate exclusivamente sobre `Tenant.active`**, sin ninguna otra condición ni excepción no documentada.
- **Grep exhaustivo confirma que ningún archivo del motor conversacional fue modificado**: `git diff --stat` vacío para `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`.
- **Grep exhaustivo confirma que el proxy de billing sigue forzando `tenantId` desde la sesión** (`tenantId: tenantId ?? rest.tenantId` — la sesión tiene prioridad sobre cualquier valor enviado por el cliente).

## Validación Funcional

- **Cancelación:** confirmado por test que `POST /api/billing/cancel` invoca `cancelSubscription` con el `stripeSubscriptionId` real del tenant y actualiza `Tenant` a `active: false`/`subscriptionStatus: "canceled"`; rechaza con 400 si el tenant no tiene suscripción activa, y con 404 si el tenant no existe.
- **Cambio de plan:** confirmado por test que `POST /api/billing/change-plan` invoca `updateSubscriptionPrice` con la suscripción existente; rechaza con 400 si el tenant no tiene suscripción previa (dirigiendo a `/checkout` para el alta inicial).
- **Suspensión comercial:** confirmado por test que un tenant con `active: false` recibe `402` y no continúa, incluyendo el caso de un superAdmin impersonando ese tenant (sin excepción) y el caso `SINGLE_TENANT_ID`.
- **Unificación de canales confirmada por inspección directa:** `contexts/receptionist/infrastructure/engine/resolve-tenant-id.js` (canal WhatsApp, desde 4.1) y `middleware/resolveTenant.js` (canal dashboard/API, este entregable) consultan exactamente el mismo campo (`Tenant.active`) como única fuente de verdad de suspensión — antes de este entregable, solo el canal de WhatsApp la aplicaba.
- Sin regresión: la suite completa del backend (Fase 2, Puente, Eventos, Comunicación, Empleados Digitales, Automatizaciones, Recepcionista IA, Coordinador de Agenda IA, saneamiento tenant-blind de 4.1, onboarding autónomo de 4.2, configuración por establecimiento de 4.3) permanece en verde.

## Hallazgos encontrados durante la implementación y su resolución

Ninguno nuevo — la implementación coincidió exactamente con los tres hallazgos críticos documentados en la Macroetapa 1, sin desviaciones de alcance. Dos observaciones menores registradas sin acción (fuera del alcance congelado): `Tenant.plan` (nombre del plan) no se sincroniza en `/change-plan`, igual que el webhook existente tampoco lo hacía en `customer.subscription.updated` — inconsistencia preexistente, no introducida ni corregida aquí; y el modelo de confianza de `/api/billing/*` (acepta `tenantId` sin autenticación propia a nivel de backend, mitigado en la práctica por el proxy) es el mismo que ya existía para `/checkout` desde antes de este entregable, no una vulnerabilidad nueva.

## Estado final

Facturación y Habilitación Comercial operan de forma real y coherente: alta, cambio de plan y cancelación de suscripción sin defectos de duplicación, y suspensión comercial efectiva unificada entre el canal de WhatsApp y el dashboard/API. **Con este cierre, el roadmap interno de la Fase 4 — Plataforma Comercial (4.1 Saneamiento Tenant-Blind → 4.2 Onboarding Autónomo → 4.3 Configuración por Establecimiento → 4.4 Facturación/Habilitación Comercial) queda completo.** Backlog arquitectónico general de la fase permanece sin cambios (Outbox de Eventos, `AgentAutonomyLimit` sin aplicar, certificación de eventos propios de Empleados Digitales, Dominio Clínico, `InventoryItem`, pertenencia de `Commission`, residuo de M4 dentro del motor conversacional, Alcance B de 4.3 — horarios/zona horaria).

## Versionado

Versión declarada del proyecto actualizada de `2.11.0` a `2.12.0` (nueva capacidad funcional: cancelación y cambio de plan reales, suspensión comercial unificada; cierre del roadmap interno de la Fase 4) en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ `cancelSubscription()` tiene un consumidor real, deja de ser código muerto (verificado por grep exhaustivo).
- ✅ El cambio de plan entre planes pagos actualiza la suscripción existente, sin duplicarla (verificado por grep exhaustivo y por test).
- ✅ La cancelación modifica correctamente el estado del `Tenant` (verificado por test).
- ✅ `resolveTenant.js` aplica la suspensión comercial usando exclusivamente `Tenant.active` (verificado por grep exhaustivo y por test).
- ✅ Dashboard y canal de WhatsApp aplican ahora la misma política comercial (verificado por inspección directa de ambos archivos).
- ✅ El proxy de billing continúa forzando `tenantId` desde la sesión (verificado por inspección directa).
- ✅ Motor conversacional sin ningún cambio (verificado por grep exhaustivo y `git diff --stat`).
- ✅ Ninguna decisión arquitectónica fuera del alcance del entregable fue modificada.
- ✅ Suite completa en verde (71/71 · 428/428).
- ✅ Migraciones consistentes (`migrate status` limpio, `migrate diff` vacío, sin cambios de schema).
- ✅ Versión del proyecto consistente entre código y endpoint de salud (`2.12.0`).
- ✅ **Roadmap interno de la Fase 4 (4.1 → 4.4) completo.**
