# Procedimiento y medición del piloto interno

**Estado:** preparado para completar y ejecutar; no certifica una beta externa.
**Actualizado:** 13 de octubre de 2026.
**Marco:** [plan vigente](CLOSED_BETA_READINESS_PLAN_20260919.md) y [aplicación de la revisión](VIABILITY_IMPROVEMENT_EXECUTION_20261009.md).

## Alcance y responsables

**Reorganización del asistente (2026-10-10):** cancelar exige seleccionar cita y confirmar; reprogramar conserva la original hasta validar y moverla. Peluquería pide aceptación final después de mostrar recogida y dirección. Repetir negativos («No confirmo», duda de precio), dos mascotas, cambio de servicio y petición de hoy. Un hueco vencido no bloquea la tarde; sí un hueco futuro. Revisar `InboundJob` con `provider=whatsapp` para procesamiento y `provider=whatsapp_delivery` para recibos `sent/delivered/read/failed`; `done` del procesamiento no certifica entrega. Ante envío incierto, `needs_review`: no reintentar a ciegas.

| Dato obligatorio | Valor |
| --- | --- |
| Establecimiento y tenant autorizado | Por completar por el operador |
| Responsable de operación y suplente | Por completar |
| Participantes y perfiles | Por completar; solo participantes autorizados |
| Destinatarios verificados disponibles en Meta | Comprobar cupos antes de invitar |
| Inicio y fin del ensayo | Por acordar, hora Colombia |
| Ventana y canal de soporte | Por acordar; no se promete soporte permanente |
| Objetivo de recuperación (RTO) | Por acordar y contrastar con el ensayo |
| Pérdida máxima tolerable de datos (RPO) | Por acordar y contrastar con la frecuencia de copia |

Se conserva el número de prueba; no se registra un número empresarial ni se contratan servicios nuevos en este procedimiento. Los documentos legales del piloto continúan siendo una condición independiente del plan. Esta guía no sustituye política, términos ni acuerdo revisados.

## Comprobación antes de cada sesión

1. Confirmar versión, salud del backend, PostgreSQL y worker.
2. Revisar el respaldo diario, su copia independiente cuando esté autorizada y el resultado del último ensayo de restauración.
3. Confirmar horarios efectivos y excepciones por servicio en Administración. El horario temporal aprobado es lunes a sábado 11:00–17:00, cierre exclusivo y domingo cerrado; no cambiarlo para hacer pasar una prueba.
4. Confirmar perfiles y establecimiento. No usar credenciales administrativas para simular que los permisos de recepción están validados.
5. Revisar cola y registrar sus totales antes de la prueba. Evitar mensajes externos y trabajos de negocio que no formen parte del ensayo autorizado.

## Agenda: cierre del paso 8

El paso 8 quedó cerrado el 13 de octubre, tras verificar recogida con rechazo final, dos mascotas del mismo propietario, conflicto de reprogramación y cancelación de las reservas de prueba. Consultar el cierre y sus límites en [prueba de seguridad del asistente](ASSISTANT_BOOKING_SAFETY_TRIAL_20261010.md) y la evidencia histórica en [matriz de agenda](CLOSED_BETA_AGENDA_MATRIX_20260926.md). Las antiguas listas de pendientes corresponden a sus fechas de captura; no reiniciar esa matriz para preparar las cuentas del piloto.

Un incidente nuevo exige revisar el recorrido afectado y registrar su regresión; la prueba de capacidad tampoco sustituye las comprobaciones funcionales ya realizadas.

Elegir fechas futuras al ejecutar. Los ejemplos de septiembre del registro son evidencia histórica, no solicitudes para volver a enviar. No provocar fallos de base, detener contenedores ni cambiar horarios en producción para simular indisponibilidad. Los fallos se ensayan en una base aislada; los mensajes del canal real los envían los participantes autorizados.

Para cada caso registrar: fecha/hora UTC y Colombia, remitente de prueba identificado mediante alias, `wamid` y job en un registro privado, respuesta observable, estado de cola, cita, hora en dashboard y resultado de limpieza. El documento compartido no debe contener teléfonos, nombres de clientes, tokens, conversaciones completas ni historias clínicas.

## Preparación de cuentas y capacidad: paso 2

