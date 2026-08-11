# Fase 6 — Informe de Cierre Oficial y Retrospectiva
## Operación Multi-Establecimiento Real · Plataforma Operativa Inteligente · Mateos Pet

**Fecha de cierre:** 2026-08-11
**Nombre de la fase:** Operación Multi-Establecimiento Real
**Estado:** ✅ Completada
**Versión de cierre:** `v2.22.0`
**Alcance:** Entregables 6.1 (Reconciliación del Modelo de Establecimiento), 6.2 (Agenda Multi-Establecimiento), 6.3 (Staff Multi-Establecimiento), 6.4 (Finanzas por Establecimiento), 6.5 (Automatizaciones y Empleados Digitales Multi-Establecimiento), 6.6 (Operación Centralizada, Fase B + Fase A) — la fase completa, no un entregable individual.

---

## 1. Objetivo de la Fase

### El problema que buscábamos resolver

Al cierre de la Fase 4, la plataforma podía onboardear un segundo establecimiento de forma autónoma, pero no operarlo como un negocio genuinamente independiente: `Tenant.businessHours` existía en el schema desde antes de 4.3 sin que ningún servicio lo consultara; `Tenant` nunca había sido reconciliado formalmente con el `Establecimiento` del modelo de dominio; y no existía evidencia de que el aislamiento entre establecimientos estuviera realmente aplicado en todos los contextos operativos (Staff, Finanzas, Automatizaciones, Empleados Digitales), más allá de en Agenda. La plataforma operaba, en la práctica, sobre un único negocio real — la Fase 6 cierra esa brecha antes de cualquier exposición mediante un ecosistema externo.

### Por qué era importante resolverlo ahora, y no antes

Antes de iniciar cualquier entregable, se auditó formalmente si el sistema requería introducir una entidad "Organización" superior a `Tenant`. Se descartó por falta de evidencia funcional (2026-07-27) — decisión congelada para toda la fase y para el resto del proyecto, salvo requerimiento funcional nuevo y explícito documentado primero en el modelo de dominio. El Establecimiento (`Tenant`) se mantiene como la única unidad de aislamiento del sistema.

---

## 2. Entregables

### 6.1 — Reconciliación del Modelo de Establecimiento
**Resultado:** ✅ Completado (2026-07-27, entregable documental, sin bump de versión)

Cerró la deuda heredada de 4.2/4.3: `domain-model-v1.md` §1 declara ahora explícitamente que `Tenant` **es** la implementación de Establecimiento, sin entidad `Organización` ni renombramiento físico (432 ocurrencias del nombre en 115 archivos, descartado por evidencia). Resolvió la disposición de cada campo pendiente del dominio: "tipo de negocio" redundante con `activeModules`; horarios/zona horaria diferidos explícitamente a 6.2; país/moneda a backlog sin fecha; mensajes de bienvenida reasignados al backlog de Comunicación (3.1). Cero cambios de código, schema o migraciones.

### 6.2 — Agenda Multi-Establecimiento
**Resultado:** ✅ Completado (2026-07-28, v2.17.0)

Aplicó horario de atención real por establecimiento (`Tenant.businessHours`) al flujo completo de reserva por WhatsApp — zona horaria quedó explícitamente fuera de alcance, backlog sin fecha. Primera y única **Reconciliación Arquitectónica puntual real de la fase**: el patrón de wrapper de 4.3/6.1 no bastaba porque los consumidores viven dentro de archivos protegidos desde 3.4. Alcance ampliado en 3 checkpoints, todos reportados y autorizados antes de implementarse: transporte de `tenantId` hasta `whatsapp.service.js`/`conversation.service.js`; `availability-db.service.js` como segundo consumidor real; cierre de un bypass real en `checkAppointmentConflict`, detectado por grep exhaustivo en la Macroetapa 3. Sin configuración de establecimiento, el comportamiento es exactamente el legado.

### 6.3 — Staff Multi-Establecimiento
**Resultado:** ✅ Completado (2026-07-28, v2.18.0)

El modelo de datos ya soportaba multi-establecimiento desde su nacimiento (`Staff.tenantId`, 2.2) — la brecha real era de aplicación: `PrismaStaffRepository.findById` sin filtro de tenant en 9 de 13 casos de uso, y 3 rutas HTTP sin ningún chequeo. Cerrado replicando el patrón canónico de `void-commission.usecase.js` (ADR 009). Mismo tipo de entregable que 4.1: sin capacidad funcional nueva. Índice `@@index([tenantId])` en `Staff` queda diferido como deuda de rendimiento explícita.

