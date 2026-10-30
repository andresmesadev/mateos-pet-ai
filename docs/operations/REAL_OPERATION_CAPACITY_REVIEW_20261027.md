# Ítem 2 — capacidad en la operación real desde el 19/10

**Cierre del 27/10/2026, 12:13 Colombia:** ítem 2 aprobado para el alcance
observado de la beta manual de la veterinaria propia. Uso real desde el 19/10
contrastado con datos existentes, veinte minutos de recursos y veinte lecturas
HTTPS sobre el conjunto actual. No certifica capacidad máxima ni beta externa.

## Alcance y criterio vigente

El responsable solicitó evaluar primero el ítem 2 y recordó que el centro usa
la aplicación con datos reales desde el lunes 19 de octubre. Esa actividad
cuenta: no se exige empezar otra jornada ficticia, repetir operaciones ni
crear datos de prueba para demostrar que ya trabajan con el sistema.

El alcance actual es la beta manual del dashboard de la veterinaria propia:
clientes/mascotas, agenda, consultas, peluquería, medicamentos, caja e inventario.
WhatsApp permanece pausado por decisión del responsable. El requisito histórico
de cinco participantes de WhatsApp del ensayo del 13/10 no se traslada a esta
aceptación manual. No se habilitan nuevos consumidores, más workers ni otros centros.

Se conservan como referencias técnicas: RAM disponible mayor del 20 %, disco
libre mayor del 25 %, ausencia de OOM/reinicios, bloqueos o transacciones de
más de un minuto; p95 menor de dos segundos y cero 429/5xx en las lecturas
controladas. No son una certificación de capacidad máxima ni un SLA general.

## Actividad existente comprobada

Consulta agregada de solo lectura del 27/10 a las **11:55 Colombia**, limitada
al establecimiento autorizado y a las fechas de Colombia. Base real:
`mateos_dashboard_20261016`, 16.815.807 bytes en esa lectura. Datos conservados
en ese corte, después de anulaciones/eliminaciones auditadas:

| Fecha | Citas para ese día | Completadas | Canceladas | Cobros activos pagados | Movimientos de inventario |
| --- | ---: | ---: | ---: | ---: | ---: |
| 19/10 | 5 | 5 | 0 | 6 | 3 |
| 20/10 | 1 | 1 | 0 | 4 | 12 |
| 21/10 | 3 | 3 | 0 | 6 | 23 |
| 22/10 | 3 | 3 | 0 | 5 | 2 |
| 23/10 | 9 | 8 | 1 | 12 | 6 |
| 24/10 | 8 | 7 | 1 | 9 | 10 |
| 26/10 | 3 | 3 | 0 | 3 | 0 |
| **Total** | **32** | **30** | **2** | **45** | **56** |

El 25/10 y el 27/10 hasta ese corte no tienen actividad en esas categorías;
no se inventa una jornada cerrada para completar la tabla. El día 27 es parcial.
El censo actual es 261 clientes, 311 mascotas y 26 productos. Existen seis
cierres guardados. Se encontraron dos autores distintos de cobros y ningún
cobro del período sin autor registrado; eso no demuestra que ambas personas
actuaran exactamente al mismo tiempo. No se exponen identidades ni credenciales.

Las citas se agrupan por fecha de atención, los cobros por `paidAt` y los
movimientos por `occurredAt`. La fecha de creación de una cita no se confunde
con el día en que se atiende. No se cambian las fechas de las rectificaciones
ni se registra consumo retrospectivo de la vacuna que el responsable pidió conservar.

## Tráfico y errores históricos

Se procesaron dentro de la VPS quince archivos de access log, incluyendo sus
rotaciones comprimidas. Solo se agregaron rutas `/api/proxy/dashboard/` por
fecha, código HTTP y familia estática; no se extrajeron IPs, agentes, query,
IDs de mascotas, cuerpos de respuestas ni información de clientes.

