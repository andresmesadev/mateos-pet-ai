# ADR 007 — Fuente oficial del ingreso del negocio y flujo del evento `CitaCompletada`

**Fecha:** 2026-07-02
**Estado:** Aceptado (2026-07-02)
**Origen:** Hallazgo C2 de la auditoría v2.1.0; precondición de dominio del Entregable Puente "Exposición del Sistema Operativo" (ADR 006)
**Fuentes consultadas:** `domain-model-v1.md` §7, ADR 005, ADR 006, diseño completo del contexto Finanzas (Etapas 1–5), flujo real Agenda → `Commission` → `Transaction`

---

## Decisión 1 — La fuente oficial del ingreso es `Transaction`, en sus dos orígenes

El Cierre del Día consolida el ingreso exclusivamente desde `Transaction`: `origin = "system_appointment_completed"` (servicios, creado reactivamente al completarse la cita, monto = precio resuelto congelado) y `origin = "manual_pos_sale"` (ventas de mostrador). `Commission` no es fuente de ingreso: es el hecho de **reparto** de un ingreso, y aporta al cierre únicamente el desglose por staff.

Esto ratifica el Modelo de Dominio §7 ("*Transacción* registra cada movimiento de dinero") y el ADR 005, y descarta:

- Consolidar servicios desde `Commission` — haría que el ingreso dependa de reglas de Staff: una cita atendida por staff sin comisión (`generatesCommission = false`) no produciría ingreso oficial, lo cual es falso para el negocio.
- Consolidar por lectura de `Appointment` — ingreso calculado en vez de registrado: el defecto de Fase 1 que 2.3 nació para eliminar, y una dependencia estructural de Finanzas hacia Agenda que el mapa de contextos prohíbe.
- Cualquier esquema transitorio — produciría cierres inmutables con dos semánticas distintas en la misma tabla de hechos congelados, imposible de corregir después por inmutabilidad.

## Decisión 2 — El flujo: dispatcher in-process + invariante de completitud en el cierre

`CitaCompletada` se publica en un dispatcher de eventos in-process (evolución directa del contrato `publish(name, payload)` ya existente en los tres contextos). Se suscriben: Staff (`RecordCommissionOnAppointmentCompleted`) y Finanzas (`RecordChargeOnAppointmentCompleted`). La idempotencia la garantiza la base de datos (`@@unique([appointmentId, origin])`): un evento duplicado no puede duplicar ingreso.

La pérdida de eventos no se resuelve con infraestructura de entrega garantizada (outbox — se difiere a la Fase 3, si un Empleado Digital la exige), sino con una **invariante del hecho oficial**: `GenerateDailyCloseUseCase` verifica, antes de congelar, que toda cita facturable completada del día tenga su cobro de sistema; si falta alguno, el cierre se rechaza con error de dominio. Un evento puede perderse; un cierre incompleto no puede existir. Esta verificación es una lectura de consistencia puntual dentro del caso de uso de cierre, no una dependencia estructural de Finanzas hacia Agenda.

## Decisión 3 — Regla del POS sobre una cita con cobro de sistema

El ingreso del servicio tiene una sola fuente: el cobro de sistema. El POS conserva tres operaciones sobre esa cita:

- **(a) Liquidar el cobro de sistema:** actualizar `paymentMethod` y `notes` — **nunca el monto**, que es el precio resuelto congelado.
- **(b) Vender extras:** crear la `Transaction` manual vinculada a la cita. El caso de uso rechaza crearla si la cita facturable no está completada o aún no tiene cobro de sistema — en ese estado, un ticket vinculado solo podría significar "cobrar el servicio a mano", operación que deja de existir.
- **(c) Ninguna otra:** la base de datos impide un segundo cobro de sistema y el caso de uso impide cobrar el servicio por POS.

La coexistencia permitida por `@@unique([appointmentId, origin])` queda así definida económicamente: **la Transaction manual vinculada a una cita representa venta adicional de la visita, nunca el servicio**. Las correcciones de transacciones manuales se harán por anulación + nuevo registro (patrón a incorporar en el Entregable Puente).

## Decisión 4 — Invariante del precio: vive en Agenda

Una cita facturable no puede transicionar a `completed` sin precio resuelto. **El precio cero es un precio resuelto** (una cortesía genera cobro de sistema por 0); el precio **indeterminado** no lo es.

La invariante es precondición del comando "completar" en Agenda, que consulta a Servicios (el resolutor de precio) en el momento de la transición y rechaza con error de dominio visible para el operador — mismo patrón de los ADR 002 ("resolver precio consulta atributos de mascota") y ADR 004 ("resolver disponibilidad consulta servicios"): el contexto dueño de la operación consulta al contexto dueño del dato, en el momento de la operación.

- Servicios no puede ser el dueño: resuelve precios, no gobierna el ciclo de vida de la cita.
- Finanzas no puede ser el dueño: es reactivo — "recibe el hecho ya confirmado" — y no puede vetar hechos consumados; si rechazara el cobro después de la transición, existiría una cita completada sin ingreso: exactamente el estado que esta invariante hace imposible.
- La verificación de completitud del cierre (Decisión 2) actúa como segunda red, no como dueña de la regla.

Esto reemplaza el comportamiento actual (`recordGroomingCommission`: warning en log y ningún registro — un hueco contable silencioso) por un rechazo explícito aguas arriba.

## Decisión 5 — El split permanece en Staff (ratificación de la Decisión Diferida)

El Modelo de Dominio §7 asigna a Finanzas "calcular el split de comisiones en cada cobro"; la implementación real (Entregable 2.2) lo puso en `Commission` (contexto Staff), y Finanzas consume `ComisiónRegistrada` para el desglose del cierre. Este ADR **ratifica esa arquitectura**: cobro y comisión nacen del mismo evento en contextos distintos, cada uno dueño de su hecho. Queda registrada una corrección menor pendiente al Modelo de Dominio (§7) para reflejarlo, ejecutable junto con las correcciones documentales de este ADR.

## Qué NO decide este ADR

- No diseña el dispatcher ni el Entregable Puente — eso pertenece a las etapas formales del entregable, con este ADR como restricción de entrada.
- No decide la zona horaria del día financiero (ADR siguiente, hallazgo A1).
- No implementa nada: a la fecha, `CitaCompletada` sigue sin existir y las rutas siguen en lógica de Fase 1, como declara el ADR 006.

## Notas de alcance registradas en la aprobación

1. El guard de la Decisión 3(b) es deliberadamente conservador; si la operación real vende productos a mitad de la visita, puede relajarse a advertencia sin comprometer la integridad, porque el doble conteo lo previenen (a) + (c).
2. La Decisión 4 implica que el Entregable Puente toca también el flujo de completar cita en Agenda (hoy `PATCH /appointments/:id`), no solo Finanzas — debe constar en su definición funcional.
