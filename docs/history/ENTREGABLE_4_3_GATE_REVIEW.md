# Gate Review — Entregable 4.3 (Configuración por Establecimiento), Macroetapa 1

**Fecha:** 2026-07-09
**Fase:** 4 — Plataforma Comercial (tercer entregable del roadmap interno)
**Alcance de la macroetapa:** Auditoría del código real + Diseño completo (Etapas 1–5) + Gate Review.

---

## Resultado de la auditoría

- `contexts/services/application/ports/business-config-reader.port.js` y `contexts/staff/application/ports/business-config-reader.port.js`: dos puertos casi idénticos, ambos con implementación (`PrismaBusinessConfigReader`) hardcodeada sin distinción de tenant (`getActiveModules` → siempre `["grooming","veterinary"]`; `getCommissionSplitRate` → siempre `0.5`), ambos con comentario explícito anticipando esta migración.
- Consumidores reales verificados: `create-service`/`update-service`/`list-available-services.usecase.js` (gate de categoría por módulo activo) y `record-commission-on-appointment-completed.usecase.js` (tasa de split).
- `Tenant.businessHours`: campo persistido, editable desde el dashboard, **nunca consultado** por ningún servicio de disponibilidad.
- Ausencia total de campo de zona horaria en `Tenant`, confirmando lo que ADR 008 ya anticipaba textualmente.
- **Contradicción detectada:** `isBusinessDay`/`isWithinBusinessHours` (`availability.service.js`) son consumidas por `scheduling.service.js`, parte del motor conversacional protegido desde 3.4. Aplicar horarios/zona-horaria reales por tenant en el flujo conversacional exigiría tocar ese archivo.

## Decisiones de diseño (Etapas 1–5)

División explícita del alcance en dos, dado el choque detectado:
- **Alcance A** (módulos activos, tasa de split, consolidación del `BusinessConfigReader`): sin relación con el motor conversacional, consumidores exclusivamente en `services`/`staff`.
- **Alcance B** (horarios de atención, zona horaria, aplicación real en el flujo conversacional): bloqueado por el mismo principio que 4.1 encontró con M4.

`Tenant` no se renombra ni se reemplaza (mismo criterio que 4.2). La configuración se persiste como extensión aditiva de `Tenant`.

## Resultado del Gate Review

**Aprobado para pasar a Macroetapa 2**, condicionado a realizar como primer paso el checkpoint explícito de confirmación empírica del choque Alcance A/B antes de escribir código.

## Confirmación de congelamiento del diseño

Etapas 1–5 quedaron congeladas como base de la Macroetapa 2.

---

## Consolidación final (post Macroetapa 2 y 3)

El checkpoint de Macroetapa 2 confirmó exactamente lo anticipado: el Alcance B exige modificar `scheduling.service.js`/`availability.service.js`. Se implementó íntegramente el Alcance A (`business-config.service.js` como fuente única de verdad, ambos `PrismaBusinessConfigReader` delegando en él, sin cambios de puerto ni de caso de uso) y se registró el Alcance B como Reconciliación Arquitectónica **no resuelta deliberadamente**, preservando el principio "no reescribir el motor conversacional" institucionalizado desde 3.4. Detalle completo en `docs/history/ENTREGABLE_4_3_COMPLETION_REPORT.md`.
