# Operación real desde el 19/10 y continuidad de la observación

**Continuación — 24/10, 16:20:** [2.58.0 publicada](../history/RELEASE_2_58_0_VPS_20261024.md).
Nueva ventana `ventana-2.58.0-20261024T212012Z`, servicio activo desde las 16:20:13
Colombia. La anterior 2.57.1 se preserva con 21 muestras y cero fallos, de 14:37:54
a 16:17:54. No se suman ventanas para certificar 48 horas; continúa la operación real.

**Continuación — 24/10, 14:37:** [2.57.1 publicada](../history/RELEASE_2_57_1_VPS_20261024.md).
Nueva ventana `ventana-2.57.1-20261024T193753Z`. La anterior de 2.57.0 se conserva
con ocho muestras y cero fallos, desde las 13:57:24 hasta 14:32:24 Colombia.
No se suman ventanas para certificar 48 horas; continúa el avance operativo real.

**Continuación — 24/10, 13:57:** [2.57.0 publicada](../history/RELEASE_2_57_0_VPS_20261024.md).
Nueva ventana `ventana-2.57.0-20261024T185723Z`. La anterior de 2.56.0 queda
conservada con 21 muestras y cero fallos; no se agregan a otra ventana para
certificar continuidad. El avance de la operación real desde el 19/10 permanece.

**Continuación — 24/10:** publicada [2.56.0](../history/RELEASE_2_56_0_VPS_20261024.md),
con nueva ventana `ventana-2.56.0-20261024T171456Z` desde las 12:14:56 Colombia.
La de 2.55.2 queda conservada con 266 muestras y un fallo previo; no se declara
resuelto ni se suman ventanas para certificar 48 horas. El uso real iniciado
el 19/10 y los avances operativos se conservan.

**Continuación — 23/10:** el [mantenimiento de Ubuntu](VPS_OS_MAINTENANCE_RESULT_20261023.md)
se completó y la serie aquí descrita se detuvo expresamente. Terminó con
203 muestras y tres timeouts de salud anteriores al mantenimiento. Nueva
ventana `ventana-2.55.1-20261023T171725Z`, desde las 12:17 Colombia del 23/10.
El corte del 22/10 que sigue se conserva como evidencia histórica.

**Corte:** 22/10/2026, 20:07 Colombia. **Revisión de solo lectura.**

El responsable confirmó que desde el lunes **19 de octubre** la veterinaria
utiliza el dashboard con clientes reales, citas de peluquería y veterinaria,
venta de medicamentos y registro de pagos. Informa que la operación va bien y
que los hallazgos se corrigen mientras lo utilizan. No es una base ficticia ni
una simulación de esas operaciones. Los ensayos ficticios anteriores pertenecen
a otra etapa histórica, no describen los datos actuales.

## Qué se interrumpió

El servicio de observación está `active/running`, con inicio el 22/10 a las
18:36:13 Colombia. Salud consultada de nuevo: HTTP 200, versión 2.55.1,
estado/base/OpenAI `ok`, worker `paused`. Ambos contenedores de aplicación
están en ejecución desde el despliegue del 22/10 a las 18:36:06; su contador
de reinicios es cero. Ese contador corresponde a los contenedores actuales,
no a toda la operación desde el lunes.

El procedimiento de despliegue detuvo expresamente la ventana anterior y
creó una nueva para cada versión. `observe-production.cjs` exige una sola
versión esperada, sin fallos/huecos, para certificar la ventana de salud de
48 horas. No se pausó porque el responsable dejara de abrir el dashboard o
cerrara su PC: el observador corre en la VPS.

Por tanto, sí se interrumpieron las ventanas técnicas por las publicaciones;
eso no reinicia la puesta en marcha real, elimina los registros acumulados ni
demuestra una caída del dashboard. Las recreaciones de contenedores durante
despliegue y los intervalos sin muestras tampoco permiten afirmar servicio
ininterrumpido de extremo a extremo.

## Series conservadas desde el lunes

