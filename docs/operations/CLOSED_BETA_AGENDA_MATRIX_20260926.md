# Matriz de agenda para beta cerrada — ejecución interna

**Fecha:** 2026-09-26
**Estado:** en curso, con la prueba de concurrencia como siguiente comprobación. Se validaron recorridos reales de veterinaria, peluquería, domingo, festivo, rechazo fuera de horario veterinario y cancelación.

**Incidente de la prueba del 9 de octubre:** se encontraron reutilización de
un servicio y fecha antiguos, confusión dueño/mascota y un saludo ante
agradecimiento. Los 15 trabajos terminaron, pero las citas quedaron en días
distintos; el conflicto por el mismo turno no quedó comprobado. Reparación
local y repetición real pendientes de publicar; ver
[informe del incidente](WHATSAPP_CONCURRENT_TRIAL_INCIDENT_20261009.md).

**Seguimiento 2026-10-09:** el operador confirma el trabajo previo de agenda y solicita centrar el siguiente recorrido en dos personas conversando al mismo tiempo. Los festivos y el rechazo fuera de horario veterinario ya tienen evidencia real más abajo; no se presentan como pruebas nuevas pendientes. La tabla conserva la cobertura específica documentada de cada servicio, sin atribuir resultados a escenarios que no figuran en el registro.

### Próxima prueba: dos conversaciones y un mismo turno

**Adición aprobada 2026-10-10:** repetir el caso Akiles/veterinaria + Matías/peluquería; preguntar por hoy debe conservar mascota y servicio. Probar peluquería en una tarde con huecos vencidos: permite el primer turno aún reservable y sigue rechazando saltos sobre huecos futuros. En ambas agendas, negación no reserva; cancelación selecciona cita y confirma; reprogramación fallida conserva la original. Peluquería con recogida muestra dirección y espera una aceptación final. Esta adición define pruebas pendientes, no resultados de WhatsApp.

1. Dos remitentes verificados del mismo establecimiento conversan simultáneamente; cada uno conserva su nombre, mascota, servicio y estado de reserva.
2. Ambos solicitan el mismo turno veterinario libre, con fecha futura laborable, y confirman lo más cerca posible en el tiempo.
3. El resultado debe ser como máximo una cita activa para ese turno. El otro cliente recibe indisponibilidad o una alternativa válida; no recibe una confirmación de reserva inexistente.
4. Comprobar las dos conversaciones, los trabajos de la cola, los logs y el dashboard. Ambos mensajes deben procesarse y los datos de los clientes no deben mezclarse.
5. Cancelar la cita de prueba y comprobar la liberación del turno. Registrar la evidencia antes de cerrar el paso 8.

## Configuración temporal aprobada

El operador definió 11:00–17:00 de lunes a sábado para el horario general, veterinaria y peluquería; domingo cerrado en las tres agendas. Se guardó en Administración → Agenda y disponibilidad de la VPS y persistió tras recargar la página. El cierre es exclusivo: el último turno que puede iniciar es a las 16:00. Los festivos colombianos permanecen cerrados por defecto, salvo una excepción de apertura explícita. No se crearon excepciones de prueba en producción.

## Evidencia y casos

| Caso | Resultado automatizado | Canal real |
| --- | --- | --- |
| Veterinaria 10:00, 11:00, 16:00 y 17:00 | 10:00/17:00 rechazadas; 11:00/16:00 aceptadas si libres | 10:00 y 17:00 rechazadas por separado; 12:00 reservada y visible en dashboard; faltan pruebas reales de 11:00 y 16:00 |
| Peluquería en el mismo rango | Fuera de horario rechazado; 11:00 es primer turno | 11:00 reservada y visible en dashboard; faltan límites 10:00 y 17:00 |
| Domingo y festivo | Rechazados para ambos servicios | Veterinaria rechazó domingo 27/09 y festivo 12/10; peluquería rechazó domingo 27/09; sin citas en esos días |
| Conflicto veterinario | Hora ocupada rechazada; otra hora libre permitida | Falta prueba de dos solicitudes al mismo turno |
| Orden de peluquería | 12:00 rechazada si 11:00 libre; aceptada si 11:00 ocupada; 13:00 sigue bloqueada si 12:00 libre | Rechazó 14:00 y propuso 11:00; se confirmó ese primer turno |
| Cancelación | La búsqueda de ocupación excluye citas `cancelled` | Ambas citas de prueba canceladas; turnos liberados en BD y estado “Cancelada” en dashboard |
| Fallo de lectura del horario | Verificación y sugerencias devuelven indisponible; no usan horarios predeterminados | Falta simulación controlada fuera de producción o prueba de integración |
| Consulta de horarios | Usa la configuración efectiva del establecimiento | Informó veterinaria y peluquería de lunes a sábado 11:00–17:00; worker completo |

