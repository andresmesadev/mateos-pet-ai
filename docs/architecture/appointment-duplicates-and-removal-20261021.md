# Agenda: duplicados diarios y citas creadas por error

Petición del responsable del 21/10/2026. Mantenimiento de Agenda existente,
sin ampliar fases ni modificar reglas de precios, cobro o comisión.

## 1. Definición funcional

Una mascota identificada no puede tener dos citas vigentes para el mismo
servicio en el mismo día civil de Colombia. Puede recibir peluquería y consulta,
u otros servicios distintos del catálogo, ese día. Completada también ocupa su
servicio diario; cancelada y no asistida permiten reservar de nuevo.
Los duplicados anteriores no se corrigen ni eliminan automáticamente.

Desde la ficha abierta en Agenda, los operadores con permiso de agendar pueden
eliminar una cita creada por error: motivo y confirmación, mascota/servicio/fecha
visibles. Se admiten citas pendientes, confirmadas, llegadas, canceladas, no
asistidas o marcadas en atención por error sin otros hechos. Una atención
completada, historia, nota/entrega de peluquería,
cobro (incluso anulado), comisión, inventario, seguimiento o traslado compartido
impide la eliminación. No es una anulación financiera ni una baja de historia.

## 2. Casos de uso

- Reservar/reprogramar/cambiar servicio: comprobar identidad de mascota,
  servicio y día de Bogotá de manera atómica. Rechazar duplicado con HTTP 409 y
  explicación; permitir otro día, otra mascota, servicio o establecimiento.
- Eliminar cita errónea: Tenant y actor desde identidad autenticada, capacidad
  schedule y área habilitada, motivo obligatorio. Bloquear la fila, comprobar
  antecedentes, guardar copia de auditoría y eliminar la reserva en la misma
  transacción. Repetición de la misma solicitud reconoce el retiro previo del
  mismo establecimiento. Cancelar evento externo solo después del commit.

## 3. Arquitectura técnica

La protección diaria se implementa en PostgreSQL para cubrir todos los canales
y escrituras, incluida la reasignación de servicio. Un guard técnico por
Tenant/mascota usa upsert con incremento de revisión: serializa reservas y fuerza
conflicto MVCC también en Repeatable Read/Serializable. El disparador consulta
la jornada y servicio después de adquirir el guard. Conserva duplicados previos
cuando no cambia su identidad diaria; no permite introducir otros nuevos.

Identidad normal: serviceId. Registros legados sin servicio identificado se
comparan por tipo/bucket normalizado; si uno carece de identidad, se bloquea la
ambigüedad en el mismo tipo antes de crear otro. Dos servicios identificados
distintos se permiten. Portal conserva el serviceId que ya seleccionó.

La eliminación pertenece a un comando del contexto Agenda y su adaptador de
persistencia. Borra únicamente una reserva sin hechos operativos dependientes y
conserva un snapshot inmutable independiente de la fila eliminada. Las FK y el
bloqueo de fila cierran carreras con inserciones de historia/cobro/inventario;
no se eliminan dependientes ni se usa cascada. La interfaz ofrece esta acción
solo desde Calendario/Agenda; se reutilizan confirmación y protección de borrador.

## 4. Persistencia

`AppointmentBookingGuard`: clave técnica Tenant/mascota y revisión, sin entidad
nueva de negocio. `AppointmentRemoval`: appointmentId único, Tenant, instante,
actor/rol, motivo, estado previo y snapshot de la reserva. Sin FK hacia la
reserva eliminada; auditoría append-only. No contiene historia clínica.
Se prohíbe reutilizar el ID de una cita retirada. Índice Tenant/mascota/fecha.

## 5. Esquema físico y validación

Migración aditiva `20261021190000_appointment_duplicates_and_removal`.
No borra/backfillea citas existentes; disparador nuevo solo protege escrituras
posteriores. Restricciones y errores con nombre estable para traducir HTTP 409.
Verificar migraciones desde cero y drift, carreras entre reservas, fronteras
UTC/Bogotá, reprogramación, cambio de servicio, aislamiento y todos los bloqueos
de eliminación; recorrido real de navegador sobre datos desechables.

## Decisiones arquitectónicas diferidas

Sin borrado o corrección masiva de duplicados históricos, reapertura de historia,
anulaciones financieras ni restauración de reservas retiradas. No extender
gestión de citas del Portal ni habilitar WhatsApp como parte de este cambio.
