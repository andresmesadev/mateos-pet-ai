# Acta de Cierre — Auditoría Técnica y Arquitectónica v2.1.0

**Fecha de cierre:** 2026-07-02
**Alcance de la auditoría:** repositorio completo sobre el tag `v2.1.0` (Fase 2 cerrada). 20 hallazgos, todos validados con evidencia reproducible (greps, base de datos real, tooling de Prisma).
**Vehículos de remediación:** parches directos (commit `19d8ee4`), cuatro ADRs (006–009) y el **Entregable Puente — Exposición del Sistema Operativo** (Regla de Ejecución completa, Etapas 1–5 aprobadas y congeladas, implementado y validado en esta acta).

---

## 1. Resolución de los 20 hallazgos

### Críticos

| # | Hallazgo | Resolución |
|---|---|---|
| C1 | Capa de casos de uso de Fase 2 no cableada; declaración de cierre contradicha por el código | **Resuelto en dos actos.** (1) Reconciliación Arquitectónica ADR 006: el cierre de la Fase 2 se re-declaró (capa entregada y validada; exposición fuera de su alcance real). (2) Entregable Puente: los casos de uso de Servicios, Staff y Finanzas quedaron expuestos vía rutas del dashboard; el legacy sustituido (`commission.service.js`, `service.service.js`, `staff.service.js`) fue **retirado**; ningún canal orquesta reglas de negocio de esos contextos. |
| C2 | Cierres financieros consolidarían ingreso sin servicios (`Transaction` de sistema nunca creada) | **Resuelto por ADR 007 + implementación.** `CitaCompletada` existe: el comando Completar Cita (contexto Agenda, nuevo) la publica en un dispatcher in-process; Staff registra la comisión y Finanzas el cobro de sistema **en la misma transacción** — si un reactivo falla, la cita no queda completada. Doble red: `GenerateDailyCloseUseCase` rechaza el cierre si alguna cita completada del día no tiene cobro de sistema (`IncompleteDailyCloseError`). |
| C3 | Historial de migraciones no reconstruye la BD | **Resuelto (commit `19d8ee4`).** Baseline `20260702000000_baseline_fase1_final_y_fase2` + `migrate resolve`; verificado con `migrate status` y `migrate diff` limpios. La migración del Puente (`20260702120000_puente_anulacion_commission_transaction`) entró por el historial oficial con `migrate deploy` — nunca más `db push`. |

### Altos

| # | Hallazgo | Resolución |
|---|---|---|
| A1 | Día UTC vs Bogotá; universos mezclados en `daily-close` | **Resuelto por ADR 008 + implementación.** Día financiero = día civil del negocio; `lib/timezone.js` fuente única (`contexts/shared/business-day.js`); etiqueta canónica `T00:00Z`; el endpoint devuelve cada sección desde un único universo (`commissions` = universo Commission con su significado histórico; `income` = sección aditiva con el hecho oficial). |
| A2 | Generación de período no atómica | **Resuelto.** `GenerateFinancialPeriodUseCase` corre creación + asignación + verificación de conteo dentro de una Unidad de Trabajo (`prisma.$transaction`); el mismatch hace rollback completo. Test del camino real incluido. |
| A3 | Escalada de tenant vía `?tenantId=` en el proxy | **Resuelto (commit `19d8ee4`).** Query param solo para superadmin. |
| A4 | `Commission` incorregible | **Resuelto por ADR 009 + implementación.** Patrón de anulación (`status/voidedAt/voidReason/replacesCommissionId`), comando único atómico `VoidCommission` (Staff) con fronteras (día cerrado, liquidación activa), índice único parcial "una activa por cita". El `catch → null` silencioso desapareció con el retiro de `commission.service.js`. |
| A5 | Onboarding/billing públicos sin protección | **Resuelto (commit `19d8ee4`).** `publicRateLimit` en ambos mounts. Fricción anti-abuso adicional (captcha/verificación) queda como deuda registrada previa a campañas de captación. |
| A6 | Doble reserva TOCTOU en Agenda | **Deuda registrada.** Pertenece al futuro entregable que lleve Agenda completa a su capa de casos de uso. No bloqueaba el cierre (clasificación del acta de validación). |