Las pruebas automatizadas cubren reglas aisladas; las pruebas del canal real registradas más abajo confirman los resultados observables de reserva, cancelación y consulta de horarios.

**Verificación local:** 9 suites y 104 pruebas relevantes pasaron con `npm test -- --runInBand --silent` (agenda, conflictos, excepciones, conversación y API). `node --check` pasó para los servicios modificados y `git diff --check` no reportó errores. El backend no define un script `lint` (`npm run lint` termina con `Missing script: "lint"`). La suite completa de Jest terminó prematuramente en este equipo Windows sin resumen de pruebas; no se considera aprobada.

## Correcciones surgidas durante la matriz

- El asistente prometía vacunación/desparasitación “cualquier día”, incluso domingo o festivo. Ahora indica horario de atención y excluye días cerrados y festivos.
- La pregunta de veterinaria mencionaba 11:00–17:00 como regla fija para todos los establecimientos. Ahora solicita fecha y hora y deja que la disponibilidad del establecimiento las valide.
- Si fallaba la consulta del horario, el motor usaba constantes antiguas y podía ofrecer un turno no autorizado. Ahora no ofrece ni valida turnos hasta poder leer la configuración.

## Cierre pendiente

Usar un remitente verificado del número de prueba de Meta y registrar fecha/hora, `wamid`, respuesta, estado final de `InboundJob` y cita resultante para cada escenario real. No crear citas ficticias ni enviar mensajes a clientes ajenos a la prueba. El paso 8 no se declara completo hasta comprobar también el resultado en el dashboard y la ausencia de errores del worker durante esas conversaciones.

**Primer recorrido real (2026-09-26, 19:19:33 UTC):** llegó “Quiero una cita de veterinaria para el domingo 27 de septiembre a las 12:00 para mi perro”. `InboundJob` terminó `done/complete`, un intento y sin `lastError`; el asistente respondió “Antes de continuar, ¿con quién tengo el gusto? 😊” a las 19:19:39 UTC. La base seguía con cero citas activas. Este resultado confirma entrada, worker e identificación inicial del cliente; todavía **no** confirma el rechazo del domingo porque el diálogo no llegó a evaluar la fecha. Falta continuar con nombre y datos de mascota.

**Continuación (19:20–19:21 UTC):** el cliente indicó su nombre y repitió la solicitud. Ambos trabajos quedaron `done/complete` sin error. El asistente pidió el nombre de la mascota y escribió “Así puedo agendar mejor la cita para el domingo 27 de septiembre a las 12:00”. No reservó nada, pero esa redacción anticipa una fecha cerrada antes de validar disponibilidad. Registrar como hallazgo de conversación P1 y comprobar el rechazo efectivo al continuar el flujo. Sigue habiendo cero citas activas.

**Rechazo confirmado (19:23 UTC):** tras recibir “akiles”, el asistente contestó “Ese domingo 27 de septiembre no tenemos atención veterinaria … ¿Qué otro día te queda bien?”. El trabajo terminó `done/complete` en un intento, sin error, y la base siguió con cero citas activas. La regla de domingo funciona de punta a punta. La siguiente pregunta “cual es el horario que manejan” también llegó y terminó correctamente en la cola, pero recibió la plantilla genérica de servicios; esta falla está corregida solo en el código local y requiere despliegue y repetición de la prueba.

