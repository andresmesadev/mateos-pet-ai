# Auditoría de contexto de reserva por WhatsApp — 10 de octubre de 2026

**Estado de esta evidencia:** incidente reproducido en la base publicada. Correcciones locales posteriores y pendientes de validación real en [informe de ejecución](VIRTUAL_ASSISTANT_IMPROVEMENTS_EXECUTION_20261010.md). Versión inspeccionada: 2.45.2, commit `ac6709b`. Paso 8 abierto; no habilita beta externa.

## Conclusión

El motor perdió el objetivo de la conversación: reservar **peluquería para Matías**. Interpretó una pregunta de disponibilidad como consulta de citas existentes, mostró la cita veterinaria de Akiles y borró el paso de reserva. Las aclaraciones posteriores volvieron a la misma respuesta.

Hay además un bloqueo distinto en la disponibilidad de peluquería: exige llenar un turno anterior que ya no se puede reservar por el margen de anticipación. La cita veterinaria no ocupa el cupo de peluquería.

## Evidencia de la prueba real

Horas de Colombia del 10 de octubre; transcripción limitada al incidente, sin teléfonos ni datos de acceso.

| Hora | Mensaje o resultado |
| --- | --- |
| 11:50:53 | Cliente: «Quiero una cita para mi otra mascota». |
| 11:51:05 | Cliente elige grooming. El asistente pregunta qué mascota y lista Akiles. |
| 11:51:17 | Cliente: «Matias». |
| 11:51:20 | Asistente ofrece el 13 de octubre a las 11:00 para Matias. |
| 11:51:32 | Cliente: «Para hoy ya no hay ?». |
| 11:51:36 | Asistente lista una cita veterinaria del 10 de octubre a las 13:00, sin nombre de mascota. |
| 11:51:59 | Cliente: «Si pero esta es para peluquería». El asistente vuelve a ofrecer el día 13. |
| 11:52:33 | Cliente: «No tienes para hoy cita de peluquería». Vuelve a listar la cita veterinaria. |
| 11:52:47 | Cliente: «Pero es de akiles no de matias». Repite la misma lista. |
| 11:54:04 | Cliente: «Y es para quien esa cita». Repite la lista sin mascota. |

La sesión inspeccionada conserva `pet_name=Matias` y `requested_service=bath_grooming`, pero termina con `step=null` e intención `query_appointments`. Los nueve trabajos recientes de esta conversación quedaron `done/complete`: el fallo observado es de diálogo, no de procesamiento atascado. Ese estado de la cola no certifica por sí solo entrega de Meta.

Para este cliente solo se encontró Akiles como mascota persistida y su cita veterinaria confirmada a las 13:00. **Matías quedó seleccionado en el borrador de conversación; no se creó una mascota persistida ni una cita para él.** El diseño actual crea la mascota nueva al confirmar una reserva válida, no al mencionar su nombre.

## Hallazgos y prioridades

| ID | Prioridad | Hallazgo | Evidencia técnica |
| --- | --- | --- | --- |
| C01 | Alta | Una intención propuesta por el LLM puede interrumpir una reserva sin contrastarla con el objetivo activo. «Para hoy ya no hay?» no coincide con los patrones literales de consulta, pero termina en ese manejador. | `intent-detector.service.js:77` acepta directamente `query_appointments`; `conversation.service.js:348–350` prioriza gestión antes del flujo de reserva. |
| C02 | Alta | Una consulta informativa elimina el paso de reserva, dejando mascota y servicio sin un paso coherente. | `handleQueryAppointments`, `conversation.service.js:180–196`, devuelve `step=null`, `sessionPatch={}`. La sesión real confirma esa combinación. |
| C03 | Alta | Cancelación sin selección de cita y reprogramación que cancela antes de validar el reemplazo. Es un riesgo encontrado en código, no una cancelación observada en esta prueba. | `appointment.service.js:229–252` selecciona por cliente y fecha descendente; `conversation.service.js:159–172` cancela y después pide fecha/hora. No selecciona por mascota, servicio o ID solicitado. |
| C04 | Media | La consulta de citas no identifica la mascota. Por eso no responde «¿para quién?». | `formatAppointmentListLine`, `appointment.service.js:170–188`, solo imprime servicio, fecha y hora. |
| C05 | Alta | La secuencia de peluquería puede bloquear el resto del día por un hueco anterior que ya no es reservable. | `availability-db.service.js:44–48` aplica 30 minutos; líneas 202–207 exigen todos los turnos previos desde apertura, sin exceptuar los vencidos o dentro del margen. Reproducción abajo. |
| C06 | Media | Pedir solamente un día no limita la búsqueda de peluquería a ese día. Las aclaraciones reciben otra vez la próxima fecha global. | `conversation.service.js:570–593` resuelve solicitud explícita solo con fecha y hora juntas; línea 423 vuelve a ofrecer el siguiente turno global. |
| C07 | Media | La protección contra datos históricos no cubre suficientemente la especie cuando se menciona el nombre nuevo. La prueba avanza desde «Matias» sin preguntar perro/gato. | `booking-turn.service.js:64–79` protege `pet_type` cuando el nombre no se menciona; cuando sí se menciona, permite el tipo del análisis. El mensaje no aporta especie y no existe una mascota Matías persistida. La procedencia exacta de ese tipo queda por instrumentar; no se debe tratar como dato confirmado. |