### Medios

| # | Hallazgo | Resolución |
|---|---|---|
| M1 | Unicidades con `tenantId NULL` | **Resuelto en Finanzas** (los cuatro comandos de hechos financieros rechazan tenant nulo — `MissingTenantError`). La obligatoriedad de columna queda para multitenancy (Fase 5). |
| M2 | `/api/test` sin auth en producción | **Resuelto (commit `19d8ee4`).** Gate por `NODE_ENV`. |
| M3/M9 | Gastos por doble vía | **Resuelto.** `POST /expenses` delega en `RegisterExpenseUseCase` (con `responsible` y guard de día civil cerrado); `POST /expenses/:id/void` expone la anulación; el dashboard expone `status` y las vistas en vivo consolidan solo hechos activos (misma regla que el cierre). Formulario del POS actualizado (campo Responsable). |
| M4 | Disponibilidad/recordatorios tenant-blind | **Deuda registrada** — precondición del alta de un segundo tenant (Fase 5). |
| M5 | Regla `apiUrl` contradicha | **Resuelto documentalmente.** La regla de CLAUDE.md ahora describe el alcance real (cliente vs. servidor; onboarding público como excepción documentada). |
| M6 | Eventos solo-log | **Resuelto parcialmente por diseño.** El dispatcher real existe y `CitaCompletada` fluye con entrega síncrona transaccional (decisión de Etapa 2). Los demás eventos de dominio siguen siendo log-only hasta que la Fase 3 (Automatizaciones) los consuma — estado documentado en los propios publishers. |
| M7 | Agregación en memoria (cohortes) | **Deuda registrada** — criterio de escala para Fase 5. Las sumas de dinero ya agregan en SQL. |
| M8 | Tests no cubrían la superficie real | **Resuelto e institucionalizado.** Suite `puente-money-paths.test.js` + tests de `POST /appointments/:id/complete`: todo camino de dinero tiene test HTTP → caso de uso → persistencia. El criterio queda incorporado al Entregable Puente como precedente para futuros entregables. |

### Bajos

| # | Hallazgo | Resolución |
|---|---|---|
| B1 | Higiene del release (comentarios test en schema, middleware/middlewares, docs/product vacío) | **Parcial:** los comentarios del schema se retiran en el commit de cierre; la unificación de middleware y docs/product quedan como limpieza oportunista registrada. |
| B2 | Webhook procesa mensajes sin tenant | **Deuda registrada** — junto con M1/Fase 5; inocuo con una sola línea de WhatsApp. |

## 2. El Entregable Puente — resumen de lo implementado

> **Registro oficial del diseño:** por decisión del proyecto durante la remediación de la auditoría v2.1.0, el diseño del Entregable Puente (Etapas 1–5 de la Regla de Ejecución: Definición Funcional, Casos de Uso, Arquitectura Técnica, Modelo de Persistencia y Esquema Físico — aprobadas y congeladas una a una por el responsable del proyecto) quedó **consolidado en este documento**, que constituye el registro oficial de esas etapas y sustituye a los documentos separados por entregable, para optimizar el proceso de remediación.

- **Schema/migración:** patrón de anulación en `Commission` y `Transaction` (homogéneo, decisión de Etapa 3); `Appointment.commission` → `commissions`; índices únicos parciales (`WHERE status='active'`) que especializan las invariantes ADR 005/009. Backup previo; `migrate deploy`; BD ≡ schema verificado.
- **Contexto Agenda (nuevo, mínimo):** `CompleteAppointmentUseCase` — transición validada, precio resuelto obligatorio (ADR 007-D4, cero válido/indeterminado no), publica `CitaCompletada`.
- **Dispatcher** (`contexts/shared/events/`) + **Unidad de Trabajo** (`prisma.$transaction`): entrega síncrona en la misma transacción del comando; root de integración (`contexts/index.js`) como único lugar que conoce las suscripciones.
- **Staff:** `VoidCommission` (ADR 009); liquidaciones, disponibilidad, ausencias y capacidades expuestas; comisiones activas como único universo de consolidación.
- **Finanzas:** día civil (ADR 008) en gastos, cierres, historial; verificación de completitud (ADR 007-D2); atomicidad del período (A2); rechazo de tenant nulo (M1); casos POS (liquidar cobro — nunca el monto; guard de venta vinculada = extras; anulación de venta manual).
- **HTTP:** ~15 rutas nuevas o reescritas; contratos existentes preservados (campos nuevos aditivos); `PATCH` de citas rechaza `completed` dirigiendo al comando nuevo; frontend adaptado (completar cita, formulario de gastos).
- **Legacy retirado:** `commission.service.js`, `service.service.js`, `staff.service.js`.