La publicación activa es **2.46.7**. La [verificación de capacidad](VPS_CAPACITY_VERIFICATION_20261013.md) aprobó la preparación técnica; su cierre formal necesita uso real sostenido y cuentas propias. Hay tres fichas activas de personal (administración, peluquería y veterinaria). La comprobación de la VPS del 13 de octubre a las **17:25:17 Colombia** encontró cero credenciales individuales activas; el administrador conserva el ingreso del entorno. No interpretar la ausencia de `StaffCredential` del administrador como un fallo de su cuenta.

### Habilitar los accesos existentes

1. El responsable confirma quiénes serán los dos/tres operadores y sus correos de ingreso. Reutilizar sus fichas si ya existen; no crear personas ficticias ni duplicar integrantes para presentar concurrencia real.
2. Desde la cuenta administradora, abrir **Equipo** (`/dashboard/staff`), seleccionar el integrante y **Acceso**. Introducir el correo acordado y una contraseña inicial de **12 a 128 caracteres**; elegir **Habilitar acceso**. La contraseña se introduce en el formulario o se guarda por un medio privado acordado, nunca en este documento ni en el chat.
3. Mantener el perfil funcional y los permisos necesarios para su trabajo. Los perfiles veterinaria y peluquería pueden acceder a WhatsApp y a su área habilitada; no conceder administración, caja o cambios de precio solo para ejecutar la prueba. Comprobar permisos efectivos con cada sesión real.
4. Cada operador inicia sesión en su propio navegador/perfil. Verificar que aparezca su identidad, que acceda a su área y que no pueda abrir Administración sin autorización. Si se prueba una respuesta manual de WhatsApp, hacerlo únicamente con un destinatario de prueba autorizado y comprobar su autor.
5. Conservar separado el acceso administrativo existente. Actualizar una credencial invalida las sesiones anteriores; revocarla bloquea el ingreso individual y conserva la ficha y el historial. No enviar invitaciones ni contraseñas a terceros desde esta preparación.

El cupo HTTP es de **60 solicitudes por minuto por identidad y establecimiento**, además del límite común del proxy. Dos pestañas con el mismo login comparten un cupo; no acreditan dos operadores independientes. La prueba aislada de tres actores ya pasó, pero no representa sus sesiones reales.

### Bloque de uso real propuesto

Coordinar un bloque inicial de **20 minutos**, con dos/tres cuentas distintas y los números verificados realmente disponibles. El alcance técnico propuesto es un establecimiento y hasta cinco participantes de WhatsApp. Antes de comenzar, registrar el número real de personas y remitentes; si solo hay un número, se puede ensayar el uso del dashboard, pero no presentar ese resultado como carga de cinco remitentes.

| Momento | Acción y evidencia |
| --- | --- |
| Antes | Acordar inicio/fin, responsable y soporte; registrar versión, salud, último respaldo, usuarios conectados, cola y recursos agregados. Revisar que las solicitudes usen fechas futuras y horarios reales. |
| Durante | Mantener WhatsApp y agenda abiertos en las sesiones reales; realizar búsquedas y consultas normales. Los participantes envían sus solicitudes desde el canal real. Evitar mensajes manuales de varios operadores al mismo chat mientras el asistente agenda. Registrar duración y problemas por alias. |
| Cada 15 segundos | Muestrear recursos con el procedimiento acotado de capacidad: CPU/RAM/disco, conexiones/bloqueos y cola. No reiniciar la observación independiente de 48 horas. |
| Después | Contrastar mensajes recibidos, respuesta saliente, recibos de entrega, estados de los jobs y agenda. Cancelar solo las citas de esta prueba mediante consentimiento en el canal y verificar liberación de turnos. |

Registrar p50/p95/máximo de creación del trabajo a respuesta y finalización por separado cuando la evidencia lo permita; `done/complete` no certifica entrega. El objetivo provisional de 30 segundos debe contrastarse con el tráfico observado y su volumen: una ráfaga simulada de cinco mensajes no equivale a cinco personas enviando mensajes ilimitados.

Ante un HTTP 429 inesperado en uso normal, backlog creciente, lease vencido, mensaje sin respuesta/entrega o mezcla de datos, detener la ampliación y diagnosticar. Una reserva incorrecta o duplicada exige detener el recorrido afectado. No aumentar cupos ni activar más workers para ocultar un fallo.

### Acta del bloque (por completar con evidencia real)