### 6.4 — Finanzas por Establecimiento
**Resultado:** ✅ Completado (alcance reducido, 2026-07-28, v2.19.0)

Auditoría encontró que Finanzas ya cumplía el aislamiento por establecimiento (saneado en el Entregable Puente, Fase 2, ADR 007/008/009). "Consolidadas" (parte del nombre original) se removió explícitamente del alcance y se remitió a 6.6, para evitar duplicación. Cerrada la única inconsistencia real encontrada (`guard-manual-sale-link.usecase.js`) y completada la cobertura de tests faltante para el módulo POS.

### 6.5 — Automatizaciones y Empleados Digitales Multi-Establecimiento
**Resultado:** ✅ Completado (renombrado en su propia Macroetapa 1, 2026-08-10, v2.20.0)

La infraestructura reactiva de Automatizaciones ya soportaba correctamente reglas por tenant + globales — sin hueco. El trabajo real: 3 huecos de autorización cross-tenant en `AutomationRule` más 6 huecos equivalentes en Empleados Digitales (`AgentTask`, `AgentDecision`, `Escalation`, `DigitalEmployee` — contexto distinto de Automatizaciones, no asignado a ningún entregable del roadmap). Checkpoint de contradicción reportado y resuelto: ambos bloques se incluyeron en un único entregable renombrado. Introdujo el **patrón de verificación por `include` anidado** para entidades sin columna `tenantId` propia — sin migración.

### 6.6 — Operación Centralizada (Fase B + Fase A)
**Resultado:** ✅ Completado (Fase B: 2026-08-10, v2.21.0; Fase A: 2026-08-11, v2.22.0)

El roadmap definía 6.6 sin especificación funcional real. La auditoría encontró que la "visibilidad de todos los establecimientos" **ya existía, de forma accidental**: el patrón `tenantId ? {...} : {}`, replicado en 13 repositorios de 6+ contextos, otorgaba una vista cross-tenant sin filtro a cualquier superadmin sin `tenantId`. Decisión adoptada: enfoque **"B luego A"**.

- **Fase B** cerró el riesgo de seguridad en un único choke point compartido (`resolveTenant.js`), sin modificar ninguno de los 13 repositorios: un superadmin sin `tenantId` ahora debe declarar la intención explícitamente (`X-View-All-Tenants`) o es rechazado con 403.
- **Fase A** formalizó la capacidad administrativa deliberada: `GET /api/dashboard/tenants/overview`, solo lectura, agregado por tenant (usuarios, citas, conversaciones, ingresos, gastos, neto), gateado exclusivamente por `req.tenant.viewAllTenants`. `Commission`/payroll y `DailyClose` quedaron fuera de alcance por decisión explícita. Checkpoint de contradicción con el hook `block-apiurl.sh` (bloquea el patrón sancionado en `CLAUDE.md` para Server Components) resuelto routeando la página a través del proxy Next.js, sin modificar el hook.

---

## 3. Decisiones arquitectónicas permanentes de la fase

### Establecimiento (`Tenant`) como única unidad de aislamiento — "Organización" descartada

Auditada y descartada formalmente el 2026-07-27, antes del primer entregable. Ningún principio del producto, decisión estratégica fundacional, ni el modelo de dominio exige, sugiere o anticipa que un mismo cliente administre múltiples establecimientos desde una única cuenta. **Vigente para todas las fases futuras** — no debe reabrirse sin un requerimiento funcional nuevo y explícito, documentado primero en el modelo de dominio.

### El principio "no reescribir el motor conversacional" absorbió su tercera prueba de presión, y esta vez se aceptó abrirlo — de forma puntual y controlada

4.1 y 4.3 (Fase 4) habían preferido diferir antes que tocar el motor. La advertencia arquitectónica dejada explícitamente por `PLAN_MAESTRO.md` exigía que 6.2 decidiera, con evidencia, en vez de diferir por tercera vez. 6.2 aceptó una **Reconciliación Arquitectónica puntual y acotada**: tocó `whatsapp.service.js`/`conversation.service.js`/`availability-db.service.js` para transportar `tenantId` real, bajo tres checkpoints explícitos, sin reescribir el motor — solo parametrizarlo. Es la única vez en toda la fase que un archivo protegido fue modificado.

### Patrón canónico de verificación de propiedad de tenant, replicado sin variación