### Reproducción de disponibilidad

Se invocaron las funciones reales de disponibilidad dentro del backend de la VPS, mediante lectura, usando la hora del mensaje «Matias»: `2026-10-10T16:51:17Z`, **11:51:17 Colombia**. La reproducción usa los registros inspeccionados, no una instantánea histórica previa a cada mensaje.

- Horario de ambos servicios: lunes a sábado 11:00–17:00; domingo cerrado.
- Registros del día: peluquería 11:00 en `no_show`; veterinaria 12:00 y 13:00 confirmadas. La consulta actual de ocupación incluye cualquier estado distinto de `cancelled`.
- El turno de peluquería de las 12:00 está libre, pero queda dentro de los 30 minutos de anticipación: el límite es 12:21:17.
- Las 13:00 y posteriores quedan bloqueadas porque las 12:00 no están ocupadas. Los turnos veterinarios usan otro grupo de capacidad y no cubren ese hueco.
- Resultado real: `groomingSlotsForDay=[]`, siguiente turno `{date: "2026-10-13", hour: 11}`. El domingo 11 y el festivo 12 están cerrados según la configuración efectiva.

**Decisión propuesta para la regla de peluquería:** exigir el primer turno libre entre los que aún se puedan reservar; un hueco vencido o dentro del margen no debe bloquear toda la tarde. Con los datos de esta reproducción, las 13:00 serían el primer candidato, sujeto a la misma validación de horario y ocupación. Esta es una aclaración funcional pendiente de aceptar/documentar, no una disponibilidad ya habilitada en producción.

Conservar la secuencia de turnos futuros: si a primera hora 11:00 sigue siendo reservable y está libre, no ofrecer arbitrariamente 12:00 o 13:00. Reconciliar esta precisión con la matriz de agenda y el runbook antes de implementar; no eliminar la regla consecutiva ni inventar capacidad adicional.

## Diseño de mejora recomendado

### 1. Conservar un objetivo de reserva explícito

El borrador actual debe identificar mascota seleccionada, servicio, día solicitado, turno ofrecido y datos que falta confirmar. Una pregunta informativa puede responderse sin borrarlo. El historial aporta contexto, pero no elige automáticamente otra mascota o servicio para la reserva nueva.

Añadir el arbitraje de intención en el adaptador conversacional existente: usar mensaje actual y paso activo para distinguir una pregunta sobre la propuesta de una orden sobre una cita ya guardada. El LLM propone interpretación; las reglas y consultas existentes deciden qué operación corresponde. Pasar el contexto activo al análisis ayuda, pero el prompt por sí solo no constituye protección suficiente.

No iniciar una reescritura completa ni incorporar otro proveedor, cola o base de datos para este incidente. Reutilizar los servicios actuales, el aislamiento por establecimiento y las validaciones de disponibilidad/confirmación. Si el diseño exige un caso de uso o persistencia nuevos, definirlos formalmente antes del código.

### 2. Preguntas sobre hoy y recuperación del diálogo

Consultar el día indicado con las funciones de disponibilidad existentes. Si está cerrado, explicar la causa efectiva; si no quedan turnos, indicarlo y ofrecer la siguiente fecha. No repetir una cita de otro servicio como respuesta a disponibilidad.

Una aclaración «esta es para peluquería» o «para Matías» debe actualizar el borrador, reconocer la corrección y continuar desde el dato faltante. No sobrescribir silenciosamente una propuesta pendiente con datos de otra cita. Si sigue habiendo ambigüedad, hacer una pregunta concreta.

### 3. Seleccionar la cita antes de gestionarla

Listar mascota, servicio, fecha y hora. Resolver la cita objetivo por propiedad del cliente y establecimiento autenticado, con ID interno y los datos explícitos del mensaje. Si hay varias coincidencias o no se sabe cuál, preguntar; no elegir la última por defecto.