**Correcciones locales adicionales:** la reformulación con IA ya no puede insinuar la aceptación de una fecha mientras pregunta datos de la mascota; la respuesta a “¿cuál es el horario?” ahora lee la configuración efectiva por servicio. Tras esos cambios, 8 suites y 88 pruebas relevantes pasaron. Ninguna de estas dos correcciones adicionales está aún desplegada en la VPS.

**Día hábil ofrecido (19:26 UTC):** el cliente solicitó veterinaria para Akiles el lunes 28 de septiembre a las 12:00. El trabajo quedó `done/complete` en un intento y el asistente pidió confirmar ese turno, coherente con el horario configurado. La base aún no tenía citas: faltaba la confirmación del cliente.

**Fallo de doble confirmación (19:29 UTC):** tras “si confirmo”, el asistente volvió a preguntar “¿Confirmamos?” y no persistió la cita. Los logs mostraron que la oferta anterior había dejado `step=awaiting_date_time`, con `date` y `time` iguales al texto completo del cliente; `parseTimeToHour` leyó el día **28** como hora. La respuesta de IA había insinuado una oferta válida pese al estado real. En la segunda vuelta el extractor de IA devolvió `lunes 28 de septiembre` y `12:00`, y recién entonces se guardó `step=awaiting_confirmation`, `scheduling_date_key=2026-09-28`, `scheduling_hour=12`.

**Corrección local:** `extractExplicitSchedulingTerms` entrega solo el fragmento horario (“a las 12:00”), no la oración completa, y las respuestas de validación veterinaria quedan fijadas por la regla de disponibilidad. Se añadió regresión con la frase exacta de la prueba. También se bloquea la oferta si falla la consulta del horario en `scheduling.service.js`, y sus mensajes de horario ya no citan horas fijas para todos los establecimientos. Nueve suites y 104 pruebas relevantes pasaron. El recorrido real debe repetirse tras desplegar estos cambios.

**Reserva real confirmada (19:33 UTC):** una segunda respuesta “Si confirmo” llegó a `InboundJob` (`done/complete`, un intento y sin error). El asistente confirmó la cita de Akiles para el 28 de septiembre a las 12:00 hora Colombia. `Appointment` quedó `confirmed`, `serviceType=vet`, `date=2026-09-28T17:00:00Z`; la agenda web mostró “Akiles” en la semana 28 Sep – 4 Oct. Queda pendiente cancelar esta cita de prueba y comprobar la liberación del turno.

**Despliegue de correcciones (19:41 UTC):** commit `c79d232` en `main`, CI completo verde (pruebas backend, PostgreSQL real y lint frontend). La VPS hizo fast-forward a ese commit, reconstruyó el backend y aplicó cero migraciones pendientes. El primer `curl` de salud ocurrió durante el arranque y devolvió `connection reset`, por lo que `deploy.sh` salió con código 1; la comprobación posterior respondió `status=ok`, `database=ok`, `openai=ok`, `inboundWorker=ok`. Las referencias anteriores a “solo local” describen el estado previo a este despliegue. Falta repetir los escenarios afectados con el código nuevo.

**Cancelación real (21:32 UTC):** el mensaje “Cancela mi cita del lunes 28 de septiembre para Akiles” terminó en `InboundJob` `done/complete`, un intento y sin `lastError`. El asistente respondió que canceló la cita del 28/09/2026 a las 12:00 hora Colombia. `Appointment.status` pasó a `cancelled` y `isSlotAvailable` devolvió `true` para veterinaria el 28/09/2026 a las 12:00. El calendario conserva la fila histórica y la rotula “Cancelada”; ya no bloquea el turno. Queda así validada la cancelación y liberación, aunque el paso 8 general sigue abierto para peluquería, festivos, conflicto concurrente y la repetición con el nuevo código.

**Orden de peluquería (21:35 UTC):** al pedir peluquería para Akiles el lunes 28 a las 14:00, el asistente rechazó ese turno fuera de secuencia y propuso las 11:00, primer turno disponible. `InboundJob` quedó `done/complete` en un intento, sin error, y no se creó ninguna cita. Falta confirmar el turno, completar la pregunta de recogida y verificar la cita en agenda.

