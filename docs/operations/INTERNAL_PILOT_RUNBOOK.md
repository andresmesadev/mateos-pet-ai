# Procedimiento y medición del piloto interno

**Estado:** preparado para completar y ejecutar; no certifica una beta externa.
**Actualizado:** 9 de octubre de 2026.
**Marco:** [plan vigente](CLOSED_BETA_READINESS_PLAN_20260919.md) y [aplicación de la revisión](VIABILITY_IMPROVEMENT_EXECUTION_20261009.md).

## Alcance y responsables

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

## Casos que faltan en agenda

Consultar el registro completo en [matriz de agenda](CLOSED_BETA_AGENDA_MATRIX_20260926.md). Los rechazos reales de veterinaria a las 10:00 y 17:00, así como domingo, festivo y cancelaciones, ya constan en ese registro; no se presentan como pendientes nuevos.

| Caso pendiente | Resultado requerido |
| --- | --- |
| Veterinaria al abrir 11:00 y último inicio 16:00 | Oferta y reserva solo si el turno está disponible; hora correcta en dashboard |
| Peluquería fuera del rango: 10:00 y 17:00 | Rechazo sin cita; no prometer un turno fuera de secuencia |
| Peluquería en festivo | Rechazo con la configuración efectiva, salvo apertura explícitamente configurada |
| Dos solicitudes al mismo turno veterinario | Como máximo una reserva; la otra recibe indisponibilidad o alternativa válida |
| Segundo turno de peluquería y hueco intermedio | Respetar la secuencia real de ocupación; no saltar el primer turno libre |
| Fallo de lectura de horarios | Ensayo aislado: no ofrecer disponibilidad usando valores predeterminados; conservar estado recuperable |

Elegir fechas futuras al ejecutar. Los ejemplos de septiembre del registro son evidencia histórica, no solicitudes para volver a enviar. No provocar fallos de base, detener contenedores ni cambiar horarios en producción para simular indisponibilidad. Los fallos se ensayan en una base aislada; los mensajes del canal real los envían los participantes autorizados.

Para cada caso registrar: fecha/hora UTC y Colombia, remitente de prueba identificado mediante alias, `wamid` y job en un registro privado, respuesta observable, estado de cola, cita, hora en dashboard y resultado de limpieza. El documento compartido no debe contener teléfonos, nombres de clientes, tokens, conversaciones completas ni historias clínicas.

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