## 3. Validación

- **Técnica:** migración aplicada y verificada (índices parciales presentes, 100% filas `active`); suite completa **47/47 suites · 303/303 tests** en verde; smoke test HTTP de solo lectura contra la base real (7 endpoints, todos 200, contratos preservados); typecheck del frontend sin errores nuevos (persisten 2 preexistentes ajenos: artefacto stale de `.next/types` y tipos duplicados `InactiveClient`).
- **Funcional:** los 25 casos de uso de la Etapa 2 del Puente están expuestos o suscritos. Desviaciones deliberadas, documentadas en el código del adaptador: (a) `RegisterExpense` acepta `description/paymentMethod/notes` como passthrough del contrato del canal; (b) en el POST de servicios, `basePrice` omitido se materializa como 0 (el dominio exige precio no nulo; el cero es un precio resuelto — ADR 007-D4); (c) `requiresAppointment` y la reactivación de servicios son passthrough del adaptador (sin caso de uso en 2.1 — deuda registrada); (d) el campo legado `Staff.availability` (JSON) sigue el ADR 003 (passthrough, sin sincronización); (e) el reactivo de comisión no aplica a citas sin staff/servicio (precondición del caso de uso, no un fallo silencioso — queda logueado).

## 4. Deuda oficial registrada (con dueño)

Hallazgos de la auditoría que permanecen abiertos, **diferidos a fases posteriores**:

1. **A6** (TOCTOU de reservas) + **M4** (disponibilidad/recordatorios tenant-blind) + **B2** (webhook procesa mensajes sin tenant) → futuro entregable de Agenda / precondición del alta de un segundo tenant (Fase 5).
2. **M5** (residual): la regla de `CLAUDE.md` ya describe el alcance real; la eventual migración del onboarding público a un proxy propio queda como mejora opcional, no requerida.
3. **M7** (cohortes/churn/recovery agregados en memoria) → criterio de escala, Fase 5.
4. **B1** (restante): unificación `middleware/`–`middlewares/` y `docs/product/` vacío → limpieza oportunista.
5. Anulación del cobro de sistema (campos existen; comando fuera de alcance — Etapa 4) + corrección de hechos en días/períodos cerrados (pregunta heredada de 2.3) → decisión de dominio previa a cualquier automatización financiera de Fase 3 que corrija dinero.
6. Split configurable → contexto Negocio (ADR 009).
7. Fricción anti-abuso en onboarding (captcha/verificación) → antes de campañas de captación.
8. Reactivación de servicio y homogeneización del patrón de anulación en `Expense` → oportunistas.

**Ninguno de estos hallazgos es bloqueante: quedan diferidos con dueño y no impiden el inicio de la Fase 3.**

## 5. Declaración de cierre

Con los hallazgos Críticos y Altos resueltos (o reconciliados con deuda explícita y dueño), las decisiones de dominio tomadas en los ADRs 007/008/009 implementadas y validadas, y el criterio de cierre de la Fase 2 ahora **verificablemente cumplido** (ningún canal orquesta reglas de negocio de Servicios, Staff o Finanzas; el operador puede gestionar gastos, cierres, períodos, liquidaciones y correcciones desde la plataforma), **la auditoría v2.1.0 queda oficialmente cerrada**.

La Fase 3 queda desbloqueada. Su primer paso, por instrucción del responsable del proyecto y por recomendación de la retrospectiva de la Fase 2, es el **mapa conceptual de la Fase 3** — en una sesión dedicada.