El mayor minuto registrado del período fue de **35 solicitudes del proxy**
(20/10). Es un pico observado, no un límite de capacidad ni todo el tráfico
de la aplicación. Los logs también incluyen sondeos automáticos; las solicitudes
de permisos no se cuentan como nuevas atenciones ni como usuarios distintos.

Se preservan 429/5xx y otros errores de las versiones anteriores; el buen uso
informado no los borra ni los explica por sí solo. La clasificación de incidentes
permanece en el ítem 9, separado del criterio de alertas del ítem 4 cerrado el
27/10. En el tramo de 2.58.1 desde el 26/10 a las 14:57 hasta
el corte del análisis se observaron 1.455 respuestas 200, tres 201 y cuatro 499:
**ninguna 429 ni 5xx**. Los 499 indican cierre de la solicitud por el cliente;
no se atribuyen automáticamente a saturación ni se declaran resueltos.

El formato combined configurado no incluye duración de solicitudes. Por tanto,
**no existe una medición histórica de p95 de las operaciones desde el 19/10**.
Tampoco se hallaron series `sar` de CPU/RAM guardadas para esas jornadas:
el timer de recopilación estaba inactivo. No se reconstruyen valores inexistentes.

## Medición complementaria del 27/10

Observación de 81 muestras cada 15 segundos, durante veinte minutos, iniciada
a las 11:53 Colombia. Consultas PostgreSQL acotadas, sin escrituras, reinicios
ni cambios de configuración del servidor. Se verifica el nombre de la base
en cada resultado para evitar medir el histórico `mateos`.

La herramienta antigua tenía ese nombre fijo. Se corrigió para obtener solamente
el nombre de la base desde el entorno del backend, sin revelar su contraseña,
y fallar cerrado si falta, es inválido o no coincide. No se modificó el entorno
ni la conexión de la aplicación para adaptarla al medidor.

Se añadieron veinte lecturas HTTPS autenticadas sobre datos reales, secuenciales
y limitadas a cuatro por minuto, de agenda de la semana actual, cobros, inventario
y clientes. Son una comprobación técnica de tiempos; no se presentan como
actividad humana, una rampa de usuarios nuevos ni concurrencia de dos identidades.
No se crean citas, pagos, mensajes ni movimientos. La sesión de comprobación
mantiene sus cookies y credenciales solo en memoria.

### Lecturas HTTPS completadas

Veinte respuestas HTTP 200, sin 429/5xx. Final: 12:03:20 Colombia.
Mediana 19,73 ms; p95 global **58,73 ms**; máximo 61,37 ms. Cada solicitud
incluye descarga y análisis del JSON y excluye la pausa entre rondas.

| Lectura | Muestras | p95 |
| --- | ---: | ---: |
| Agenda | 5 | 61,37 ms |
| Cobros | 5 | 21,73 ms |
| Inventario | 5 | 16,87 ms |
| Clientes | 5 | 23,88 ms |

Muestra técnica pequeña desde la VPS a HTTPS, con una sesión administrativa
y sin escrituras. No representa tiempos históricos, tiempos de un celular ni
dos personas simultáneas; los actores reales se acreditan con el uso existente.

### Recursos: serie completa

**81 muestras, 1.200,040 segundos**, de 11:53:15 a 12:13:15 Colombia;
separación máxima 15,045 s. Todas identifican `mateos_dashboard_20261016`.

| Métrica | Resultado |
| --- | ---: |
| CPU media entre muestras | 2,81 % |
| CPU máxima entre muestras | 9,10 % |
| Memoria disponible mínima | 10,38 GiB / 89,17 % |
| Disco libre mínimo | 58,61 % |
| Conexiones cliente máximas, contando pool y sondeo | 11 de 100 |
| Clientes activos ajenos al sondeo, en los instantes muestreados | 0 |
| Esperas de lock / transacciones de más de 60 s | 0 / 0 |
| Nuevos deadlocks / bytes temporales | 0 / 0 |
| OOM / reinicios observados | 0 / 0 |

