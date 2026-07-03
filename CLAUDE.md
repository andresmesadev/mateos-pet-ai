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
- **Las comisiones son inmutables.** Los registros en `Commission` nunca se modifican. Las correcciones se hacen con anulación + nuevo registro — implementado por el ADR 009 (`VoidCommissionUseCase`, comando único atómico; como máximo una comisión activa por cita, índice único parcial en BD).
- **El precio se resuelve en un único lugar.** Siempre a través de `price-resolver.service.js`.
- **`prisma generate` después de cambios de schema.** `prisma db push` sincroniza la BD pero no regenera el cliente TypeScript. (Automatizado vía hook — ver `.claude/hooks/prisma-generate.sh`.)
- **`apiUrl` nunca desde componentes cliente hacia endpoints autenticados.** Desde el navegador, siempre `proxyUrl` (el proxy añade la autenticación server-side). En Server Components, `apiUrl` + `makeServerHeaders` es el camino sancionado. Única excepción cliente: el onboarding público (`/api/onboarding`), que no requiere autenticación por diseño. (Alcance real documentado en la remediación M5 de la auditoría v2.1.0; hook: `.claude/hooks/block-apiurl.sh`.)
- **Todo cierre oficial de un entregable implementado debe evaluar el versionado del proyecto antes del commit final.** Si el cierre introduce capacidades nuevas o cambios funcionales relevantes, se realizará el bump de versión correspondiente antes de crear el tag. Ningún tag oficial puede diferir de la versión declarada por el código, la documentación y el endpoint de salud. (Institucionalizada tras la discrepancia detectada antes del cierre del Entregable 3.0 — v2.3.0.)

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

## Fase activa: Fase 3 — Empleados Digitales Especializados (en curso)

**Roadmap interno aprobado:** 3.0 Infraestructura de Eventos → 3.1 Comunicación → 3.2 Empleado Digital → 3.3 Automatizaciones → 3.4 Recepcionista IA → 3.5 Coordinador de Agenda IA.

- Entregable 3.0 — Infraestructura de Eventos — ✅ Completado (2026-07-03). Contexto Eventos nuevo (`domain-model-v1.md` §12): certifica hechos de negocio como Evento de Dominio inmutable; Catálogo global de Tipos de Evento; certificación de `CitaCompletada` integrada de forma aditiva sobre el dispatcher del Puente, sin tocarlo. Mecanismo de entrega asíncrona hacia consumidores futuros (Automatizaciones, 3.3) queda como decisión diferida. Ver `docs/history/ENTREGABLE_3_0_COMPLETION_REPORT.md`.
- **Entregable activo: 3.1 — Comunicación.** Siguiente en el roadmap; aún no iniciado.

## Fase 2 — Sistema Operativo del Negocio (✅ Completa, alcance re-declarado por ADR 006)

**Objetivo:** Capa de casos de uso, entidades faltantes del dominio operativo, reportes financieros.

**Fuera del alcance de esta fase:** nuevos canales, motor de automatizaciones, mejoras al agente de WhatsApp, multitenancy, Dominio Clínico — y (re-declarado por el ADR 006) la exposición de los casos de uso a canales y operadores.

**Estado del roadmap interno** (ver `docs/PLAN_MAESTRO.md`, sección Fase 2):
- Entregable 2.1 — Catálogo de Servicios como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`)
- Entregable 2.2 — Staff como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`)
- Entregable 2.3 — Finanzas como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`)
- Entregable puente — Exposición del Sistema Operativo — ✅ Completado (remediación de la auditoría v2.1.0; ADRs 007/008/009 implementados; ver `docs/history/AUDITORIA_V2_1_0_CIERRE.md`)

**Reconciliación ADR 006 (2026-07-02) — resuelta:** la exposición pendiente que el ADR 006 identificó fue completada por el Entregable Puente: los casos de uso de Servicios, Staff y Finanzas están expuestos vía rutas del dashboard; Completar Cita es un comando del contexto Agenda que publica `CitaCompletada` (dispatcher síncrono en la misma transacción → comisión + cobro de sistema); el legacy sustituido (`commission.service.js`, `service.service.js`, `staff.service.js`) fue retirado. Las decisiones de dominio C2/A1/A4 quedaron resueltas en los ADRs 007/008/009 e implementadas. Antes de la Fase 3 corresponde el mapa conceptual solicitado por el responsable del proyecto.