# Cierre del Entregable — Certificación de los 5 Eventos de Empleados Digitales (precondición de Ecosistema)

**Fecha:** 2026-08-11
**Bloque:** Ecosistema (post-Fase 6) — precondición identificada en la Macroetapa 1 de Ecosistema, priorizada antes de cualquier iniciativa (API pública, canales, apps).
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.23.0`.
**Naturaleza del entregable:** cierre de una deuda técnica explícita y trazada, heredada de 5.2 — no introduce capacidad nueva ni modifica ningún contrato existente.

---

## Objetivo del entregable

Desde el Entregable 5.2 (Certificación Real de Eventos por Contexto), 5 eventos del ciclo de vida de tareas de Empleados Digitales (`TareaIniciada`, `TareaCompletada`, `DecisiónRegistrada`, `EscalaciónGenerada`, `EscalaciónAtendida`) quedaban documentados como deuda técnica: sus modelos (`AgentTask`, `AgentDecision`, `Escalation`) no tienen columna `tenantId` propia, y el extractor genérico del publisher no podía resolverlo sin una consulta adicional, fuera del alcance aprobado entonces. La auditoría de Macroetapa 1 de Ecosistema recomendó explícitamente resolver esto antes de iniciar cualquier iniciativa de Ecosistema.

## Diseño congelado (Macroetapa 1)

La auditoría encontró que **el `tenantId` ya está resuelto en memoria en el momento exacto de cada `publish()`**, gracias a joins que ya existen por otras razones (validación de estado en 3.2, autorización cross-tenant en 6.5) — no se requiere ninguna consulta nueva, ni columna nueva, ni cambio al extractor genérico. El diseño se limitó a agregar `tenantId` como campo hermano en el `payload` ya construido en cada uno de los 5 emisores, replicando el mismo patrón que 5.2 ya usó para otros 4 eventos con el mismo problema.

Hallazgo adicional de la auditoría: los 5 emisores no son código muerto — están conectados en producción desde 3.4 (`process-incoming-message.usecase.js`, Recepcionista IA) y desde 6.5 (`POST /escalations/:id/attend`).

## Checkpoint de contradicción (previo a Macroetapa 2)

Ninguno. El estado del código en el momento de iniciar la implementación coincidía exactamente con lo auditado (`git status --short` limpio antes de editar).

## Resumen de implementación

Cinco cambios de una línea cada uno, todos dentro de `backend/src/contexts/agents/application/use-cases/`:

| Archivo | Cambio |
|---|---|
| `start-agent-task.usecase.js` | `tenantId: employee.tenantId` |
| `complete-agent-task.usecase.js` | `tenantId: task.digitalEmployee?.tenantId ?? null` |
| `register-agent-decision.usecase.js` | `tenantId: task.digitalEmployee?.tenantId ?? null` |
| `generate-escalation.usecase.js` | `tenantId: task.digitalEmployee?.tenantId ?? null` |
| `attend-escalation.usecase.js` | `tenantId: ownerTenantId` (variable ya calculada por el checkpoint de autorización de 6.5) |

**Sin cambios en `certifying-domain-event-publisher.js`, `agents-domain-events.publisher.js`, ningún repositorio, ninguna ruta, `prisma/schema.prisma`, ni el motor conversacional.**

**Tests nuevos (`backend/src/contexts/agents/__tests__/certifying-agent-task-events.usecase.test.js`, 8 tests):**
- Los 5 emisores certificados explícitamente: cada uno verifica que `eventPublisher.publish(eventName, payload)` recibe el `tenantId` esperado, de la fuente exacta documentada en el diseño.
- **Aislamiento verificado activamente:** dos Empleados Digitales de distinto tenant producen `tenantId` distinto en el evento — el valor certificado nunca es fijo ni cruzado entre tenants.
- **Caso límite defensivo:** si el join no trae `digitalEmployee` (dato incompleto), el `tenantId` certificado es `null`, nunca un valor inventado o heredado de otra entidad — mismo comportamiento seguro que el extractor genérico ya tenía para el resto de eventos sin `tenantId` resoluble.
- **Contrato del use case intacto:** el valor de retorno de `start-agent-task.usecase.js` no incluye `tenantId` — solo el payload interno pasado a `publish()` lo lleva; ningún consumidor externo del use case ve un campo nuevo.

## 1. Validación Técnica

- **Suite completa:** **90/90 suites · 568/568 tests** en verde (antes 89/89 · 560 — +1 suite, +8 tests, cero regresiones).
- `git diff --stat -- prisma/` vacío.
- `git diff --stat` total: 5 archivos de producción modificados (1 línea cada uno) + 1 archivo de test nuevo.

## 2. Validación Funcional (grep exhaustivo)

- `grep` de los 5 nombres de evento contra sus emisores confirma que **los 5** incluyen `tenantId` en el payload publicado — ninguno quedó sin certificar.
- Ningún emisor adicional de estos eventos existe en el repositorio (búsqueda exhaustiva por los 5 nombres, sin resultados fuera de los 5 archivos ya modificados y `seed-event-types.js`, que solo registra los `EventType`, sin publicar).

## 3. Validación de Invariantes

- **`TareaIniciada` → `employee.tenantId`** — verificado.
- **`TareaCompletada` → `task.digitalEmployee.tenantId`** — verificado.
- **`DecisiónRegistrada` → `task.digitalEmployee.tenantId`** — verificado.
- **`EscalaciónGenerada` → `task.digitalEmployee.tenantId`** — verificado.
- **`EscalaciónAtendida` → `ownerTenantId`** — verificado.
- **El tenantId certificado es siempre el del establecimiento propietario, nunca de otra entidad o tenant** — verificado activamente con dos Empleados Digitales de tenants distintos produciendo eventos con `tenantId` distinto entre sí.
- **Comportamiento legítimo del caso interno preservado:** ningún contrato de entrada/salida de los 5 use cases cambió — mismos parámetros, mismos valores de retorno, mismas excepciones. El único cambio observable es el payload interno que llega al publisher, invisible para cualquier llamador existente.

## 4. Validación Arquitectónica

- **Sin Reconciliación Arquitectónica** — ninguno de los 5 archivos protegidos del motor conversacional fue tocado (confirmado por `git diff --stat`).
- **`certifying-domain-event-publisher.js` y `agents-domain-events.publisher.js` sin cambios** — confirmado.
- **Ningún repositorio, ninguna ruta, ningún otro contexto tocado** — confirmado.
- **Sin cambios de schema ni migraciones** — confirmado.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación de la Macroetapa 2 coincidió exactamente con el diseño congelado en la Macroetapa 1.

## Versionado

Versión declarada del proyecto actualizada de `2.22.0` a `2.23.0`. A diferencia de los entregables de saneamiento cross-tenant de la Fase 6, este cierra una deuda técnica de certificación de eventos — pero el mismo criterio de "cambio funcional relevante" (`CLAUDE.md`) aplica: 5 eventos que antes se omitían de forma determinística ahora producen filas reales de `DomainEvent`, un cambio de comportamiento observable en producción (cada conversación de WhatsApp procesada por Recepcionista IA). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva del estado real de los 5 eventos antes de proponer diseño.
- ✅ Diseño mínimo verificado con evidencia (tenantId ya en memoria, sin consulta nueva).
- ✅ Sin contradicciones ni checkpoints necesarios en ninguna macroetapa.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional, publisher genérico, publisher de contexto, repositorios y rutas sin cambios — verificado por `git diff --stat` y grep exhaustivo.
- ✅ Suite completa en verde (90/90 · 568/568).
- ✅ Macroetapa 4 (versionado a `2.23.0`, commit, tag, push) completada — ver commit y tag correspondientes.
