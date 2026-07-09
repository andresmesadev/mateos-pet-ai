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

- **No proponer funcionalidades de fases futuras.** La Fase 4 (Plataforma Comercial) está en curso; la Fase 5 aún no ha sido definida. Ver `docs/PLAN_MAESTRO.md` para el alcance vigente.
- **Durante la Fase 4, no incorporar funcionalidades veterinarias nuevas que no contribuyan directamente al objetivo de Plataforma Comercial.** Dominio Clínico, `InventoryItem` y cualquier otra capacidad operativa nueva permanecen en el backlog arquitectónico, salvo que una dependencia arquitectónica real con el objetivo comercial la fuerce — y en ese caso debe justificarse explícitamente antes de aceptarse, con el mismo criterio aplicado a la definición de 4.1 (regla institucionalizada al congelar oficialmente la Fase 4, 2026-07-08).
- **La deuda técnica acumulada no define la identidad de ninguna fase.** Se registra como backlog arquitectónico transversal y solo se promueve a entregable cuando existe dependencia arquitectónica demostrable con el objetivo estratégico de la fase en curso — no por oportunidad ni por estar "ya identificada".
- **Ningún entregable de la Fase 2 se implementa sin pasar primero por las cinco etapas de diseño.** Ver `docs/PHASE_2_EXECUTION_RULE.md` para el proceso obligatorio: definición funcional → casos de uso → arquitectura técnica → modelo de persistencia → esquema físico. Solo entonces comienza la implementación.
- **El dominio va primero.** Antes de proponer código, verificar que la entidad o regla de negocio existe en `docs/architecture/domain-model-v1.md`.
- **El criterio del Portal del Cliente.** Si un servicio de dominio no podría ser invocado por el Portal del Cliente sin modificaciones, pertenece al adaptador, no al dominio.
- **Las comisiones son inmutables.** Los registros en `Commission` nunca se modifican. Las correcciones se hacen con anulación + nuevo registro — implementado por el ADR 009 (`VoidCommissionUseCase`, comando único atómico; como máximo una comisión activa por cita, índice único parcial en BD).
- **El precio se resuelve en un único lugar.** Siempre a través de `price-resolver.service.js`.
- **`prisma generate` después de cambios de schema.** `prisma db push` sincroniza la BD pero no regenera el cliente TypeScript. (Automatizado vía hook — ver `.claude/hooks/prisma-generate.sh`.)
- **`apiUrl` nunca desde componentes cliente hacia endpoints autenticados.** Desde el navegador, siempre `proxyUrl` (el proxy añade la autenticación server-side). En Server Components, `apiUrl` + `makeServerHeaders` es el camino sancionado. Única excepción cliente: el onboarding público (`/api/onboarding`), que no requiere autenticación por diseño. (Alcance real documentado en la remediación M5 de la auditoría v2.1.0; hook: `.claude/hooks/block-apiurl.sh`.)
- **Todo cierre oficial de un entregable implementado debe evaluar el versionado del proyecto antes del commit final.** Si el cierre introduce capacidades nuevas o cambios funcionales relevantes, se realizará el bump de versión correspondiente antes de crear el tag. Ningún tag oficial puede diferir de la versión declarada por el código, la documentación y el endpoint de salud. (Institucionalizada tras la discrepancia detectada antes del cierre del Entregable 3.0 — v2.3.0.)
- **Todo criterio de cierre verificable por grep (p. ej. "cero llamadas directas a X fuera del contexto Y") debe ejecutarse contra el repositorio completo antes de declarar el entregable terminado, nunca solo contra el inventario identificado en la etapa de diseño.** El inventario de diseño es un punto de partida, no un techo. (Institucionalizada tras el Entregable 3.1: la auditoría de la Etapa 1 identificó 6 puntos de envío directo a `sendWhatsAppMessage`; la Validación Técnica encontró 2 más mediante un grep exhaustivo del criterio de cierre.)

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

## Fase 3 — Empleados Digitales Especializados (✅ Completa)

**Roadmap interno aprobado:** 3.0 Infraestructura de Eventos → 3.1 Comunicación → 3.2 Empleado Digital → 3.3 Automatizaciones → 3.4 Recepcionista IA → 3.5 Coordinador de Agenda IA.

