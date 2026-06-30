# Casos de Uso — Sistema Operativo de Staff

**Entregable:** 2.2 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado y validado. Diseño congelado en `docs/history/ENTREGABLE_2_2_GATE_REVIEW.md`; ampliado por `docs/decisions/004-resolver-disponibilidad-consulta-servicios.md`. Cierre en `docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`.
**Contexto de dominio que cubre:** `Staff` (ver `docs/architecture/domain-model-v1.md`, sección 6, ampliada con la entidad **Capacidad del Staff** durante el diseño de este entregable)

---

## Propósito de este documento

Este documento define el contrato funcional del Sistema Operativo de Staff: qué casos de uso existen, qué hacen, bajo qué reglas, y qué eventos produce cada uno. No describe pantallas, endpoints ni estructuras de datos. Es la capa de aplicación que coordina el contexto `Staff`, agnóstica a cualquier canal o evento que la invoque.

### Clasificación por responsabilidad

Se mantiene el criterio de diseño establecido en el Entregable 2.1: Administración, Operación, Resolución, Consulta.

| Caso de uso | Responsabilidad |
|---|---|
| Registrar Staff | Administración |
| Actualizar Staff | Administración |
| Desactivar Staff | Administración |
| Reactivar Staff | Administración |
| Actualizar Disponibilidad | Administración |
| Administrar Capacidades del Staff | Administración |
| Registrar Ausencia Imprevista | Operación |
| Registrar Comisión por Cita Completada | Operación (reactivo) |
| Generar Liquidación de Período | Operación |
| Resolver Disponibilidad del Staff | Resolución |
| Consultar Staff Activo | Consulta |
| Consultar Liquidaciones | Consulta |

---

## 1. Registrar Staff

**Responsabilidad:** Administración

**Objetivo**
Incorporar un nuevo miembro al equipo del establecimiento.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El rol indicado es uno de los roles válidos del establecimiento.

**Flujo principal**
1. El operador provee nombre, rol, datos de contacto y si genera comisiones.
2. El caso de uso valida los datos.
3. El miembro se registra activo, sin capacidades ni disponibilidad asignadas todavía — esas se administran con sus propios casos de uso.

**Reglas de negocio involucradas**
- Un miembro nace siempre activo.
- El rol determina el valor inicial de "genera comisiones", configurable después vía Actualizar Staff.

**Eventos de dominio que produce**
- `StaffRegistrado`

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas`, `Finanzas`, `Agenda`.

**Resultado esperado**
Un nuevo miembro del staff disponible para que se le asignen capacidades y disponibilidad.

---

## 2. Actualizar Staff

**Responsabilidad:** Administración

**Objetivo**
Modificar atributos descriptivos de un miembro existente (nombre, rol, contacto, si genera comisiones).

**Actor principal**
Operador del negocio.

**Precondiciones**
- El miembro existe.

**Flujo principal**
1. Se reciben los atributos a cambiar.
2. Se valida que el miembro exista.
3. Se persisten los cambios.

**Reglas de negocio involucradas**
- No gestiona aquí disponibilidad ni capacidades — tienen sus propios casos de uso.
- **Un cambio de rol nunca modifica la interpretación histórica de comisiones o liquidaciones ya registradas.** Una Comisión o Liquidación generada bajo un rol anterior conserva el split y la categoría con la que se calculó en su momento; cambiar el rol de un miembro hoy no reinterpreta ni recalcula ningún registro pasado — consistente con la inmutabilidad de los registros financieros (Plan Maestro).

**Eventos de dominio que produce**
- `StaffActualizado`

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- Mismos límites que Registrar Staff.

**Resultado esperado**
El miembro refleja sus nuevos atributos hacia adelante, sin alterar ningún hecho financiero ya registrado.

---

## 3. Desactivar Staff

**Responsabilidad:** Administración

**Objetivo**
Retirar a un miembro del roster operativo activo, sin eliminar su historial.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El miembro existe y está activo.

**Flujo principal**
1. Se solicita la desactivación.
2. Se marca inactivo.
3. Deja de estar disponible para nuevas asignaciones.

**Reglas de negocio involucradas**
- Nunca se elimina. Comisiones y liquidaciones ya generadas permanecen intactas.

**Eventos de dominio que produce**
- `StaffDesactivado`

**Qué contextos consume**
- Ninguno.

**Qué contextos no debe conocer**
- `Agenda` — no se consulta si tiene citas futuras asignadas; esa validación, si se necesita, es responsabilidad de Agenda al reaccionar al evento.

**Resultado esperado**
El miembro deja de poder ser asignado a nuevas citas; su historial permanece consultable.

---

## 4. Reactivar Staff

**Responsabilidad:** Administración

**Objetivo**
Reincorporar a un miembro previamente desactivado, sin crear un registro nuevo.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El miembro existe y está inactivo.

**Flujo principal**
1. Se solicita la reactivación.
2. Se valida que esté inactivo.
3. Se marca activo nuevamente, restaurando sus capacidades previamente asignadas.

**Reglas de negocio involucradas**
- **Las capacidades se restauran automáticamente al reactivar.** Las capacidades representan conocimiento y habilitación profesional del miembro — no se pierden por una desvinculación temporal del roster activo.
- **La disponibilidad NO se restaura automáticamente.** Es operativa, no profesional: el operador debe configurarla de nuevo mediante Actualizar Disponibilidad, porque el horario y las ausencias vigentes antes de la desactivación ya no reflejan necesariamente la realidad al momento de reactivar.

**Eventos de dominio que produce**
- `StaffReactivado`

**Qué contextos consume**
- Ninguno.

**Qué contextos no debe conocer**
- Mismos límites que Desactivar Staff.

**Resultado esperado**
El miembro vuelve a estar activo, con la misma identidad, historial y capacidades que tenía antes de desactivarse; su disponibilidad queda pendiente de reconfiguración.

---

## 5. Actualizar Disponibilidad

**Responsabilidad:** Administración

**Objetivo**
Configurar el horario base de un miembro del staff y sus ausencias programadas con anticipación (vacaciones, permisos planeados).

**Actor principal**
Operador del negocio.

**Precondiciones**
- El miembro existe y está activo.

**Flujo principal**
1. Se recibe el tipo de cambio (`horario_base` o `ausencia_programada`, con su rango de fechas/horas).
2. Se valida coherencia (el horario no se superpone consigo mismo; la ausencia tiene fecha de inicio anterior a la de fin).
3. Se persiste.

**Reglas de negocio involucradas**
- El horario base es la disponibilidad por defecto; las ausencias programadas son excepciones sobre ese horario, nunca lo reemplazan.

**Eventos de dominio que produce**
- `DisponibilidadActualizada`

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Agenda` — no se consulta aquí; la disponibilidad se publica vía evento para que Agenda la consuma cuando la necesite.