**Reserva de peluquería (21:37–21:38 UTC):** el cliente aceptó el turno de las 11:00 y respondió que llevaría a Akiles al salón. Ambos trabajos terminaron `done/complete` en un intento, sin `lastError`. `Appointment` quedó `confirmed`, `serviceType=grooming`, `date=2026-09-28T16:00:00Z`; el dashboard mostró “Confirmada”, 11:00 a. m., `grooming`. Falta cancelar esta cita de prueba y verificar que el turno vuelva a estar disponible.

**Cancelación de peluquería (21:39 UTC):** el mensaje “Cancela mi cita de peluquería del lunes 28 para Akiles” terminó `done/complete` en un intento, sin `lastError`. El asistente confirmó la cancelación; `Appointment.status=cancelled` y `isSlotAvailable` devolvió `true` para peluquería el 28/09/2026 a las 11:00. Las dos citas creadas durante esta prueba están canceladas y no ocupan horarios.

**Festivo: fallo detectado (21:40–21:41 UTC):** el cliente pidió “Quiero cita veterinaria para Akiles el lunes 12 de octubre a las 12:00”. `InboundJob` terminó `done/complete` en un intento, sin `lastError`, pero el asistente respondió “2026-09-28 a las 12pm está disponible ¿Confirmamos la cita?”. No hubo ninguna cita el 12/10; el turno propuesto es incorrecto y no debe confirmarse. Causa: `parseDateToKey` resolvía el nombre “lunes” antes de la fecha explícita “12 de octubre”, por lo que elegía el lunes próximo. Se cambió el orden del parser para priorizar la fecha concreta y se añadió regresión con la frase exacta. **Pendiente:** desplegar la corrección y repetir la prueba real del festivo; el paso 8 sigue abierto.

**Festivo: repetición correcta (21:47 UTC):** tras desplegar `3a3c690` (CI verde y salud de VPS `ok`), el cliente repitió exactamente el mensaje del 12 de octubre. El asistente respondió “Ese día no tenemos atención 😔 ¿Qué otro día te queda bien?”. `InboundJob` quedó `done/complete`, un intento, `lastError=null`; no existe cita para el 12/10. Queda corregido y validado el caso del festivo, aunque la matriz general sigue abierta.

**Consulta real del horario (21:48 UTC):** a “¿Cuál es el horario que manejan para veterinaria y peluquería?”, el asistente respondió que ambos servicios atienden de lunes a sábado de 11:00 a 17:00 y que los festivos cierran salvo apertura especial. `InboundJob` terminó `done/complete`, un intento y `lastError=null`. La respuesta usa la configuración efectiva y cierra la repetición pendiente de la antigua respuesta genérica.

**Límites fuera de horario (21:51–21:53 UTC):** primero llegó en un solo mensaje la solicitud de 10:00 y 17:00, y el asistente rechazó el horario; ese mensaje combinado no permite atribuir el rechazo a cada hora. Se repitieron por separado: a las 17:00 respondió “Ese horario está fuera de nuestra atención para ese día”, y luego dio la misma respuesta para las 10:00. Ambos `InboundJob` terminaron `done/complete` en un intento, sin `lastError`. No se creó ninguna cita nueva: las únicas citas del 28/09 siguen `cancelled`.

**Peluquería en domingo (21:54 UTC):** a “Quiero peluquería para Akiles el domingo 27 de septiembre a las 11:00”, el asistente respondió que el domingo 27 no hay atención y ofreció buscar otro día. `InboundJob` terminó `done/complete`, un intento y `lastError=null`; no existe cita el 27/09. No se confirmó ninguna alternativa.

**Publicación posterior (2026-10-09, 15:02 de Colombia):** la reparación de
sesión, nombres y respuestas del incidente de dos remitentes está desplegada
en **2.45.1**, con CI, salud y acceso autenticado al dashboard aprobados.
Ver [evidencia de publicación](../history/RELEASE_2_45_1_VPS_20261009.md).
La matriz sigue abierta para repetir esos escenarios y confirmar con dos
remitentes el mismo turno; el despliegue no demuestra ese resultado.
