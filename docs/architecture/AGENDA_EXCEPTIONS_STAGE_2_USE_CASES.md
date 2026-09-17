# Excepciones de Agenda — Etapa 2: Casos de uso

**Estado:** propuesta para aprobación de Etapa 3  
**Precondición:** Etapa 1 aprobada el 2026-09-17.

## Vocabulario cerrado

| Concepto | Valores |
| --- | --- |
| Alcance (`scope`) | `all`, `vet`, `grooming` |
| Regla (`mode`) | `closed`, `open` |
| Ventana horaria | `open` y `close` en formato `HH:mm`; obligatoria para `open`, ausente para `closed` |
| Vigencia | `startDate` obligatoria, `endDate` opcional e inclusiva |

`open` representa tanto una apertura excepcional en un festivo como un horario
reducido en un día ordinario. No se introduce un tercer modo porque la ventana
horaria expresa ambos casos sin ambigüedad.

## UC-01 — Consultar excepciones de agenda

**Actor:** Administrador del establecimiento.  
**Entrada:** rango opcional de fechas.  
**Resultado:** excepciones del tenant autenticado, ordenadas por fecha inicial,
con alcance, modo, horario y motivo.

No se exponen excepciones de otro tenant. El panel puede consultar el período
visible del calendario, sin cargar indefinidamente toda la historia.

## UC-02 — Crear excepción de agenda

**Actor:** Administrador del establecimiento.  
**Entrada:** `scope`, `mode`, `startDate`, `endDate?`, `open?`, `close?`,
`reason?`.

**Flujo principal:**

1. Se identifica el tenant desde la sesión autenticada.
2. Se valida el vocabulario, fechas y ventana horaria.
3. Se verifica que no exista otra excepción del mismo tenant y alcance que se
   solape con el período solicitado.
4. Se persiste la excepción.
5. Se calculan las citas activas que quedan por fuera de la nueva regla.
6. Se responde la excepción creada junto con un resumen de citas afectadas.

**Resultado para las citas existentes:** se conservan exactamente como están;
el resumen informa identificador, fecha, cliente, mascota y servicio para que
administración actúe manualmente.

## UC-03 — Modificar excepción de agenda

**Actor:** Administrador del establecimiento.  
**Entrada:** identificador de excepción y los campos modificables.

**Reglas:**

- La excepción debe pertenecer al tenant autenticado.
- Se vuelve a validar el período y cualquier solapamiento, excluyendo el
  registro que se modifica.
- Se recalculan las citas afectadas y se devuelven al panel.
- Las citas existentes no cambian de estado ni de fecha.

## UC-04 — Eliminar excepción de agenda

**Actor:** Administrador del establecimiento.  
**Entrada:** identificador de excepción.

La eliminación restablece inmediatamente la regla inferior de precedencia
(festivo, horario del servicio o general). No toca citas existentes.

## UC-05 — Resolver disponibilidad efectiva

**Actor:** motor de disponibilidad, agenda de WhatsApp y API de reserva.  
**Entrada:** `tenantId`, `dateKey`, `serviceType`.

**Resultado:** una ventana efectiva `{ active, startHour, endHourExclusive }`.

**Reglas:**

1. Busca una excepción específica del servicio que cubra la fecha.
2. Si no existe, busca una excepción global que cubra la fecha.
3. Una excepción `closed` devuelve `active: false`.
4. Una excepción `open` devuelve la ventana que declara, aunque la fecha sea
   festivo nacional.
5. Sin excepción, aplica el festivo colombiano y luego los horarios definidos
   por servicio y generales según ADR 012.

Este caso de uso se invoca desde un único punto de resolución de disponibilidad
para que validar una cita y sugerir horarios tengan siempre la misma respuesta.

## Reglas de solapamiento

- Dos excepciones con el mismo `scope` no pueden cubrir un mismo día.
- Una excepción global puede coexistir con una específica de veterinaria o de
  peluquería; la específica gana para ese servicio.
- Dos excepciones específicas de servicios distintos pueden coexistir.
- Un rango se considera inclusivo en ambas fechas.

## Errores de dominio esperados

| Código conceptual | Situación |
| --- | --- |
| `AgendaExceptionNotFound` | El registro no existe o no pertenece al tenant. |
| `InvalidAgendaExceptionRange` | Fecha o ventana horaria inválida. |
| `AgendaExceptionOverlap` | Existe otra excepción del mismo alcance para un día del período. |
| `InvalidAgendaExceptionScope` | El alcance no es `all`, `vet` ni `grooming`. |
| `InvalidAgendaExceptionMode` | El modo no es `closed` ni `open`. |

## Eventos y automatizaciones

La primera versión no enviará mensajes ni cancelará citas automáticamente. Por
eso no se introduce una automatización ni un evento de dominio nuevo como
efecto de la configuración. El registro queda auditable por su propio modelo y
las rutas administrativas. Si se incorpora comunicación proactiva a clientes,
deberá ser un entregable posterior que defina primero su política de
notificación y consentimiento.

## Resultado de la etapa

Los cinco casos de uso cierran el contrato funcional: administración configura
la excepción, disponibilidad la resuelve, y las citas ya comprometidas se
visibilizan sin cambios automáticos. La siguiente etapa decide módulos,
repositorios, rutas y el punto único de integración técnica.
