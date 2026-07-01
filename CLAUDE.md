# Contexto del Proyecto para IAs

Este archivo se carga automáticamente en cada sesión de Claude Code.

## Antes de contribuir

Si vas a desarrollar una funcionalidad, proponer una mejora o participar en este proyecto, debes leer primero:

1. `docs/PLAN_MAESTRO.md` — La visión, los principios, la arquitectura y el roadmap oficial del producto
2. `docs/history/PHASE_1_COMPLETION_REPORT.md` — Qué se construyó en la Fase 1 y qué habilita
3. `docs/architecture/domain-model-v1.md` — El modelo conceptual oficial del negocio
4. `docs/PHASE_2_EXECUTION_RULE.md` — El proceso obligatorio para construir cualquier entregable de la Fase 2

Cualquier propuesta que contradiga esos documentos debe justificarse explícitamente antes de aceptarse.

## Reglas de trabajo

- **No proponer funcionalidades de fases futuras.** La fase activa es la Fase 2. Ver `docs/PLAN_MAESTRO.md` para su alcance.
- **Ningún entregable de la Fase 2 se implementa sin pasar primero por las cinco etapas de diseño.** Ver `docs/PHASE_2_EXECUTION_RULE.md` para el proceso obligatorio: definición funcional → casos de uso → arquitectura técnica → modelo de persistencia → esquema físico. Solo entonces comienza la implementación.
- **El dominio va primero.** Antes de proponer código, verificar que la entidad o regla de negocio existe en `docs/architecture/domain-model-v1.md`.
- **El criterio del Portal del Cliente.** Si un servicio de dominio no podría ser invocado por el Portal del Cliente sin modificaciones, pertenece al adaptador, no al dominio.
- **Las comisiones son inmutables.** Los registros en `Commission` nunca se modifican. Las correcciones se hacen con anulación + nuevo registro.
- **El precio se resuelve en un único lugar.** Siempre a través de `price-resolver.service.js`.
- **`prisma generate` después de cambios de schema.** `prisma db push` sincroniza la BD pero no regenera el cliente TypeScript. (Automatizado vía hook — ver `.claude/hooks/prisma-generate.sh`.)
- **Nunca usar `apiUrl()`.** Siempre `proxyUrl()` — hallazgo de la auditoría de seguridad. (Bloqueado vía hook — ver `.claude/hooks/block-apiurl.sh`.)

## Stack técnico

- Backend: Node.js, Express 5, Prisma, PostgreSQL (Neon), pgvector
- Frontend: Next.js 16, TypeScript, Tailwind, shadcn/ui
- Integraciones: OpenAI API, WhatsApp Cloud API, Google Calendar, Stripe
- Estructura: `backend/`, `frontend/`, `prisma/`, `scripts/`, `docs/`

## Comandos

- Dev: `[ej. npm run dev]`
- Lint: `[ej. npm run lint]`
- Tests: `[ej. npm run test]`
- Build: `[ej. npm run build]`
- `npx prisma generate` — después de cualquier cambio a `schema.prisma`

## Antes de declarar terminada una tarea

Correr lint y tests, y mostrar la evidencia real (el output del comando, no solo "ya quedó"). Si no se puede verificar, no se da por terminado.

## Fase activa: Fase 2 — Sistema Operativo del Negocio (✅ Completa)

**Objetivo:** Capa de casos de uso, entidades faltantes del dominio operativo, reportes financieros.

**Fuera del alcance de esta fase:** nuevos canales, motor de automatizaciones, mejoras al agente de WhatsApp, multitenancy, Dominio Clínico.

**Estado del roadmap interno** (ver `docs/PLAN_MAESTRO.md`, sección Fase 2):
- Entregable 2.1 — Catálogo de Servicios como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`)
- Entregable 2.2 — Staff como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`)
- Entregable 2.3 — Finanzas como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`)

Con los tres entregables cerrados, el criterio de cierre de la Fase 2 quedó cumplido: Agenda, Servicios, Staff y Finanzas operan mediante su propia capa de casos de uso, sin que ningún canal orqueste reglas de negocio directamente. La siguiente fase (Fase 3) aún no ha sido oficialmente iniciada — antes de comenzarla corresponde el mapa conceptual solicitado por el responsable del proyecto.