Todas las fechas/horas siguientes están en Colombia. Se revisaron los JSONL
preservados en la VPS, sin modificarlos ni iniciar otra ventana.

| Versión | Primera muestra | Última muestra | Muestras | Fallidas |
| --- | --- | --- | --- | --- |
| 2.50.0 | 19/10 13:06 | 19/10 14:21 | 16 | 0 |
| 2.50.1 | 19/10 14:27 | 19/10 17:02 | 32 | 0 |
| 2.50.2 | 19/10 17:08 | 19/10 17:28 | 5 | 0 |
| 2.50.3 | 19/10 17:35 | 19/10 18:00 | 6 | 0 |
| 2.50.4 | 19/10 18:06 | 19/10 22:06 | 49 | 0 |
| 2.51.0 | 19/10 22:12 | 19/10 22:47 | 8 | 0 |
| 2.52.0 | 19/10 22:53 | 20/10 17:23 | 223 | 0 |
| 2.53.0 | 20/10 17:28 | 21/10 17:28 | 289 | 0 |
| 2.54.0 | 21/10 17:34 | 22/10 14:09 | 248 | 8 |
| 2.55.0 | 22/10 14:14 | 22/10 18:29 | 52 | 0 |
| 2.55.1 — activa | 22/10 18:36 | 22/10 20:06 | 19 | 0 |

**Total revisado:** 947 muestras, 939 correctas y ocho fallidas. El intervalo
entre primera y última muestra abarca aproximadamente 79 horas a través de
once versiones; no equivale a 79 horas certificadas sin interrupciones ni a
48 horas completas de una misma versión. No hay muestras anteriores a las
13:06 del lunes entre las series seleccionadas; el inicio del uso real ese
día está confirmado por el responsable, no deducido del primer sondeo.

Dentro de cada serie no se detectaron intervalos entre muestras mayores de
330 segundos (periodicidad 300 s, tolerancia 30 s). Entre ventanas hubo siete
intervalos mayores de ese umbral, de aproximadamente 6 a 7 minutos entre
sondeos. Esto mide ausencia de observación entre puntos, no minutos de caída
de la aplicación. Las demás transiciones quedaron por debajo del umbral.

Las ocho muestras fallidas pertenecen a 2.54.0: siete
`health_request_failed` y una `openai_error`. Las siete no tienen respuesta
HTTP registrada y no permiten atribuir por sí solas la causa al dashboard,
red o dependencia. El error de OpenAI tampoco demuestra fallo de una venta o
cita. Conservar el incidente y correlacionar sus tiempos con logs/alertas antes
de atribuir impacto. No se deduce pérdida de datos ni disponibilidad porcentual
de la aplicación a partir de estos sondeos.

## Cómo se contabiliza el avance

- **Uso y aceptación operativa:** conservar lo realizado desde el 19/10 y el
  reporte favorable del responsable. No volver a pedir que empiecen la operación
  ni reproduzcan ventas/citas reales para simular una primera jornada.
- **Salud técnica de una versión:** ventana actual con 19 muestras y 1,50002 h
  al corte, todavía incompleta. No juntar versiones para cumplir su criterio.
- **Siguiente intervención:** la actualización de Ubuntu continúa aplazada al
  23/10 con recuperación comprobada antes de cambiar el sistema. Después de
  esa intervención, dejar una ventana de 48 h sin despliegues de mejoras,
  salvo corrección urgente. El centro puede seguir trabajando normalmente;
  registrar cualquier cambio e incidencia y su efecto sobre la ventana.

No se reinició el observador, aplicación o VPS en esta revisión. No se cambió
configuración ni se escribieron datos de clientes, cobros o inventario.

Referencias: [seguimiento vigente](CLOSED_BETA_STATUS_20261022.md),
[funcionamiento del observador](PERSISTENT_STABILITY_OBSERVATION.md),
[publicación 2.55.0](../history/RELEASE_2_55_0_VPS_20261022.md),
[publicación 2.55.1](../history/RELEASE_2_55_1_SECURITY_20261022.md).
