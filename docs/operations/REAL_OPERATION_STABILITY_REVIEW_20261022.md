# Operación real desde el 19/10 y continuidad de la observación

**Comprobación en VPS — 30/10:** la ventana 2.58.2 terminó el 29/10 a las
16:35 Colombia: 577 muestras, 48 horas, cero huecos y dos fallos iniciales de
OpenAI; veredicto `incident`. No se cierra automáticamente el criterio de
ventana limpia. Salud actual 200 y contenedores sin reinicios en la lectura.
[Evidencia y propuesta de recuperación independiente](STABILITY_AND_INDEPENDENT_RECOVERY_REVIEW_20261030.md).

**Publicación posterior — 27/10, 16:35 Colombia:** [2.58.2 publicada](../history/RELEASE_2_58_2_VPS_20261027.md)
con CI completo aprobado y solo backend recreado. La serie 2.58.1 se conserva
con 308 muestras y seis fallos hasta las 16:32:18; no se borró ni se sumó a
otra versión. Nueva ventana `ventana-2.58.2-20261027T213519Z`, activa desde
las 16:35:20; primera muestra HTTP 503 por OpenAI en 3.952 ms. HTTPS posterior
200 en 3.458 ms y cinco lecturas autenticadas 200. El ajuste está publicado,
pero la dependencia sigue intermitente y el ítem 9 **continúa abierto**.
Los apartados de preparación anteriores conservan el estado de sus cortes.

**Revisión del ítem 9 — 27/10, 16:23 Colombia: sigue abierto.** La misma
ventana `ventana-2.58.1-20261026T195700Z` conserva **306 muestras, 25,421 horas
y cinco timeouts de 25 segundos**: 10:37:12, 10:42:12, 14:47:16, 16:07:18 y
16:22:18 Colombia. Última muestra fallida a las 16:22:18; no hay huecos mayores
de 330 segundos y el intervalo máximo es 300,101 segundos. Se preservaron
archivos, configuración y proceso del observador. Los contenedores actuales
de backend/frontend tienen cero reinicios y `OOMKilled=false`; no equivale a
demostrar continuidad de todos los contenedores históricos.

Diagnóstico acotado de solo lectura: tres consultas `SELECT 1` respondieron
en 373, 3 y 1 ms; una ruta HTTP local sin autenticación respondió 401 en 326 ms.
En un proceso separado, tres consultas de modelos de OpenAI sin reintentos
fallaron con HTTP 500 (823, 7.932 y 4.666 ms). Otra, limitada a cinco segundos,
agotó su plazo. El SDK usa `api.openai.com`, sin base alternativa ni variables
de proxy; una petición sin credenciales devolvió el 401 esperado en 556 ms.
El log del servidor contiene un error de salud OpenAI 504 a las 16:16:45.
Estos hechos prueban fallos actuales de la dependencia desde la VPS; no
permiten atribuirle todos los timeouts anteriores ni afirmar pérdida de datos.

**Corrección preparada localmente, sin publicar:** el cliente OpenAI exclusivo
de salud declara ahora ocho segundos de espera y cero reintentos. Antes
heredaba diez minutos y dos reintentos del SDK, mientras el observador espera
solo veinticinco segundos. Si falla OpenAI, se mantiene estado `degraded`,
componente `openai: error` y HTTP 503; no se elimina el chequeo ni se transforma
un fallo en éxito. Las pruebas comprueban también el aborto del SDK real con
reloj simulado y una petición de red simulada, sin llamadas a proveedores.
Resultado: dos suites, once pruebas aprobadas. PostgreSQL conserva su
configuración: este ajuste no impone un plazo total al endpoint si la BD se
bloquea y no corrige por sí mismo los errores del proveedor.

Falta publicar el ajuste cuando se solicite despliegue, comprobarlo en el
entorno real y revisar una observación posterior suficiente para el criterio
de estabilidad. Evaluación de versión: mantenimiento de salud, candidato a
parche; el código declarado y la versión publicada siguen en 2.58.1 mientras
no se prepare la publicación. No se ejecutaron commit, push o despliegue.
La cobertura de 48 horas prevista para el 28/10 a las 14:57 **no será una
ventana limpia**, porque conserva estos fallos. Un despliegue posterior deberá
preservar esta evidencia y registrar su nueva ventana; no acreditar estabilidad
por borrar fallos, sumar versiones o cambiar el criterio de salud.

**Corte posterior — 27/10, 13:31 Colombia:** último registro a las 13:27:15,
271 muestras, 22,504 horas, los mismos dos timeouts e intervalo máximo 300,1 s.
Salud nueva HTTP 200, 2.58.1, base/OpenAI `ok`, worker pausado y saludable.
El ítem 4 se cierra por su criterio original de alerta y aviso recibido.
El diagnóstico de estos fallos y la evaluación de las 48 horas permanecen
abiertos aquí, en el ítem 9; no se borraron muestras ni se reinició la ventana.
[Separación del criterio y evidencia](OBSERVABILITY_REVIEW_20261027.md).

**Comprobación posterior — 27/10, 13:07 Colombia:** la misma ventana 2.58.1
conserva 267 muestras, 22,17 horas y **dos fallos**, a las 10:37:12 y 10:42:12
de hoy. Ambos agotaron el plazo de 25 segundos, con Nginx 499 correlacionado;
no se ha probado qué dependencia tardó. Sin huecos mayores de 330 segundos.
No se reinició ni alteró el observador y se preservan todas las series.
El 28/10 a las 14:57 se podrán revisar 48 horas de cobertura, si continúa;
los dos fallos impiden confundirlas con 48 horas limpias. La alerta controlada
de GitHub llegó al responsable, pero su programación presenta huecos de varias
horas. [Diagnóstico y evidencia de alertas](OBSERVABILITY_REVIEW_20261027.md).

**Comprobación de solo lectura — 26/10, 16:34 Colombia:** ventana actual
`ventana-2.58.1-20261026T195700Z` con **20 muestras**, del 26/10 14:57:01 al
16:32:01, **1 h 35 min, cero fallos**, intervalo máximo 300 segundos y ningún
hueco mayor de diez minutos. Observador activo; salud pública ok / 2.58.1 y
WhatsApp pausado. Las correcciones administrativas de datos no reiniciaron
esta ventana; el último cambio de imagen fue el despliegue de 2.58.1.

La serie previa de 2.58.0 conserva 559 muestras, **46 h 31 min y seis errores
`health_request_failed`**. Sus horarios Colombia son: 24/10 19:00; 25/10 02:15;
26/10 07:00, 09:00, 12:15 y 12:30. Son fallos del sondeo HTTPS; requieren
contrastar logs/recursos antes de afirmar que hubo indisponibilidad del servicio.
No se borran ni se declaran resueltos por el parche de acceso.

Primera oportunidad de revisar 48 horas de la versión actual: **28/10 a las
14:57 Colombia**, si no cambia la imagen y existe cobertura suficiente. El
transcurso de tiempo no sustituye la revisión de fallos ni constituye una
certificación automática. La operación real iniciada el 19/10 se conserva.

**Continuación — 26/10, 14:57:** [2.58.1 publicada](../history/RELEASE_2_58_1_VPS_20261026.md).
Nueva ventana `ventana-2.58.1-20261026T195700Z`, servicio activo desde las 14:57:01
Colombia. La anterior 2.58.0 se preserva con 559 muestras y seis fallos de sondeo,
del 24/10 16:20:13 al 26/10 14:50:50. No se declaran resueltos esos fallos ni
se suman ventanas para certificar 48 horas; continúa la operación real del centro.

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
