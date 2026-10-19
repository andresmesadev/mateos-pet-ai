# Procedimiento y medición del piloto interno

**Estado:** preparado para completar y ejecutar; no certifica una beta externa.
**Actualizado:** 16 de octubre de 2026. Foco siguiente: [beta operativa en la veterinaria propia](OWN_CLINIC_BETA_REVIEW_20261016.md). Los ensayos y cuentas de ejemplo del 13 conservan sus límites; no acreditan autorización para datos ni operaciones reales.
**Marco:** [plan vigente](CLOSED_BETA_READINESS_PLAN_20260919.md) y [aplicación de la revisión](VIABILITY_IMPROVEMENT_EXECUTION_20261009.md).

**Puesta en marcha propia:** completar privadamente el [acta y listas de jornada](OWN_CLINIC_STARTUP_WORKSHEET.md). Financiero y Administración/Inventario están registrados desde el 16 de octubre; la [aplicación actual](OWN_CLINIC_BETA_APPLICATION_20261016.md) documenta su comprobación y la observación nueva de 48 h en la VPS. Su finalización y la aceptación humana siguen pendientes.

**Alcance actual posterior:** [arranque limpio solo dashboard](DASHBOARD_ONLY_CLEAN_START_20261016.md). Sin datos operativos anteriores ni WhatsApp activo; revisión de servicios y personal antes de copiarlos. Los ensayos de mensajes/cuentas descritos abajo son históricos y no deben ejecutarse en la base nueva. La ventana vigente comienza el 16 a las 10:25 Colombia.

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

La publicación activa es **2.48.0**, con [certificación productiva](../history/RELEASE_2_48_0_VPS_20261016.md) y WhatsApp privado apagado. Los ensayos siguientes corresponden a **2.46.7**: la [verificación de capacidad](VPS_CAPACITY_VERIFICATION_20261013.md) aprobó la preparación técnica; su cierre formal necesita uso real sostenido y cuentas propias del alcance acordado. Hay tres fichas de personal (administración, peluquería y veterinaria). La comprobación histórica del 13 de octubre a las **17:25:17 Colombia** encontró cero credenciales individuales activas; se habilitaron dos de ejemplo después, como consta abajo. No interpretar la ausencia de `StaffCredential` del administrador como un fallo de su cuenta.

**Actualización, 17:54:11 Colombia:** el responsable aclaró que las fichas solo tenían nombres y autorizó dos cuentas de ejemplo para ingresar. Se habilitaron sobre las fichas existentes de peluquería y veterinaria mediante la API administrativa autenticada, con correos ficticios y contraseñas aleatorias guardadas únicamente en un archivo local privado ignorado por Git. Ingreso HTTPS aprobado para ambas: identidad y tenant propios, `isSuperAdmin=false`, permisos de WhatsApp y de su área, sin administración ni finanzas; página operativa HTTP 200 y Administración restringida con HTTP 307 hacia inicio. Cero perfiles nuevos, cambios de rol o mensajes enviados. Se cerraron las sesiones individuales usadas por la herramienta. Estos accesos permiten el ensayo interno; no acreditan cuentas personales de una cohorte externa ni uso humano simultáneo todavía.

### Habilitar los accesos existentes

1. El responsable confirma quiénes serán los dos/tres operadores y sus correos de ingreso. Reutilizar sus fichas si ya existen; no crear personas ficticias ni duplicar integrantes para presentar concurrencia real.
2. Desde la cuenta administradora, abrir **Equipo** (`/dashboard/staff`), seleccionar el integrante y **Acceso**. Introducir el correo acordado y una contraseña inicial de **12 a 128 caracteres**; elegir **Habilitar acceso**. La contraseña se introduce en el formulario o se guarda por un medio privado acordado, nunca en este documento ni en el chat.
3. Mantener el perfil funcional y los permisos necesarios para su trabajo. Los perfiles veterinaria y peluquería pueden acceder a WhatsApp y a su área habilitada; no conceder administración, caja o cambios de precio solo para ejecutar la prueba. Comprobar permisos efectivos con cada sesión real.
4. Cada operador inicia sesión en su propio navegador/perfil. Verificar que aparezca su identidad, que acceda a su área y que no pueda abrir Administración sin autorización. Si se prueba una respuesta manual de WhatsApp, hacerlo únicamente con un destinatario de prueba autorizado y comprobar su autor.
5. Conservar separado el acceso administrativo existente. Actualizar una credencial invalida las sesiones anteriores; revocarla bloquea el ingreso individual y conserva la ficha y el historial. No enviar invitaciones ni contraseñas a terceros desde esta preparación.

El cupo HTTP es de **60 solicitudes por minuto por identidad y establecimiento**, además del límite común del proxy. Dos pestañas con el mismo login comparten un cupo; no acreditan dos operadores independientes. La prueba aislada de tres actores ya pasó, pero no representa sus sesiones reales.

### Bloque de uso real propuesto