| Dato | Resultado |
| --- | --- |
| Inicio/fin Colombia y versión | Pendiente |
| Operadores con cuentas distintas y permisos comprobados | Pendiente de correos y habilitación |
| Remitentes verificados y solicitudes reales | Pendiente |
| Recursos, latencias, cola y recibos | Pendiente |
| Errores de autorización, 429 inesperados y datos mezclados | Pendiente |
| Citas de prueba y limpieza comprobada | Pendiente |
| Decisión de alcance y cierre del paso 2 | Abierto; no inferir cierre de los ensayos aislados |

**Observación independiente al preparar esta guía:** 23 muestras de 2.46.7, desde las 15:33:35 hasta las 17:23:35 del 13 de octubre, sin muestras fallidas. Son 1 hora y 50 minutos; no 48 horas completas. La ventana prevista termina el 15 de octubre a las 15:33:35 si la captura mantiene continuidad.

## Aceptación del frontend con el equipo

Recorrer con los perfiles correspondientes:

1. Buscar un cliente, entrar a su mascota y revisar una cita sin perder el contexto.
2. Abrir una consulta o peluquería desde agenda y volver al recorrido operativo.
3. Revisar un cobro pendiente, comprobar su resultado y buscarlo desde caja.
4. Encontrar un producto y comprobar una operación de inventario pendiente sin repetir un envío incierto.
5. Recuperar un formulario tras un fallo controlado **en local**, conservando sus datos.

Anotar tiempo, ayuda necesaria, confusión y errores; no solo si la pantalla abre. En un puesto de prueba, verificar zoom real de Chrome al 200 %, recorrido con teclado y anuncios de un lector de pantalla. Confirmar que etiquetas, errores y resultados de guardado se entienden. Los ensayos automáticos anteriores no sustituyen escuchar esos anuncios.

## Hoja semanal de medición

Los objetivos se acuerdan antes de medir; no se presentan como estándares del sector. No recopilar datos personales nuevos para rellenar esta hoja.

| Indicador | Cómo medirlo | Base inicial | Semana 1 | Semana 2 | Decisión |
| --- | --- | --- | --- | --- | --- |
| Reservas correctas / solicitudes terminadas | Contrastar fecha, hora, servicio y dashboard | Por medir | | | |
| Confirmaciones incorrectas o duplicadas | Contar incidentes; cada uno requiere análisis | Por medir | | | |
| Respuestas fallidas o no entregadas | Contrastar cola y estados de entrega; `done` solo no basta | Por medir | | | |
| Uso semanal por perfil | Tareas realmente realizadas por participantes | Por medir | | | |
| Tiempo por tarea | Comparar la misma tarea antes y después, con permiso del participante | Por medir | | | |
| Diferencias de caja o inventario | Conciliar registros y operaciones del ensayo | Por medir | | | |
| Tiempo de capacitación y soporte | Registrar minutos por motivo | Por medir | | | |
| Coste atribuible por establecimiento | Infraestructura, IA, mensajería y soporte con costes reales | Por medir | | | |
| Disposición a pagar | Respuesta del responsable, sin asumir una venta | Por validar | | | |

La renovación a 30/60/90 días se mide cuando exista una oferta comercial autorizada y usuarios de pago; no se infiere de este ensayo interno.

## Registro de incidentes

| Fecha/hora Colombia | Área | Impacto | Evidencia privada | Responsable | Corrección y nueva prueba | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

Detener el recorrido afectado y escalar ante una cita incorrectamente confirmada, cobro duplicado, acceso de otro establecimiento, pérdida de datos o imposibilidad de recuperar una operación. No repetir escrituras inciertas a ciegas. La versión anterior de la publicación tiene un procedimiento de recuperación en su informe de release; una recuperación de datos requiere acordar y comprobar el destino definitivo.

## Transferencia a otro operador

El suplente debe poder localizar el respaldo, verificarlo y ensayar restauración siguiendo [la guía de recuperación](DATABASE_BACKUP_AND_RESTORE.md), consultar salud y cola y encontrar el procedimiento de despliegue de la publicación activa. Registrar tiempo real y obstáculos. No entregar claves privadas por chat ni copiarlas a la VPS.

## Decisión al concluir

Consolidar los casos de agenda, ventana de salud, capacidad, incidencias, aceptación del frontend y mediciones. Si falta evidencia, mantener el punto abierto. Una beta externa requiere las condiciones 1–9 del plan, incluido el paso de WhatsApp que sigue aplazado por decisión del operador.