Originado en `void-commission.usecase.js` (ADR 009, Fase 2), replicado idénticamente en 4.1, 6.3, 6.4, 6.5: `if (!x || (tenantId && x.tenantId !== tenantId)) throw new XNotFoundError(...)`. Ningún entregable de la fase inventó una variante nueva para entidades con columna `tenantId` propia.

### Extensión del patrón canónico a entidades sin `tenantId` propio, vía `include` anidado

6.5 resolvió `AgentTask`/`AgentDecision`/`Escalation` (sin columna `tenantId` propia) extendiendo el `findById` del repositorio Prisma con un `include` anidado hasta la entidad que sí tiene `tenantId`, sin migración. Mismo mecanismo que `listPending` (`Escalation`) ya usaba desde antes de 6.5 — reutilizado, no reinventado.

### Cierre de seguridad en el choke point compartido, no en cada consumidor

6.6 Fase B estableció el patrón: cuando N repositorios comparten un defecto de diseño pero todos pasan por un único middleware, el cierre correcto vive en ese middleware (`resolveTenant.js`), no en cada uno de los N repositorios. Redujo la superficie de cambio de 13+ archivos a 3, con el mismo resultado de seguridad — verificado por checkpoint explícito antes de implementarse.

### El criterio de versionado se aplicó de forma consistente en toda la fase

Cerrar un hueco real de autorización cross-tenant, o introducir una capacidad administrativa nueva, es siempre un cambio de comportamiento — independientemente de la superficie de código afectada. Aplicado sin excepción: 6.2 (v2.17.0) → 6.3 (v2.18.0) → 6.4 (v2.19.0) → 6.5 (v2.20.0) → 6.6 Fase B (v2.21.0) → 6.6 Fase A (v2.22.0). Solo 6.1, por ser puramente documental, quedó exento (mismo criterio que 6.1 de la Fase 2 y el ADR de versionado de `CLAUDE.md`).

---

## 4. Deudas deliberadamente diferidas al cierre de la Fase 6

- **Zona horaria de `Tenant`** — backlog sin fecha (diferida en 6.1, reafirmada en 6.2; blast radius estimado de 9 archivos, sin necesidad evidenciada hoy).
- **País/moneda de `Tenant`** — backlog sin fecha (diferida en 6.1).
- **Catálogo real de Módulo con metadata** (`Tenant.activeModules` sigue siendo un arreglo plano) — backlog arquitectónico general, sin entregable asignado, salvo necesidad futura evidenciada.
- **Índice `@@index([tenantId])` en `Staff`** — deuda de rendimiento explícita, diferida en 6.3.
- **5 eventos del ciclo de vida de Empleados Digitales sin certificación determinística** (`AgentTask`/`AgentDecision`/`Escalation` no persisten `tenantId` propio) — deuda heredada de la Fase 5 (5.2), no resuelta por la Fase 6; 6.5 trabajó *alrededor* de esta ausencia (verificación vía `include` anidado) sin resolverla en su origen.
- **6.6 Fase A, alcance v1 deliberadamente mínimo**: sin filtros de fecha, sin paginación, sin agregación de `Commission`/payroll, sin `DailyClose` como fuente — ampliable en el futuro si aparece necesidad real, no construido preventivamente.
- **Ningún mecanismo general de selección de tenant/impersonación** fue construido en 6.6 — la Fase A es una capacidad de solo lectura aislada, no un selector de tenant reutilizable en el resto del dashboard.
- **`/api/billing/*` y `/api/onboarding/*` sin autenticación propia** — deuda A5 de la Auditoría v2.1.0, heredada sin cambios desde el cierre de la Fase 4, no tocada por ningún entregable de esta fase.

## 5. Reconciliaciones Arquitectónicas de la fase — panorama completo

- **6.2 — única Reconciliación Arquitectónica puntual real de toda la fase.** A diferencia de 4.1/4.3 (Fase 4), que prefirieron diferir, 6.2 aceptó tocar el motor conversacional de forma acotada y bajo checkpoints explícitos, resolviendo la advertencia que `PLAN_MAESTRO.md` había dejado pendiente desde la definición de la fase. Documentada en su propio Gate Review y Completion Report.
- **6.1, 6.3, 6.4, 6.5, 6.6 (Fase A y Fase B): ninguna Reconciliación Arquitectónica** — confirmado por `git diff --stat` contra los 5 archivos protegidos del motor conversacional en el cierre de cada uno.

## 6. Evolución del proceso de ingeniería a lo largo de la fase