Los procesos o conexiones PostgreSQL no se equiparan a operadores simultáneos.
Los cero clientes activos ajenos al sondeo en esos instantes tampoco significan
que no hubiera consultas entre muestras. El tráfico de lecturas controladas
se identifica aparte y no se atribuye al equipo humano.

El muestreo de quince segundos puede omitir picos breves y el tramo actual
no reproduce la mayor carga histórica. Los futuros límites de otro centro,
tráfico externo o WhatsApp requieren su propio contraste; no se infieren aquí.

## Decisión y límites del cierre

Se acredita el uso real acumulado desde el 19/10 y el funcionamiento técnico
acotado con el volumen actual. Se cierra el pendiente original de capacidad
para la beta manual de este centro; no se exige repetir su primera jornada
ni reunir cinco usuarios de un canal expresamente excluido.

No se afirma haber medido CPU/p95 de todas las jornadas pasadas ni la capacidad
máxima bajo picos. Se mantienen las observaciones históricas del 13/10 como
antecedente con su versión/dataset originales, sin mezclarlas con esta serie.
Los incidentes históricos y las 48 horas de estabilidad siguen en el ítem 9.
El ítem 4 acredita el canal de alerta, sin resolver esos incidentes.
Un crecimiento relevante del volumen/concurrencia o un síntoma de
saturación obliga a contrastar nuevamente el alcance antes de ampliarlo.

Esta evidencia no justifica por sí sola contratar más recursos ni cambiar el
pool, desactivar límites, añadir workers o modificar la arquitectura. No se
hicieron esos cambios durante la revisión.

La corrección es de una herramienta diagnóstica y documentación: sin cambio
de reglas, esquema, versión de aplicación o despliegue. La conexión productiva
no se alteró para conseguir que el medidor pasara.

## Validación

- Cinco regresiones Python sobre la versión final del medidor: base operativa,
  rechazo de nombres inválidos, fallo del backend, destino de `psql` y discrepancia.
- Cinco casos funcionales del resolvedor con Node real: URL PostgreSQL y nombre
  codificado, más URL malformada, protocolo incorrecto y variable vacía. Cero
  salida de credenciales y ninguna conexión de base de datos desde esas fixtures.
- Dos pruebas existentes de seguridad de las herramientas de capacidad aprobadas.
- Ocho pruebas documentales aprobadas; verificación de 438 documentos y 1.310
  enlaces locales sin enlaces rotos ni errores de catálogo; `git diff --check`
  correcto. No se requiere build de la aplicación: solo se corrigió el medidor.
- Verificador final: 81 muestras, criterios de recursos, veinte HTTP 200 y
  p95 menor de dos segundos; resultado `pass_for_observed_manual_beta_scope`.

## Evidencia privada y continuidad

Resultados agregados en `/var/lib/mateos-pet-ai/capacity/20261027-real/` de la VPS.
`capacity-final.json` conserva los agregados y SHA-256 de las cuatro fuentes.
Serie de recursos: `093e45e1c5a4d30c339984c750b742dade526dbd89bfc92d739488cdd9849eca`.
Lecturas HTTPS: `fe26c0cba17643ec702c4f815e3d6f3461538f5437944d527a5349e3dfd69ef4`.
El reporte compartido no publica registros personales, cookies ni credenciales.
La observación de estabilidad del ítem 9 continúa independiente y no se reinicia
por esta medición. No se mezclan distintas versiones para completar sus 48 horas.
Salud productiva final a las 12:15:15 Colombia: versión 2.58.1, base/OpenAI `ok`,
WhatsApp pausado y observador de estabilidad activo. Serie terminada con 81
registros y proceso del medidor ya ausente, comprobados directamente en la VPS.
La conexión SSH local quedó esperando después de esa finalización y se cerró
solo tras comprobar la ausencia del proceso remoto. El resultado se acredita
con la serie completa, sus huellas y el verificador final, no con el código
de salida de esa conexión de transporte.
