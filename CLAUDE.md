# Contexto del Proyecto para IAs

Este archivo se carga automáticamente en cada sesión de Claude Code.

## Antes de contribuir

Si vas a desarrollar una funcionalidad, proponer una mejora o participar en este proyecto, debes leer primero:

1. `docs/PLAN_MAESTRO.md` — La visión, los principios, la arquitectura y el roadmap oficial del producto
2. `docs/PHASE_1_COMPLETION_REPORT.md` — Qué se construyó en la Fase 1 y qué habilita
3. `docs/architecture/domain-model-v1.md` — El modelo conceptual oficial del negocio

Cualquier propuesta que contradiga esos documentos debe justificarse explícitamente antes de aceptarse.

## Reglas de trabajo

- **No proponer funcionalidades de fases futuras.** La fase activa es la Fase 2. Ver `docs/PLAN_MAESTRO.md` para su alcance.
- **El dominio va primero.** Antes de proponer código, verificar que la entidad o regla de negocio existe en `docs/architecture/domain-model-v1.md`.
- **El criterio del Portal del Cliente.** Si un servicio de dominio no podría ser invocado por el Portal del Cliente sin modificaciones, pertenece al adaptador, no al dominio.
- **Las comisiones son inmutables.** Los registros en `Commission` nunca se modifican. Las correcciones se hacen con anulación + nuevo registro.
- **El precio se resuelve en un único lugar.** Siempre a través de `price-resolver.service.js`.
- **`prisma generate` después de cambios de schema.** `prisma db push` sincroniza la BD pero no regenera el cliente TypeScript.

## Fase activa: Fase 2 — Sistema Operativo del Negocio

**Objetivo:** Capa de casos de uso, entidades faltantes del dominio operativo, reportes financieros.

**Fuera del alcance de esta fase:** nuevos canales, motor de automatizaciones, mejoras al agente de WhatsApp, multitenancy, Dominio Clínico.