- **6.1** aplicó el patrón de auditoría documental pura (sin código) por primera vez desde la Fase 2, para resolver una deuda de reconciliación de dominio antes de tocar cualquier código.
- **6.2** demostró que el checkpoint de contradicción, institucionalizado en la Fase 4, también sirve para *ampliar* un alcance de forma controlada (3 checkpoints, cada uno autorizado antes de proceder), no solo para detenerlo.
- **6.3, 6.4** confirmaron que el patrón canónico de verificación de tenant (ADR 009) es suficientemente general para replicarse sin variación entre contextos completamente distintos (Staff, Finanzas).
- **6.5** extendió el patrón canónico a un caso que no había aparecido antes — entidades sin `tenantId` propio — sin necesitar una migración, y absorbió un checkpoint de contradicción sobre el alcance mismo del entregable (¿pertenece Empleados Digitales a 6.5?), resuelto por decisión explícita del responsable del proyecto.
- **6.6** fue el entregable con más checkpoints de toda la fase: la propia definición de "Operación Centralizada" (sin especificación previa), la estrategia "B luego A", la superficie de implementación (choke point vs. 13 repos), y — ya en Fase A — el conflicto entre el hook `block-apiurl.sh` y el patrón documentado en `CLAUDE.md`. Los cuatro se reportaron y resolvieron antes de escribir código, sin excepción.

Las cuatro macroetapas institucionalizadas desde la Fase 3 (Auditoría → Diseño Etapas 1-5 + Gate Review → Implementación → Validación y Documentación → Cierre Oficial) se mantuvieron sin cambios de forma en los seis entregables.

## 7. Qué mejoró respecto a la Fase 4

- **De aislamiento verificado en un solo contexto (Agenda, vía 4.1) a aislamiento verificado por evidencia en seis contextos operativos completos** (Agenda, Staff, Finanzas, Automatizaciones, Empleados Digitales, y la propia capa de resolución de tenant).
- **De Reconciliaciones Arquitectónicas siempre evitadas a una Reconciliación Arquitectónica aceptada con criterio.** La Fase 4 registró dos veces la decisión de no tocar el motor. La Fase 6, con la misma disciplina de checkpoint, decidió que la tercera vez sí ameritaba abrirlo — de forma acotada, auditada y sin comprometer el principio en general.
- **De hallazgos de seguridad reactivos a un hallazgo de seguridad descubierto por auditoría propia, antes de cualquier incidente.** El patrón `tenantId ? {...} : {}` (6.6) no fue reportado por nadie externo — se encontró exactamente donde el propio roadmap pedía mirar (Operación Centralizada), auditando con la pregunta correcta.

## 8. Qué no se resolvió, y queda como riesgo real para la siguiente fase

**La certificación real de eventos del ciclo de vida de Empleados Digitales sigue sin resolverse.** Dos fases consecutivas (5, 6) la han dejado abierta — la Fase 5 por decisión explícita al certificar solo 37 de 41 eventos; la Fase 6, en 6.5, por trabajar alrededor del problema en vez de resolverlo en su origen. Es, junto con el patrón "eventos log-only" que la Fase 4 dejó abierto, uno de los dos hallazgos más persistentes del proyecto.

**El motor conversacional sigue sin distinguir zona horaria por establecimiento.** 6.2 resolvió horarios de atención reales; la zona horaria permanece con el mismo comportamiento legado desde antes de la Fase 6, para todos los tenants por igual.

**La capacidad de Operación Centralizada (6.6 Fase A) es deliberadamente mínima.** No tiene filtros, no tiene paginación, no agrega comisiones/payroll. Es suficiente para el objetivo de la fase (formalizar la vista, no construir un producto de reporting completo), pero cualquier necesidad real de un reporting consolidado más rico requerirá una decisión explícita nueva, no una ampliación silenciosa de este entregable.

## 9. Métricas

| Métrica | Valor |
|---|---|
| Entregables completados | **6** (6.1 → 6.6, incluyendo Fase B + Fase A de 6.6) |
| Reconciliaciones Arquitectónicas formales | **1** (6.2 — única de toda la fase) |
| Checkpoints de contradicción reportados y resueltos | **≥7** (6.2 ×3, 6.5 ×1, 6.6 ×3: estrategia "B luego A", choke point vs. repos, hook `block-apiurl.sh`) |
| Versiones publicadas en la fase | v2.17.0 → v2.22.0 (6 releases; 6.1 documental, sin bump) |
| Bounded contexts nuevos | **0** (todo el trabajo fue aditivo sobre contextos ya existentes) |
| Modelos de schema modificados | **0** en toda la fase (ningún entregable de 6.1-6.6 tocó `prisma/schema.prisma`) |
| Archivos del motor conversacional modificados | **3**, únicamente en 6.2 (`whatsapp.service.js`, `conversation.service.js`, `availability-db.service.js`) — cero en el resto de la fase |
| Repositorios/rutas saneados por autorización cross-tenant | ~21 (9 en 6.3, 3 en 6.4-equivalente, 9 en 6.5) + 1 choke point compartido (6.6, cierra 13 repos adicionales sin tocarlos) |
| Documentos de cierre generados | 14 (7 Completion Reports + 7 Gate Reviews, incluyendo Fase A y Fase B de 6.6 por separado) |

