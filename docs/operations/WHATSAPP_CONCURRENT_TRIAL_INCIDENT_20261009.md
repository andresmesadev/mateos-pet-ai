# Incidente en la prueba de dos remitentes de WhatsApp

**Fecha:** 9 de octubre de 2026.
**Ventana inspeccionada:** 14:17–14:21 de Colombia, 19:17–19:21 UTC.
**Producción inspeccionada:** versión 2.45.0.
**Estado:** causas identificadas y correcciones locales; publicación y repetición real pendientes.

## Resultado observado

El operador hizo conversar a dos números de prueba en paralelo y reportó:
el cliente con historial no recibió la pregunta de servicio; al otro cliente
se le confundió su nombre con el de la mascota; un agradecimiento recibió
otro saludo. La lectura de logs, mensajes, sesiones y citas confirma esos
defectos. Las consultas fueron de solo lectura; no se enviaron mensajes ni se
modificaron citas desde esta investigación.

En la ventana inspeccionada, los **15 trabajos entrantes** terminaron
`done/complete`, sin `lastError` ni leases activos vencidos. Esto demuestra
procesamiento y envío, no que el contenido de las respuestas sea correcto.

| Hallazgo | Evidencia técnica | Corrección local |
| --- | --- | --- |
| Reserva antigua reutilizada | Ante una solicitud para mañana, el cliente con historial mantuvo `scheduling_date_key=2026-09-28` y servicio de peluquería. Se creó el 9 de octubre una cita para el 28 de septiembre a las 11:00 de Colombia; al inspeccionarla estaba en `no_show`. | Una solicitud nueva y los slots vencidos limpian los datos de reserva anteriores. Una solicitud genérica no recibe el servicio recuperado del historial por el extractor. La confirmación en el adaptador rechaza un instante pasado. |
| Nombre de cliente usado como mascota | La respuesta a la pregunta del nombre produjo el mismo valor en `client_name` y `pet_name`. La corrección explícita del cliente no retiró inicialmente ese alias. | El turno de identificación distingue los campos; una corrección explícita del dueño elimina el alias de mascota. Un nombre de mascota declarado expresamente se conserva. |
| Recogida anunciada antes de la dirección | “En casa” no fue reconocido como recogida; la regla volvió a preguntar, pero la reformulación de IA anunció que programaba la cita. El paso real seguía en `awaiting_domicilio`. | Se reconoce esa respuesta y se pide dirección. Las ofertas, preguntas de recogida y confirmaciones conservan el resultado de las reglas; las preguntas generales pueden seguir usando IA. |
| Nuevo saludo ante agradecimiento | Tras la cita, “Muchas gracias” recibió otra presentación de Lina. | El agradecimiento puro recibe una respuesta de cortesía, incluso si el extractor falla o lo clasifica como otro intent. No reinicia un saludo ni inventa otra reserva. |
| Confirmación incompleta, detectada al revisar código | Existía una rama que llamaba a `getConfirmationReply` sin fecha/hora validada, aunque no persistía ninguna cita. No se atribuye esta rama a los mensajes de la prueba. | Informa que no se guardó una cita y vuelve a solicitar fecha y hora. |

La segunda cita quedó `confirmed`, peluquería, **10 de octubre a las 11:00**.
Los dos registros tienen fechas diferentes. **No se comprobó una doble
reserva del mismo turno**, ni se puede dar por aprobada la exclusión por
concurrencia a partir de este recorrido.

No se encontró evidencia de mensajes de una persona guardados en el chat de
la otra. La confusión de nombres ocurrió dentro de un mismo diálogo. No se
declara auditado todo el aislamiento del sistema a partir de una sola prueba.

## Alcance de la reparación

- `booking-turn.service.js`: preparación de la sesión por turno y separación de identificación de cliente y mascota; utilidades de fecha y zona horaria existentes.
- `whatsapp.service.js`: aplica esas guardas antes de confirmar y combinar el análisis; no acepta confirmar una fecha pasada ni un horario inexistente.
- `conversation.service.js`: agradecimientos y protección del resultado operativo frente a la reformulación de tono.
- `intent-detector.service.js`: reconoce “en casa” como respuesta de recogida.

Es mantenimiento del adaptador de WhatsApp, sin una reescritura del motor,
entidades nuevas, migraciones ni modificaciones a los contextos de negocio.
La restricción de ocupación existente por establecimiento, servicio y fecha
se conserva. No se introduce una prohibición global de registros históricos
en `createAppointment`, que también sirve a otros canales; la guarda de fecha
pasada se aplica a las confirmaciones conversacionales.

**Versionado evaluado:** es una corrección funcional, por lo que corresponde
un parche (candidato 2.45.1) antes del commit de publicación y cualquier tag
oficial. Todavía no se cambió la versión ni se publicó; la VPS sigue en 2.45.0.

## Verificación

Pruebas de regresión: solicitud nueva con historial, confirmación de un slot
vencido (incluido uno anterior del mismo día en Colombia), cambio de fecha
durante la oferta, identificación de dueño, corrección de mascota, separación
de sesiones, recogida y ausencia de una confirmación inventada.

La primera ejecución general detectó dos fallos del montaje de pruebas: el
mock de zona horaria omitía las funciones reales ahora utilizadas. Se corrigió
el montaje para conservar esas utilidades. El ejecutor aislado también terminó
dos veces con código 9 sin resumen; esas ejecuciones no se consideran aprobadas.
Se utilizó la terminal nativa para obtener un resultado completo verificable.

**Evidencia final**, ejecutada después de todos los cambios:

```text
# backend: node node_modules/jest/bin/jest.js --runInBand --silent
Test Suites: 168 passed, 168 total
Tests:       1354 passed, 1354 total
Time:        50.275 s
Backend test exit=0

# frontend: node node_modules/eslint/bin/eslint.js .
Frontend lint exit=0
Sin diagnósticos

# node --check en los cuatro servicios de la reparación
JavaScript syntax: OK

# Enlaces locales de informe, matriz y plan
Missing links: 0
```

El backend no declara un comando de lint; no se presenta como ejecutado.
Las pruebas nuevas usan datos ficticios y colaboradores simulados, además de
las utilidades reales de fecha. No certifican un despliegue, una lectura de
horario durante una caída real de PostgreSQL ni un recorrido real con el
código local. La reserva simultánea del mismo turno aún debe repetirse en
el canal real después de publicar.

## Siguiente prueba real

1. Publicar la corrección probada y comprobar CI, versión y salud de la VPS.
2. Repetir la solicitud genérica desde un cliente con historial: debe preguntar el servicio y evaluar una fecha futura actual.
3. Comprobar identificación, nombre de mascota, recogida y agradecimiento con el segundo remitente.
4. Con ambos clientes preparados para confirmar **el mismo servicio, fecha y hora**, enviar las confirmaciones lo más cerca posible en el tiempo.
5. Verificar como máximo una cita activa, una respuesta coherente para el cliente que pierde el turno y los dos trabajos completos, con datos separados en dashboard.
6. Cancelar las reservas de prueba y comprobar la liberación. La limpieza de las dos citas de esta investigación no se ha ejecutado automáticamente.

Los días y horas se eligen con la configuración efectiva; no se reutilizan
fechas históricas de septiembre. Si la publicación reinicia el worker, ese
reinicio debe anotarse al evaluar la ventana de 48 horas; no se oculta para
obtener un resultado saludable.
