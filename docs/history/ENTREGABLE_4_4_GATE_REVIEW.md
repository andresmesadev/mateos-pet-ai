# Gate Review — Entregable 4.4 (Facturación / Habilitación Comercial del SaaS), Macroetapa 1

**Fecha:** 2026-07-10
**Fase:** 4 — Plataforma Comercial (cuarto y último entregable del roadmap interno)
**Alcance de la macroetapa:** Auditoría del código real + Diseño completo (Etapas 1–5) + Gate Review.

---

## Resultado de la auditoría

- Alta de suscripción vía Checkout Session ya funcionaba (`POST /api/billing/checkout`, reutilizado desde 4.2), igual que la actualización de `Tenant.active/subscriptionStatus/planExpiresAt` vía webhook de Stripe.
- **Hallazgo crítico 1:** `cancelSubscription()` (`stripe.service.js`) era código muerto — cero llamadores en todo el repositorio. `billing-view.tsx` prometía textualmente *"Puedes cancelar tu suscripción en cualquier momento"* sin ningún botón ni backend que lo respaldara.
- **Hallazgo crítico 2:** cambiar entre dos planes pagos reutilizaba el mismo flujo de Checkout (`mode: "subscription"`), que siempre crea una suscripción nueva en Stripe — la anterior quedaba activa y facturándose, huérfana, nunca cancelada.
- **Hallazgo crítico 3:** `resolveTenant.js` (middleware de toda la API del dashboard) nunca consultaba `Tenant.active`/`subscriptionStatus` — un tenant `past_due`/`canceled` conservaba acceso completo e indefinido. Asimetría confirmada frente al canal de WhatsApp, que sí respeta `Tenant.active` desde el Entregable 4.1.

## Decisión de arquitectura congelada (por el responsable del proyecto)

`Tenant.active === false` implica suspensión inmediata del acceso operativo, sin período de gracia, sin dunning, sin políticas comerciales adicionales — misma política que ya aplica el canal de WhatsApp desde 4.1, unificando el comportamiento comercial entre todos los canales.

## Etapas 1–5 (resumen)

1. **Definición funcional:** un tenant suspendido pierde acceso real (dashboard y API), no solo un estado visual; un cambio entre planes pagos no debe generar una segunda suscripción; la cancelación debe ser una acción real.
2. **Casos de uso:** Cancelar Suscripción; Cambiar de Plan (actualiza la suscripción existente vía Stripe); Aplicar Suspensión Comercial (gate en `resolveTenant.js`).
3. **Arquitectura técnica:** ningún archivo del motor conversacional involucrado; `resolveTenant.js` solo se monta en `/api/dashboard` — `/api/billing`/`/api/onboarding` nunca pasaron por él, por lo que no requieren exclusión adicional.
4. **Modelo de persistencia:** sin cambios — `Tenant.active/subscriptionStatus/stripeSubscriptionId` ya existentes son suficientes.
5. **Esquema físico:** sin migración prevista.

## Resultado del Gate Review

**Aprobado para pasar a Macroetapa 2.** Sin contradicción con el motor conversacional ni con ningún ADR vigente. Único punto a confirmar antes de implementar: política de gracia antes de suspender — resuelta por decisión explícita del responsable del proyecto (sin gracia, sin dunning) antes de iniciar la Macroetapa 2.

## Confirmación de congelamiento del diseño

Etapas 1–5 quedaron congeladas como base de la Macroetapa 2.

---

## Consolidación final (post Macroetapa 2 y 3)

El checkpoint de Macroetapa 2 confirmó que `resolveTenant.js` nunca se monta en `/api/billing` ni `/api/onboarding` — no hubo necesidad de exclusiones adicionales al gate. Se implementaron los tres bloques congelados sin desviación: conexión real de `cancelSubscription`, corrección del cambio de plan vía `updateSubscriptionPrice` (Stripe Subscription Item Update, sin duplicar suscripciones), y suspensión comercial en `resolveTenant.js` usando `Tenant.active` como única fuente de verdad. Detalle completo en `docs/history/ENTREGABLE_4_4_COMPLETION_REPORT.md`. Con este cierre, el roadmap interno de la **Fase 4 — Plataforma Comercial (4.1 → 4.4) queda completo**.