- Entregable 3.0 — Infraestructura de Eventos — ✅ Completado (2026-07-03). Contexto Eventos nuevo (`domain-model-v1.md` §12): certifica hechos de negocio como Evento de Dominio inmutable; Catálogo global de Tipos de Evento; certificación de `CitaCompletada` integrada de forma aditiva sobre el dispatcher del Puente, sin tocarlo. Mecanismo de entrega asíncrona hacia consumidores futuros (Automatizaciones, 3.3) queda como decisión diferida. Ver `docs/history/ENTREGABLE_3_0_COMPLETION_REPORT.md`.
- Entregable 3.1 — Comunicación — ✅ Completado (2026-07-04). Contexto Comunicación nuevo (`domain-model-v1.md` §10): todo mensaje saliente (bot, recordatorios, respuesta manual, campañas) pasa exclusivamente por el caso de uso Enviar Mensaje — cero llamadas directas a `sendWhatsAppMessage` fuera de `contexts/communication/infrastructure/`, verificado por grep exhaustivo. `Conversation`/`Message` evolucionaron sin duplicarse. Ver `docs/history/ENTREGABLE_3_1_COMPLETION_REPORT.md`.
- Entregable 3.2 — Empleado Digital — ✅ Completado (2026-07-04). Contexto Empleados Digitales nuevo (`domain-model-v1.md` §9): `DigitalEmployee`, `AgentAutonomyLimit`, `AgentTask`, `AgentDecision`, `Escalación` — andamiaje auditable, tenant-scoped, sin integración obligatoria con Comunicación ni Eventos en este entregable (diferida al primer agente real, 3.4). Ver `docs/history/ENTREGABLE_3_2_COMPLETION_REPORT.md`.
- Entregable 3.3 — Automatizaciones — ✅ Completado (2026-07-04). Contexto Automatizaciones nuevo (`domain-model-v1.md` §8): `AutomationRule`, `AutomationTemplate`, `AutomationExecution` — primer contexto de Fase 3 que depende, por diseño, de Comunicación y Empleados Digitales (invoca exclusivamente sus casos de uso ya expuestos, cero consultas cruzadas para reconstruir datos fuera del contrato del Evento); primer consumidor real del mecanismo de Entrega de Evento de 3.0. Ver `docs/history/ENTREGABLE_3_3_COMPLETION_REPORT.md`.
- Entregable 3.4 — Recepcionista IA — ✅ Completado (2026-07-06). Primer Empleado Digital real (`domain-model-v1.md` §9): sin entidades ni bounded contexts nuevos — es exclusivamente la especialización `"recepcionista"` de `DigitalEmployee`. El motor conversacional de WhatsApp permanece intacto, envuelto por `LegacyWhatsappEngineAdapter` — cero llamadas directas fuera de los dos puntos previstos, verificado por grep exhaustivo. Resuelve la brecha real de escalamiento humano (nunca llegaba a `Conversation.status`). Ver `docs/history/ENTREGABLE_3_4_COMPLETION_REPORT.md`.
- Entregable 3.5 — Coordinador de Agenda IA — ✅ Completado (2026-07-06). Segundo Empleado Digital real (`domain-model-v1.md` §9): sin entidades ni bounded contexts nuevos — es exclusivamente la especialización `"coordinador_agenda"` de `DigitalEmployee`. Da auditoría real al job diario de recordatorios (`jobs/reminder.job.js`); `reminder.service.js` permanece intacto, envuelto por `ReminderEngineAdapter` — cero llamadas directas fuera del adaptador previsto, verificado por grep exhaustivo. Cierra el roadmap interno de la Fase 3. Ver `docs/history/ENTREGABLE_3_5_COMPLETION_REPORT.md`.
- **Fase 3 completa (3.0 → 3.5).**

## Fase 4 — Plataforma Comercial (en curso)

**Objetivo estratégico** (separado del backlog de deuda técnica): convertir el Sistema Operativo Veterinario, ya consolidado para un único negocio, en una plataforma SaaS capaz de operar múltiples establecimientos de forma autónoma — onboarding, configuración y facturación sin intervención del equipo de desarrollo. Ver `docs/PLAN_MAESTRO.md` sección Fase 4 para la separación completa entre objetivo estratégico y backlog arquitectónico transversal.

**Roadmap interno:** 4.1 Saneamiento Tenant-Blind → 4.2 Onboarding Autónomo → 4.3 Configuración por Establecimiento → 4.4 Facturación / Habilitación Comercial del SaaS.