**Resultado esperado**
La disponibilidad planificada del miembro queda actualizada para cualquier cálculo futuro de Resolver Disponibilidad del Staff.

---

## 6. Administrar Capacidades del Staff

**Responsabilidad:** Administración

**Objetivo**
Definir el conjunto de servicios que un miembro del staff está habilitado a prestar.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El miembro existe y está activo; los servicios referenciados existen.

**Flujo principal**
1. Se recibe el conjunto completo de servicios habilitados para ese miembro.
2. El caso de uso compara contra el conjunto actual y determina internamente qué capacidades se agregan y cuáles se retiran.
3. Persiste la diferencia.

**Reglas de negocio involucradas**
- **Las capacidades representan aptitud y habilitación profesional del miembro — qué sabe hacer y para qué está autorizado —, nunca disponibilidad operativa.** Que un miembro tenga la capacidad de prestar un servicio no implica que esté disponible para hacerlo en un momento dado; esa pregunta la responde exclusivamente Resolver Disponibilidad del Staff, combinando capacidad con horario y ausencias.
- No se valida que el servicio esté activo en el catálogo más allá de su existencia — un servicio temporalmente desactivado no fuerza la revocación automática de la capacidad asociada.

**Eventos de dominio que produce**
- `CapacidadAsignada` (una vez por cada servicio agregado)
- `CapacidadRevocada` (una vez por cada servicio retirado)

**Qué contextos consume**
- `Servicios` — únicamente para validar que cada `serviceId` referenciado existe (mismo patrón de puerto mínimo de existencia usado en `ChangeServicePriceUseCase`, Entregable 2.1).

**Qué contextos no debe conocer**
- `Agenda`, `Finanzas`, `Clientes`, `Mascotas`.

**Resultado esperado**
El conjunto de capacidades del miembro queda exactamente igual al solicitado, con un evento por cada cambio real — nunca uno por cada servicio que no cambió.

---

## 7. Registrar Ausencia Imprevista

**Responsabilidad:** Operación

**Objetivo**
Registrar que un miembro del staff no podrá atender en un rango de tiempo ya en curso o inminente, con impacto operativo inmediato.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El miembro existe y está activo.

**Flujo principal**
1. Se recibe el rango de la ausencia y, opcionalmente, un motivo.
2. Se valida que el rango sea coherente.
3. Se registra como una excepción de disponibilidad de mayor prioridad que cualquier horario planificado.

