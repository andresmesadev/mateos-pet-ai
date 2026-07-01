# Retrospectiva — Fase 2 (Sistema Operativo del Negocio)

**Fecha:** 2026-07-01
**Alcance:** Entregables 2.1 (Catálogo de Servicios), 2.2 (Staff), 2.3 (Finanzas) — la Fase 2 completa, no un entregable individual.
**Propósito:** capturar qué funcionó, qué evolucionó y qué aprender del proceso de ingeniería a lo largo de toda la fase, antes de archivarla y comenzar la Fase 3.

---

## Resumen de lo construido

La Fase 2 completó el Dominio Operativo que la Fase 1 dejó soberano pero incompleto: `Servicio` y `Regla de Precio` (2.1), `Staff`, `Disponibilidad`, `Capacidad` y `Liquidación` (2.2), `Gasto`, `Cierre del Día` y `Período Financiero` (2.3) — todos coordinados por su propia capa de casos de uso, ninguno orquestado por un canal. Tres bounded contexts completos (`services`, `staff`, `finance`), cada uno con dominio, aplicación e infraestructura separados y verificables por importación, no por convención declarada.

## Evolución del proceso de ingeniería a lo largo de la fase

**2.1 estableció el proceso; 2.2 lo aplicó; 2.3 lo puso a prueba.** La Regla de Ejecución de 8 etapas nació durante el diseño de 2.1 y no cambió de forma en los tres entregables — lo que cambió fue lo que cada entregable *agregó* al proceso sin reabrir lo ya aprobado:
- **2.1** fijó los Principios Permanentes de aplicación y persistencia, la doble protección de invariantes, y la clasificación de casos de uso por responsabilidad (Administración, Operación, Resolución, Consulta).
- **2.2** agregó la sección obligatoria "Decisiones Arquitectónicas Diferidas" al cierre de toda Arquitectura Técnica, y demostró que reutilizar una entidad de Fase 1 exige más disciplina que crear una nueva — verificar el código real antes de decidir (ADR 003) se volvió práctica esperada, no una buena idea aislada.
- **2.3** agregó el mecanismo de **Reconciliación Arquitectónica** — la pieza que faltaba para cuando una etapa ya aprobada resulta inconsistente con una fuente oficial ya vigente, no con una idea nueva.

Cada entregable heredó el patrón del anterior sin rediseñarlo, y cada uno dejó algo nuevo y permanente al proceso. Esa es, en retrospectiva, la señal más clara de que el proceso maduró en vez de simplemente repetirse.

## Incorporación de ADRs

Cinco ADRs a lo largo de la fase, cada uno resolviendo un tipo de tensión distinto — no hay dos ADRs redundantes:

| ADR | Entregable | Qué resolvió |
|---|---|---|
| 001 | 2.1 | Congelamiento formal del diseño antes de implementar |
| 002 | 2.1 | Puerto mínimo de `Resolver Precio` hacia Mascotas |
| 003 | 2.2 | Convivencia de `StaffAvailability` con `Staff.availability` (JSON, Fase 1) — verificado contra el código real antes de decidir |
| 004 | 2.2 | Puerto mínimo de `Resolver Disponibilidad` hacia Servicios |
| 005 | 2.3 | Primera Reconciliación Arquitectónica del proyecto — `Cobro` deja de ser entidad independiente al descubrir que `domain-model-v1.md` ya lo definía como especialización de `Transacción` |

El criterio de "puerto mínimo, nunca el modelo completo del contexto consultado" (002, 004) se mantuvo idéntico en ambos casos, sin relajarse ni endurecerse artificialmente. El ADR 005 es cualitativamente distinto a los otros cuatro: no decide algo nuevo, corrige una desviación de algo que ya era oficial — y por eso generó un mecanismo de proceso nuevo en vez de resolverse como un ADR más.

## Decisiones Arquitectónicas Diferidas — panorama completo

La fase acumuló decisiones deliberadamente diferidas en los tres entregables, todas registradas y ninguna resuelta por accidente durante la implementación:

- **Pertenencia futura de `Commission`/`Settlement` a `Finanzas`** (2.2, heredada explícitamente por 2.3) — sigue abierta desde ambos lados del contexto; ninguno de los dos ha forzado su resolución.
- **Convivencia sin fusión** de `commission-calculation.rules.js` (2.2) con `commission.service.js` (Fase 1), y de `Staff.availability` (JSON) con `StaffAvailability` (2.2) — ambas resueltas explícitamente como "conviven, no se fusionan", no como deuda oculta.
- **Excepción documentada al Principio Permanente de doble protección** (2.2: solapamiento de horario base, sin `btree_gist`) — acotada, con condición de reapertura ya definida.
- **Cómo corregir un hecho financiero de un período ya cerrado** (2.3) — formulada desde el dominio, no desde el comportamiento del sistema, deliberadamente sin resolver.
- **Categorización interna de `TransactionItem`** (2.3) — fuera de alcance porque el `Cierre del Día` no la necesita todavía.

Ninguna de estas quedó "olvidada": todas tienen dueño, ubicación documental y condición de reapertura.

## La Reconciliación Arquitectónica (ADR 005) — el hito más importante de la fase