- Entregable 4.1 — Saneamiento Tenant-Blind — ✅ Completado (2026-07-09). Único ítem del backlog de deuda técnica (Auditoría v2.1.0: A6, M4, B2, M1) promovido a esta fase, por ser precondición dura del objetivo comercial. `Appointment.availabilityBucket` + índice único parcial reemplaza la verificación no atómica de conflicto de reserva (A6, reconciliado a bucket de servicio, no `staffId`); recordatorios procesados por tenant explícito (M4, reconciliado: acotado a consumidores externos al motor conversacional, que permanece intacto); mensaje entrante con tenant no resuelto rechazado explícitamente (B2); `User.phone` con unicidad por tenant (M1). Cero cambios en `whatsapp.service.js`/`conversation.service.js`/`scheduling.service.js`/`webhook.controller.js`, verificado por grep exhaustivo y `git diff --stat`. Ver `docs/history/ENTREGABLE_4_1_COMPLETION_REPORT.md`.
- Entregable 4.2 — Onboarding Autónomo — ✅ Completado (2026-07-09). Cierra la brecha de que el registro de un tenant no sembraba ningún `DigitalEmployee`, dependiendo de un script manual. `tenant-provisioning.service.js` (nuevo) es el único punto responsable del aprovisionamiento automático de `recepcionista`/`coordinador_agenda`; `scripts/seed-digital-employees.js` reutiliza ese servicio, sin lógica duplicada, verificado por grep exhaustivo. Decisión de arquitectura congelada: `Tenant` no se reemplaza ni renombra en este entregable — el Contexto Negocio completo (Modelo de Dominio §1: `Establecimiento`, `Módulo`, `Configuración del Negocio`) queda diferido íntegramente al Entregable 4.3. Ver `docs/history/ENTREGABLE_4_2_COMPLETION_REPORT.md`.
- Entregable 4.3 — Configuración por Establecimiento — ✅ Completado (Alcance A, 2026-07-09) — Alcance B diferido por Reconciliación Arquitectónica. `business-config.service.js` (nuevo) es la única fuente de verdad para módulos activos y tasa de split de comisión por tenant, reemplazando dos `PrismaBusinessConfigReader` duplicados (Servicios, Staff) que devolvían valores hardcodeados; ningún puerto ni caso de uso cambió su contrato, verificado por grep exhaustivo. **Horarios de atención y zona horaria no fueron implementados deliberadamente**: exigirían modificar `scheduling.service.js`/`availability.service.js`, violando el principio "no reescribir el motor conversacional" institucionalizado desde 3.4 — queda como deuda diferida. Ver `docs/history/ENTREGABLE_4_3_COMPLETION_REPORT.md`.

## Fase 2 — Sistema Operativo del Negocio (✅ Completa, alcance re-declarado por ADR 006)

**Objetivo:** Capa de casos de uso, entidades faltantes del dominio operativo, reportes financieros.

**Fuera del alcance de esta fase:** nuevos canales, motor de automatizaciones, mejoras al agente de WhatsApp, multitenancy, Dominio Clínico — y (re-declarado por el ADR 006) la exposición de los casos de uso a canales y operadores.

**Estado del roadmap interno** (ver `docs/PLAN_MAESTRO.md`, sección Fase 2):
- Entregable 2.1 — Catálogo de Servicios como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`)
- Entregable 2.2 — Staff como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`)
- Entregable 2.3 — Finanzas como Sistema Operativo — ✅ Completado (`docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`)
- Entregable puente — Exposición del Sistema Operativo — ✅ Completado (remediación de la auditoría v2.1.0; ADRs 007/008/009 implementados; ver `docs/history/AUDITORIA_V2_1_0_CIERRE.md`)

**Reconciliación ADR 006 (2026-07-02) — resuelta:** la exposición pendiente que el ADR 006 identificó fue completada por el Entregable Puente: los casos de uso de Servicios, Staff y Finanzas están expuestos vía rutas del dashboard; Completar Cita es un comando del contexto Agenda que publica `CitaCompletada` (dispatcher síncrono en la misma transacción → comisión + cobro de sistema); el legacy sustituido (`commission.service.js`, `service.service.js`, `staff.service.js`) fue retirado. Las decisiones de dominio C2/A1/A4 quedaron resueltas en los ADRs 007/008/009 e implementadas. Antes de la Fase 3 corresponde el mapa conceptual solicitado por el responsable del proyecto.