**Reglas de negocio involucradas**
- Una ausencia imprevista siempre tiene prioridad sobre el horario base y sobre ausencias programadas previas en el mismo rango.
- Distinta de Actualizar Disponibilidad porque su registro ocurre típicamente con la agenda del día ya comprometida: tiene peso operativo, no es planificación de catálogo.

**Eventos de dominio que produce**
- `DisponibilidadActualizada` (el origen — planificada vs. imprevista — viaja en el payload).

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Agenda` — no decide qué pasa con las citas ya agendadas en ese rango; solo informa el cambio de disponibilidad vía evento.

**Resultado esperado**
La disponibilidad del miembro refleja inmediatamente que no puede atender en ese rango.

---

## 8. Registrar Comisión por Cita Completada

**Responsabilidad:** Operación (reactivo — no iniciado por un operador humano)

**Objetivo**
Registrar lo que un miembro del staff generó al completarse una cita, aplicando la regla de comisión correspondiente a la categoría del servicio prestado.

**Actor principal**
El propio Sistema Operativo, reaccionando al evento `CitaCompletada` (de Agenda). El nombre del caso de uso deja explícito en su propia redacción que no es una acción que un operador inicia, sino una consecuencia directa de un hecho de negocio ya ocurrido. Un adaptador de eventos —fuera de ambos contextos— escucha `CitaCompletada` y dispara este caso de uso; Agenda nunca invoca a Staff directamente.

**Precondiciones**
- La cita está completada y tiene un miembro del staff y un servicio asociados.

**Flujo principal**
1. Se recibe el id de la cita completada, el establecimiento, el staff asignado, el servicio prestado, el precio resuelto, el origen de ese precio y el momento de finalización.
2. Se consulta la categoría del servicio para obtener la regla de split.
3. Se calcula la comisión.
4. Se persiste.

**Corrección de fidelidad (detectada en Validación Funcional, Etapa 6):** el flujo, tal como se aprobó originalmente, mencionaba solo "el id de la cita, el staff, el servicio y el precio resuelto", omitiendo `tenantId`, `priceSource` (origen del precio) y `completedAt` (momento de finalización). `Commission` (Fase 1) ya requiere esos tres campos para producir un registro completo y distinguible por establecimiento — esta es una corrección al contrato, no un cambio de comportamiento: la implementación ya los recibía correctamente.

**Reglas de negocio involucradas**
- La comisión, una vez registrada, es inmutable — corrección solo por anulación + nuevo registro.
- El split se obtiene de la categoría del servicio (Entregable 2.1) y de la configuración de `Negocio`.

**Eventos de dominio que produce**
- `ComisiónRegistrada`

**Qué contextos consume**
- `Servicios` (categoría del servicio, vía puerto de lectura) y `Negocio` (regla de split configurada).

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas` — no necesita saber quién es el cliente, solo el monto y la categoría. No conoce el detalle interno de `Agenda`, solo recibe los datos ya resueltos del evento.

**Resultado esperado**
Una Comisión registrada e inmutable, lista para integrarse a la siguiente Liquidación.

---

## 9. Generar Liquidación de Período

**Responsabilidad:** Operación

**Objetivo**
Consolidar las comisiones de un miembro del staff en un período determinado en un único resumen, reemplazando el cálculo manual.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Existen comisiones registradas para ese miembro dentro del período solicitado.
- No existe ya una liquidación activa (no anulada) para ese mismo miembro y ese mismo período.

**Flujo principal**
1. Se recibe el staffId y el rango del período.
2. Se consultan todas las comisiones de ese miembro dentro del rango.
3. Se suman.
4. Se genera el resumen.

**Reglas de negocio involucradas**
- **Una Liquidación sigue el mismo principio de inmutabilidad que Commission: nunca se reemplaza.** Si una liquidación ya generada requiere corrección, el camino es anularla explícitamente y generar una nueva — nunca sobrescribirla. Esto preserva la trazabilidad histórica completa: quién vio qué liquidación, cuándo, y por qué cambió.
- Generar una liquidación es un resumen de hechos ya inmutables (comisiones); generarla no modifica ninguna comisión.

**Eventos de dominio que produce**
- `LiquidaciónGenerada`

**Qué contextos consume**
- Ninguno externo — consume sus propias Comisiones.

**Qué contextos no debe conocer**
- `Finanzas` — Staff genera la liquidación, Finanzas la consume para el cierre, nunca al revés.

**Resultado esperado**
Un resumen único, inmutable y trazable del período, listo para que el operador sepa cuánto pagarle a ese miembro.

