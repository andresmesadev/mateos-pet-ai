# Gate Review — Entregable 4.2 (Onboarding Autónomo), Macroetapa 1

**Fecha:** 2026-07-09
**Fase:** 4 — Plataforma Comercial (segundo entregable del roadmap interno)
**Alcance de la macroetapa:** Auditoría del código real + Diseño completo (Etapas 1–5) + Gate Review.

---

## Resultado de la auditoría

- `POST /api/onboarding/register` crea un `Tenant` (nombre, slug, teléfono, email, plan) e inicia un Stripe Checkout Session si el plan es pago, montado bajo `publicRateLimit` (remediación A5 de la Auditoría v2.1.0; el captcha/verificación adicional sigue diferido).
- **Hallazgo crítico:** el registro no siembra ningún `DigitalEmployee`. `scripts/seed-digital-employees.js` y `scripts/seed-event-types.js` son scripts manuales, nunca invocados por el flujo de registro — un tenant recién onboardeado queda sin Recepcionista IA ni Coordinador de Agenda IA hasta que un humano ejecute el script. Contradice el objetivo estratégico de la Fase 4 ("sin intervención del equipo de desarrollo").
- `billing.routes.js` ya implementa el ciclo completo de suscripción vía webhook de Stripe, entrelazado con el registro para planes pagos — no es una construcción desde cero.
- **Hallazgo estructural:** `docs/architecture/domain-model-v1.md` §1 — Contexto: Negocio — especifica `Establecimiento`, `Módulo` y `Configuración del Negocio` con eventos propios, ninguno implementado en código (`Tenant` es una tabla plana sin capa de dominio). Confirmado por referencias cruzadas en ADR 008 y ADR 009, que ya trataron esta ausencia como deuda diferida.

## Decisión de arquitectura congelada (por el responsable del proyecto)

Para este entregable, `Tenant` no se reemplaza ni se renombra. Se extiende de forma aditiva para representar el Establecimiento mínimo necesario para el onboarding autónomo. El Contexto Negocio completo (`Establecimiento`, `Módulo`, `Configuración del Negocio` y sus eventos) queda reconocido como deuda de implementación del Modelo de Dominio, cuya construcción pertenece al Entregable 4.3 — fuera del alcance de 4.2. Sin migración de `Tenant` → `Establecimiento`, sin cambio de nombres de tablas, sin refactor masivo de referencias existentes.

## Etapas 1–5 (resumen)

1. **Definición funcional:** un nuevo Establecimiento debe quedar operativo (con sus Empleados Digitales base activos) y su suscripción regida por el ciclo de facturación existente, sin intervención manual.
2. **Casos de uso:** Registrar Establecimiento (ya existente, sin cambios de identidad); Aprovisionar Empleados Digitales base (nuevo, reutiliza `agents.registerDigitalEmployee`); Iniciar suscripción (ya existente, sin cambios).
3. **Arquitectura técnica:** ningún caso de uso público de otro contexto cambia su firma; `billing.routes.js`/`stripe.service.js` no se tocan; el aprovisionamiento se orquesta desde el flujo de registro reutilizando el caso de uso ya expuesto por Empleados Digitales.
4. **Modelo de persistencia:** sin cambios — la identidad mínima ya presente en `Tenant` (`id/name/slug/phone/email/plan/active`) alcanza para el aprovisionamiento.
5. **Esquema físico:** sin migración.

## Resultado del Gate Review

**Aprobado para pasar a Macroetapa 2**, bajo la decisión de arquitectura congelada arriba. Ninguna contradicción real detectada entre el roadmap, el Modelo de Dominio y el código existente — el hallazgo del Contexto Negocio es una deuda reconocida, no una contradicción, y queda explícitamente diferida a 4.3.

## Confirmación de congelamiento del diseño

Etapas 1–5 quedan congeladas como base de la Macroetapa 2. Diseño implementado sin desviaciones (ver `docs/history/ENTREGABLE_4_2_COMPLETION_REPORT.md`).