Ocurrió en la Etapa 5 de 2.3, cuando una auditoría de las entidades físicas de Fase 1 (`Expense`, `Transaction`, `TransactionItem`) — motivada por la disciplina, ya establecida, de verificar el código real antes de diseñar el esquema físico — reveló que `domain-model-v1.md` ya definía a `Cobro` como "la transacción específica del pago de un servicio", una especialización de `Transacción`, no una entidad independiente. Las Etapas 2 y 4 de ese mismo entregable se habían apartado de esa definición sin advertirlo.

Lo relevante no es el error — es la respuesta. En vez de corregirlo en silencio o de tratarlo como un ADR ordinario, se formalizó un mecanismo nuevo: documentar la evidencia, reabrir únicamente las etapas afectadas, registrar la decisión en su propio ADR, dejar nota de reconciliación explícita en cada documento tocado, y volver a congelar el diseño con el mismo peso de aprobación que tenía antes. Ese mecanismo —la Reconciliación Arquitectónica— quedó incorporado como parte permanente de `docs/PHASE_2_EXECUTION_RULE.md`, disponible para cualquier entregable futuro, dentro o fuera de la Fase 2.

## Qué mejoró respecto a la Fase 1

- **De un dominio soberano a un dominio completo.** La Fase 1 estableció que el dominio no depende de los canales; la Fase 2 completó las entidades que ese dominio necesitaba para gobernar la operación diaria entera, no solo una parte de ella.
- **De extracción reactiva a diseño previo.** En Fase 1, el desacoplamiento de `conversation.service.js` (E4/E5) fue un mapa de refactor sobre código ya escrito. En la Fase 2, ningún entregable escribió una línea de código antes de completar sus cinco etapas de diseño — el orden se invirtió, y con él, la cantidad de retrocesos durante la implementación (ninguno documentado en las tres retrospectivas de entregable).
- **De migraciones sin red de seguridad a protocolo de respaldo obligatorio.** La Retrospectiva de 2.1 señaló la ausencia de un respaldo previo obligatorio como mejora pendiente; 2.2 y 2.3 ya lo incorporaron como paso no negociable antes de tocar la base real.
- **De decisiones tácitas a decisiones con nombre.** Cinco ADRs, ocho Decisiones Diferidas con dueño y condición de reapertura, y ahora un mecanismo de Reconciliación Arquitectónica — nada de esto existía como práctica formal al cierre de la Fase 1.

## Qué no se resolvió, y queda como riesgo real para la Fase 3

**Los casos de uso reactivos existen, pero ningún evento real los invoca todavía.** `RecordCommissionOnAppointmentCompletedUseCase` (2.2) y `RecordChargeOnAppointmentCompletedUseCase` (2.3) están completos, probados, y expuestos por sus respectivos composition roots — pero no hay ningún adaptador de eventos conectando `CitaCompletada` (Agenda) con ninguno de los dos. Es deuda de integración explícitamente diferida en ambos entregables, pero acumulada dos veces sin que ningún documento lo señalara con esta claridad hasta la auditoría final de cierre de la fase.

**Una promesa documental sin ejecutar pasó dos validaciones sin detectarse.** La adaptación progresiva de `daily-close.routes.js`, prometida en el Esquema Físico de 2.3, no se implementó durante la Validación Técnica ni la Funcional de ese entregable — se detectó recién en la auditoría final de cierre de la fase, y se corrigió antes de este documento. La lección: una Validación Técnica o Funcional que verifica "¿el código hace lo que el contrato dice?" puede pasar por alto "¿el código hace *todo* lo que un documento de una etapa anterior prometió?" si esa promesa no se convierte en un ítem explícito de la lista de verificación.

## Recomendaciones para iniciar la Fase 3

1. **Resolver el vacío de integración de eventos antes de construir Empleados Digitales que dependan de él.** Si la Fase 3 asume que `CitaCompletada`, `ComisiónRegistrada` o `CobroRegistrado` ya fluyen hacia algún consumidor, se topará con un vacío no señalizado hasta ahora con esta claridad.
2. **Extender el criterio de Validación de etapas para incluir explícitamente "¿toda promesa de una etapa anterior ya se ejecutó?"** — no solo "¿el código coincide con el contrato?", como reveló el hallazgo de `daily-close.routes.js`.
3. **Decidir, antes de construir sobre ellas, si las Decisiones Diferidas abiertas siguen siendo válidas** — en particular la pertenencia futura de `Commission`/`Settlement` a Finanzas, que la Fase 3 (Automatizaciones reaccionando a eventos financieros) podría forzar a resolver antes de lo previsto.
4. **Mantener el mecanismo de Reconciliación Arquitectónica activo desde el primer entregable de la Fase 3** — no esperar a que aparezca una inconsistencia real para recordarlo, como ocurrió en 2.3.
5. **Construir primero el mapa conceptual de la Fase 3** (ya solicitado, pendiente de una sesión dedicada) antes de fijar su propio roadmap interno de entregables — mismo criterio que ya demostró su valor al inicio de la Fase 2.

---

*Retrospectiva de la Fase 2 · Plataforma Operativa Inteligente · Mateos Pet*