**Nota de alcance:** este entregable define la regla de inmutabilidad de la Liquidación, pero el caso de uso que la anula explícitamente (`Anular Liquidación`) no forma parte de los 12 casos de uso de este contrato. Queda registrado como una capacidad pendiente, a incorporar cuando el negocio necesite ejecutar una corrección real — no se construye de forma especulativa ahora.

---

## 10. Resolver Disponibilidad del Staff

**Responsabilidad:** Resolución

**Objetivo**
Determinar qué miembros del staff están disponibles para un servicio en un rango de tiempo determinado.

**Actor principal**
Otro caso de uso del Sistema Operativo (consumidor interno — típicamente Agenda, al intentar agendar una cita).

**Precondiciones**
- El servicio existe.

**Flujo principal**
1. Se reciben el servicio y el rango de tiempo deseado.
2. Se filtran los miembros activos que tienen la capacidad para ese servicio.
3. Se excluyen los que tienen ausencia (programada o imprevista) en ese rango, o cuyo horario base no lo cubre.
4. Se retorna la lista de disponibles.

**Reglas de negocio involucradas**
- Una ausencia imprevista excluye con la misma fuerza que cualquier otra ausencia — la jerarquía de prioridad entre tipos de ausencia importa para saber cuál dato es más reciente, no para decidir si excluye o no.
- Operación de lectura pura.

**Eventos de dominio que produce**
- Ninguno.

**Qué contextos consume**
- `Servicios` — **únicamente** a través de `ServiceExistenceReaderPort.exists(serviceId)`, para validar que el servicio recibido existe. Capacidad y disponibilidad en sí ya viven dentro de Staff; esta consulta está formalizada en `docs/decisions/004-resolver-disponibilidad-consulta-servicios.md`.

**Qué contextos no debe conocer**
- `Agenda` — Staff no sabe para qué cita se está resolviendo esto, solo responde con los identificadores recibidos.

**Resultado esperado**
Una lista de miembros del staff genuinamente disponibles (con capacidad y sin ausencia en el rango), lista para que Agenda complete el agendamiento.

---

## 11. Consultar Staff Activo

**Responsabilidad:** Consulta

**Objetivo**
Obtener el roster de miembros activos del establecimiento, con sus capacidades, para administración general.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Ninguna especial.

**Flujo principal**
1. Se solicita el roster, opcionalmente filtrado por rol o por capacidad (servicio).
2. Se retorna la lista con sus atributos vigentes y capacidades.

**Reglas de negocio involucradas**
- Por defecto retorna solo miembros activos, salvo solicitud explícita de incluir inactivos.

**Eventos de dominio que produce**
- Ninguno.

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas`, `Agenda`, `Finanzas`.

**Resultado esperado**
Una vista administrativa del equipo y sus capacidades, sin resolver disponibilidad puntual — eso es responsabilidad exclusiva de Resolver Disponibilidad del Staff.

---

## 12. Consultar Liquidaciones

**Responsabilidad:** Consulta

**Objetivo**
Obtener las liquidaciones generadas, filtradas por miembro y/o período.

**Actor principal**
Operador del negocio.

**Precondiciones**
- Ninguna especial.

**Flujo principal**
1. Se solicitan liquidaciones con filtros opcionales (staffId, rango de fechas).
2. Se retorna la lista.

**Reglas de negocio involucradas**
- Operación de lectura pura, sin recalcular montos — las liquidaciones ya son hechos consolidados.

**Eventos de dominio que produce**
- Ninguno.

**Qué contextos consume**
- Ninguno externo.

**Qué contextos no debe conocer**
- `Finanzas`, `Clientes`, `Mascotas`, `Agenda`.

**Resultado esperado**
Historial consultable de liquidaciones, sin necesidad de recalcular ni exportar.

---

## Notas para la aprobación

- Los 12 casos de uso cubren completamente las cuatro brechas identificadas en la Definición Funcional (roster, disponibilidad, capacidades, liquidación), respetando los límites de contexto del Modelo de Dominio ampliado con la entidad Capacidad del Staff.
- **Registrar Comisión por Cita Completada** es el único caso de uso de este contrato cuyo actor no es un operador humano — su nombre lo deja explícito deliberadamente, y su invocación pasa siempre por un adaptador de eventos, nunca por una llamada directa de Agenda a Staff.
- **Anular Liquidación** queda fuera del alcance de este contrato, registrado como capacidad pendiente — no se construye de forma especulativa.
- **Reactivar Staff** restaura capacidades automáticamente (profesionales) pero no disponibilidad (operativa) — distinción explícita entre ambos tipos de información del staff.

Pendiente de implementación únicamente tras completar las Etapas 3, 4 y 5 de la Regla de Ejecución de la Fase 2.
