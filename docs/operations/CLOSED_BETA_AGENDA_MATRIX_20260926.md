# Matriz de agenda para beta cerrada — ejecución interna

**Fecha:** 2026-09-26
**Estado:** en curso. La validación automatizada pasó; falta ejecutar y registrar el recorrido real WhatsApp → cola → cita → dashboard.

## Configuración temporal aprobada

El operador definió 11:00–17:00 de lunes a sábado para el horario general, veterinaria y peluquería; domingo cerrado en las tres agendas. Se guardó en Administración → Agenda y disponibilidad de la VPS y persistió tras recargar la página. El cierre es exclusivo: el último turno que puede iniciar es a las 16:00. Los festivos colombianos permanecen cerrados por defecto, salvo una excepción de apertura explícita. No se crearon excepciones de prueba en producción.

## Evidencia y casos

| Caso | Resultado automatizado | Pendiente en canal real |
| --- | --- | --- |
| Veterinaria 10:00, 11:00, 16:00 y 17:00 | 10:00/17:00 rechazadas; 11:00/16:00 aceptadas si libres | Solicitud y confirmación por WhatsApp; verificar cita en dashboard |
| Peluquería en el mismo rango | Fuera de horario rechazado; 11:00 es primer turno | Ver propuesta y confirmación por WhatsApp |
| Domingo y festivo | Rechazados para ambos servicios | Solicitar esas fechas por WhatsApp y verificar que no se crea cita |
| Conflicto veterinario | Hora ocupada rechazada; otra hora libre permitida | Dos solicitudes al mismo turno |
| Orden de peluquería | 12:00 rechazada si 11:00 libre; aceptada si 11:00 ocupada; 13:00 sigue bloqueada si 12:00 libre | Solicitar saltar turno y verificar explicación del asistente |
| Cancelación | La búsqueda de ocupación excluye citas `cancelled` | Reservar, cancelar y comprobar liberación/reagendamiento en dashboard |
| Fallo de lectura del horario | Verificación y sugerencias devuelven indisponible; no usan horarios predeterminados | Simulación controlada fuera de producción o prueba de integración |

La prueba unitaria de cancelación valida la consulta y el filtrado mediante mocks; no demuestra todavía que el comando de cancelación y el dashboard reflejen el cambio. La prueba real de WhatsApp tampoco se deduce de estas pruebas unitarias.

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