Cambiar la fecha de una propuesta sin confirmar modifica el borrador: no cancela una cita guardada. Para reprogramar una cita existente, conservar la original hasta confirmar y validar el reemplazo. Diseñar una operación segura frente a conflictos y fallos antes de implementar; no asumir que ya existe un caso de uso atómico para ello.

### 4. Datos de la mascota con procedencia clara

La especie de una mascota ya registrada se obtiene de su registro seleccionado. Para una mascota nueva, exigir una respuesta explícita o una mención inequívoca como «mi perro Matías». No heredar la especie de Akiles. La respuesta final debe distinguir selección de mascota, registro persistido y cita confirmada.

## Casos de aceptación antes de cerrar el paso 8

| Caso | Resultado exigido |
| --- | --- |
| Akiles tiene consulta; el cliente pide peluquería para Matías | Mantener ambas operaciones independientes; confirmar mascota y especie nueva, sin modificar la cita de Akiles. |
| «¿Para hoy ya no hay?» después de ofrecer un turno | Consultar disponibilidad de hoy para el servicio activo; conservar mascota y borrador; explicar resultado real. |
| «No tienes para hoy cita de peluquería» | Responder sobre disponibilidad, no listar una consulta veterinaria. |
| «Pero es de Akiles, no de Matías» / «¿para quién es esa cita?» | Identificar de qué cita se habla y mostrar mascota; no entrar en la repetición observada. |
| «¿Cuándo es mi cita de Akiles?» durante otra reserva | Responder la consulta y conservar la reserva pendiente de Matías. |
| «Quiero agendar mi cita» | No activar consulta por la subcadena «mi cita»; continuar la reserva. |
| «Otra hora» durante una propuesta no confirmada | Buscar otra opción permitida sin cancelar una cita existente. |
| Cancelación con varias mascotas/citas | Confirmar la cita objetivo; solo cambia ese ID, dentro de la identidad autorizada. |
| Reprogramación cuyo reemplazo falla o está ocupado | La cita original sigue vigente; responder con otra opción sin anunciar éxito. |
| Peluquería a las 11:51, hueco 12:00 no reservable | Tras aprobar la aclaración de regla, ofrecer primer turno futuro válido; mantener margen, duración, cierres y secuencia futura. |
| Hueco futuro 11:00 libre y petición 13:00 | Continuar exigiendo el primer turno consecutivo; no saltar el hueco reservable. |
| Dos confirmaciones simultáneas del mismo turno | Como máximo una cita activa; el otro cliente recibe una alternativa coherente. |

## Validación ejecutada y límites

Además de la lectura de mensajes, sesión, mascotas, citas y trabajos en la VPS y la reproducción de disponibilidad, se ejecutó el comando existente de pruebas focalizadas:

```text
npm test -- --runInBand --runTestsByPath src/__tests__/unit/availability-db.service.test.js src/__tests__/unit/booking-turn.service.test.js src/__tests__/unit/conversation.service.completed-flow.test.js
Test Suites: 3 passed, 3 total
Tests:       54 passed, 54 total
Snapshots:   0 total
Time:        3.458 s
Exit code:   0
```

También se ejecutó `npm run lint` en `frontend`: salida `> eslint`, sin diagnósticos, código de salida **0**. `git diff --check` terminó con código **0**; solo avisó de la conversión habitual de LF a CRLF en la guía existente.

El resultado prueba que los casos ya codificados pasan; **no** que el incidente esté corregido. Faltan regresiones específicas de los mensajes reales, selección de cita objetivo y huecos anteriores no reservables. No se cancelaron citas ni se crearon registros como parte de la inspección.

## Orden de ejecución

1. Diseñar y probar arbitraje de intención, conservación del borrador, respuesta por mascota y especie con fuente confiable (C01, C02, C04, C06, C07).
2. Proteger cancelación/reprogramación mediante selección inequívoca y conservación de la cita original (C03), antes de ensayar esas operaciones con varias mascotas.
3. Resolver y documentar la aclaración de secuencia respecto de turnos que ya no se pueden reservar, y aplicar la misma regla en todas las rutas de disponibilidad (C05).
4. Repetir la conversación exacta, comprobar mensajes/cola/agenda y ejecutar conflicto por el mismo turno. Guardar resultados en la matriz del paso 8; evaluar estabilidad de infraestructura por separado.

**Recomendación:** continuar estas correcciones y sus pruebas dentro de la validación interna supervisada. La salud de infraestructura no equivale a calidad conversacional suficiente para abrir el piloto externo.