Coordinar un bloque inicial de **20 minutos**, con las cuentas personales distintas y canales incluidos en la primera jornada. Registrar cuántas personas y remitentes participarán realmente; cinco remitentes no es un requisito universal. Si solo hay un número autorizado, se puede ensayar el uso del dashboard y ese canal, sin presentar el resultado como carga de cinco remitentes.

| Momento | Acción y evidencia |
| --- | --- |
| Antes | Acordar inicio/fin, responsable y soporte; registrar versión, salud, último respaldo, usuarios conectados, cola y recursos agregados. Revisar que las solicitudes usen fechas futuras y horarios reales. |
| Durante | Mantener WhatsApp y agenda abiertos en las sesiones reales; realizar búsquedas y consultas normales. Los participantes envían sus solicitudes desde el canal real. Evitar mensajes manuales de varios operadores al mismo chat mientras el asistente agenda. Registrar duración y problemas por alias. |
| Cada 15 segundos | Muestrear recursos con el procedimiento acotado de capacidad: CPU/RAM/disco, conexiones/bloqueos y cola. No reiniciar la observación independiente de 48 horas. |
| Después | Contrastar mensajes recibidos, respuesta saliente, recibos de entrega, estados de los jobs y agenda. Cancelar solo las citas de esta prueba mediante consentimiento en el canal y verificar liberación de turnos. |

Registrar p50/p95/máximo de creación del trabajo a respuesta y finalización por separado cuando la evidencia lo permita; `done/complete` no certifica entrega. El objetivo provisional de 30 segundos debe contrastarse con el tráfico observado y su volumen: una ráfaga simulada de cinco mensajes no equivale a cinco personas enviando mensajes ilimitados.

Ante un HTTP 429 inesperado en uso normal, backlog creciente, lease vencido, mensaje sin respuesta/entrega o mezcla de datos, detener la ampliación y diagnosticar. Una reserva incorrecta o duplicada exige detener el recorrido afectado. No aumentar cupos ni activar más workers para ocultar un fallo.

### Acta del bloque del 13 de octubre

**Preflight del 13 de octubre, 17:58:19–17:58:29 Colombia:** dos muestras de solo lectura, RAM disponible mínima 10,63 GiB, disco libre mínimo 71,01 %, CPU observada máxima 2,75 %, hasta once conexiones cliente; cero trabajos pendientes/en revisión, leases vencidos, bloqueos, transacciones largas, deadlocks, OOM o reinicios. Respaldo existente `Result=success`, `ExecMainStatus=0`, terminado a las 15:19:19 Colombia; timer activo. Archivo agregado privado `.cache/capacity/pilot-preflight-2.46.7-20261013.jsonl`. Esto es preparación, no veinte minutos de uso humano. El responsable indicó que prepararía las tres sesiones; se solicitó confirmar su apertura y enviar una consulta de horarios desde WhatsApp. A las 17:57:54 aún no había llegado ese mensaje ni trabajos nuevos durante los treinta minutos anteriores. Inicio y carga real siguen pendientes; no iniciar ni cerrar el bloque por esa intención de preparación.

| Dato | Resultado |
| --- | --- |
| Inicio/fin Colombia y versión | 18:00:21–18:20:21, 2.46.7; 81 muestras y veinte minutos completos |
| Operadores con cuentas distintas y permisos comprobados | Dos accesos de ejemplo y administrador existente; ingreso HTTPS previo y confirmación humana de perfiles correctos y navegación sin errores en tres sesiones |
| Remitentes verificados y solicitudes reales | Un remitente; saludo y consulta de horarios. No ráfaga de cinco remitentes |
| Recursos, latencias, cola y recibos | 10,61 GiB disponibles como mínimo; CPU máxima 11,00 %, hasta once conexiones; dos trabajos en 2,7–3,7 s, recibos correlacionados, sin bloqueos o leases vencidos observados |
| Errores de autorización, 429 inesperados y datos mezclados | 243 HTTP 200 y cero firmas de error en logs; responsable no reportó cambio de cuenta ni errores. Límite: Nginx no registra identidad por solicitud |
| Citas de prueba y limpieza comprobada | Este bloque consultó horarios y salud; no solicitó reservas nuevas ni sustituyó la limpieza del paso 8 |
| Decisión de alcance y cierre del paso 2 | Ensayo ligero aprobado; paso 2 abierto para contrastar la carga real propuesta de cinco participantes |

Evidencia, huellas y límites en [ensayo interno de capacidad](INTERNAL_PILOT_CAPACITY_TRIAL_20261013.md). La solicitud inicial declarada no llegó a la VPS; el saludo nuevo y la repetición de horarios sí llegaron y sus respuestas quedaron leídas. No hay evidencia para atribuir la ausencia inicial a una demora del motor. No repetir el paso 8 por este resultado.

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

Para la veterinaria propia, decidir apertura por las áreas y canales acordados en el acta: una línea empresarial aplazada no convierte el dashboard en inutilizable, pero tampoco habilita atención automática a todos los clientes desde el número de prueba. Registrar qué se usa y qué queda a cargo del equipo.