## 10. Estado del producto al cierre de la Fase 6

Al cierre de esta fase, Mateos Pet AI puede: operar múltiples establecimientos con aislamiento de datos verificado por evidencia (no solo por diseño) en Agenda, Staff, Finanzas, Automatizaciones y Empleados Digitales; aplicar horario de atención real por establecimiento al flujo de reserva por WhatsApp; y ofrecer a un superadmin una vista administrativa consolidada, deliberada y auditada, del estado operativo agregado de todos los establecimientos activos — sin exponer nunca datos individuales de un tenant a otro por accidente. Lo que aún no puede: operar establecimientos en husos horarios distintos entre sí, ni ofrecer un reporting consolidado más allá de conteos y sumas básicas.

## 11. Qué habilita (y qué no habilita todavía) una fase futura

Con el aislamiento operativo multi-establecimiento consolidado y verificado, la plataforma tiene la base para evaluar la alternativa "Ecosistema" (nuevos canales, API pública, apps de cliente/staff) — oficialmente diferida hasta este cierre. No habilita, todavía, esa exposición externa sin una fase propia que la audite y diseñe con el mismo rigor aplicado aquí; tampoco resuelve la certificación real de eventos de Empleados Digitales, precondición razonable para cualquier automatización o integración externa que dependa de eventos confiables más allá de `CitaCompletada`.

## 12. Recomendaciones que esta fase deja para la siguiente

1. Antes de iniciar "Ecosistema", decidir explícitamente si la certificación real de eventos de Empleados Digitales (5 eventos sin `tenantId`, heredado de 5.2) se resuelve primero — dos fases consecutivas la han dejado abierta por decisión, no por descuido.
2. Si una futura necesidad exige zona horaria real por establecimiento, tratarla como una decisión de diseño propia, con el mismo nivel de checkpoint aplicado en 6.2 — no como una extensión silenciosa de 6.2.
3. Si aparece necesidad real de un reporting consolidado más rico (filtros, comisiones, exportación), tratarlo como un entregable nuevo con su propia Macroetapa 1, no como una ampliación incremental de 6.6 Fase A.
4. Revisar `/api/billing/*` y `/api/onboarding/*` (sin autenticación propia, heredado desde la Fase 4) antes de cualquier campaña de captación que dependa de un volumen de tenants nuevo significativamente mayor.

---

## 13. Conclusión

La Fase 6 de la Plataforma Operativa Inteligente de Mateos Pet queda oficialmente cerrada el 2026-08-11, completando el roadmap interno 6.1 → 6.6 en su totalidad, versión de cierre `v2.22.0`.

Lo que se construyó no fue una funcionalidad nueva de cara al cliente final, sino la verificación, contexto por contexto, de que la promesa hecha desde el inicio del proyecto — el Establecimiento como única unidad de aislamiento — es real en el código, no solo en el diseño. La fase encontró tres tipos de hueco distintos (aplicación incompleta del aislamiento en 6.3/6.5, alcance mal asignado en 6.4/6.5, y una capacidad accidental sin control de acceso en 6.6) y los cerró con el mismo patrón disciplinado de auditoría-antes-que-código en los seis entregables.

La fase también deja, con la misma transparencia de siempre, sus límites: la certificación de eventos de Empleados Digitales sigue sin resolverse, la zona horaria por establecimiento sigue diferida, y la nueva capacidad de Operación Centralizada es deliberadamente mínima, no un producto de reporting terminado.

**La plataforma puede, hoy, operar múltiples establecimientos reales con aislamiento verificado por evidencia. No puede todavía exponerse a un ecosistema externo sin una fase propia que audite esa exposición con el mismo rigor.**

---

*Documento generado al cierre de la Fase 6 · Plataforma Operativa Inteligente · Mateos Pet · 2026*
