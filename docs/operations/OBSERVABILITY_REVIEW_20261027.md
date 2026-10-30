# Revisión de observabilidad — 27 de octubre de 2026


> Actualización editorial de marca — 28/10/2026: se usa Huella Nex por solicitud de Andrés. Se conservan las fechas, versiones, decisiones y condiciones originales; esta edición no registra nuevas aprobaciones ni autorizaciones de clientes.

**Estado: ítem 4 cerrado el 27/10 para su criterio original de alertas.**
El responsable confirmó la recepción del aviso y eligió conservar GitHub con
su limitación de frecuencia explícita. La investigación de los sondeos lentos
permanece abierta en el ítem 9; no se declara resuelta con este cierre.
El diagnóstico inicial no modificó producción; la publicación posterior
autorizada del parche se registra a continuación.

**Publicación posterior — 27/10, 16:35 Colombia:** [2.58.2](../history/RELEASE_2_58_2_VPS_20261027.md)
publicada con CI aprobado, espera OpenAI de ocho segundos y cero reintentos.
Se conservó la serie 2.58.1 con 308 muestras/seis fallos; nueva observación
2.58.2 activa. Primera muestra 503 por OpenAI; consulta posterior 200. No se
ocultan errores ni se cierra el ítem 9 por publicar el límite de espera.

## Continuación del diagnóstico del ítem 9 — 27/10, 16:23 Colombia

El corte posterior amplía la evidencia: 306 muestras, 25,421 horas y cinco
timeouts en la ventana 2.58.1; último fallo a las 16:22:18. Los cuatro primeros
se correlacionaron con Nginx 499 sin cuerpo, sin identificador de petición
que permita demostrar causalidad por dependencia. El quinto se registró
después de esa lectura de logs. No hubo reinicio del observador ni cambios
de producción por esta investigación.

Las mediciones separadas encontraron `SELECT 1` rápido y errores actuales de
OpenAI: tres HTTP 500 y un plazo de cinco segundos agotado; el servidor
registró además un error OpenAI 504 a las 16:16:45. El destino del SDK es
`api.openai.com`, sin `OPENAI_BASE_URL` ni variables de proxy configuradas.
No se comprobó un incidente global de OpenAI ni que todos los timeouts
históricos tengan la misma causa. Tampoco se demuestra que todos los flujos
del dashboard hayan estado caídos. [Corte, tiempos y límites](REAL_OPERATION_STABILITY_REVIEW_20261022.md).

Se preparó un parche **solo local**: cliente de salud OpenAI con ocho segundos
y cero reintentos; mantiene `degraded` y HTTP 503 si falla. Dos suites y once
pruebas aprobadas, incluido el aborto del SDK real mediante red/reloj simulados.
El límite pertenece a esa dependencia; una espera de PostgreSQL continúa
fuera de ese límite. No se desplegó ni se cambiaron el criterio del monitor,
las alertas o sus destinatarios. La evidencia filtrada adicional se conserva
en una copia privada local; los documentos públicos excluyen credenciales,
IP de acceso, contenidos de mensajes y datos de pacientes.

Los cortes de las 13:07 y 13:31 que siguen permanecen como evidencia histórica,
no son el estado más reciente. El cierre del ítem 4 no cambia; el 9 sigue abierto.

## Criterio de cierre y separación de pendientes

El [plan original](CLOSED_BETA_READINESS_PLAN_20260919.md) define el ítem 4:
«Sentry o equivalente recibe una excepción controlada y existe alerta de
salud/worker». El workflow existente vigila salud y worker; la prueba
controlada falló como estaba previsto, el responsable recibió el aviso y la
comprobación normal posterior terminó correctamente. El criterio está cumplido.

La revisión anterior mantuvo el ítem abierto al añadirle el diagnóstico de los
timeouts. Se corrige ese seguimiento: el ítem 4 acredita la detección y el
canal de aviso existentes; el ítem 9 conserva los fallos, su diagnóstico y la
evaluación de continuidad. No se exige contratar ni activar Sentry para cerrar
un criterio que admite expresamente un equivalente. Tampoco se certifica una
frecuencia externa garantizada ni estabilidad sin fallos.

Comprobación final de lectura: 27/10 a las **13:31:05 Colombia**, HTTP 200,
versión 2.58.1, base y OpenAI `ok`, worker `paused` y saludable. Último corte
del observador a las 13:27:15: 271 muestras, 22,504 horas, los mismos dos
timeouts y ningún hueco mayor de diez minutos (máximo 300,1 segundos).

## Alerta comprobada

El responsable autorizó la prueba del workflow existente `Production health
alert` y confirmó: «Sí, llegó el aviso».

- [Prueba controlada 40558217063](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/40558217063):
  fallo intencional, marcador `Controlled observability alert test` y salida 1.
  Esa rama termina antes de consultar la aplicación; no provocó una caída.
- [Comprobación normal posterior 40558569586](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/40558569586):
  finalizada correctamente.
- Configuración publicada: cron `5 * * * *`, consulta HTTPS a
  `https://bot.nexoweb.co/api/health`, plazo máximo 25 segundos y validación
  de base, OpenAI y worker. La pausa intencional del worker está admitida.

La periodicidad configurada no coincide con la observada: entre las últimas
ejecuciones programadas hay intervalos de aproximadamente 4,6 a 6,8 horas;
la muestra de cien ejecuciones contiene un máximo de 9,9 horas. No se ha
demostrado la causa del retraso. La recepción del aviso no certifica vigilancia
externa horaria efectiva ni avisos dentro de cinco minutos.

## Fallos de los sondeos y límites del diagnóstico

Corte de la ventana actual: **27/10, 13:07 Colombia**. Identificador
`ventana-2.58.1-20261026T195700Z`: 267 muestras, 22,17 horas y dos fallidas,
sin huecos entre muestras mayores de 330 segundos.

| Serie conservada | Fallos | Clasificación comprobada |
| --- | --- | --- |
| 2.54.0 | 8 | Siete plazos agotados; un HTTP 503 con base `ok`, OpenAI `error` y worker `paused`. |
| 2.55.1 anterior al mantenimiento | 3 | Tres plazos agotados. |
| 2.55.2 | 1 | Un plazo agotado. |
| 2.58.0 | 6 | Seis plazos agotados. |
| 2.58.1 actual, hasta el corte | 2 | Plazos agotados el 27/10 a las 10:37:12 y 10:42:12 Colombia. |

En total se clasificaron veinte registros fallidos: diecinueve agotaron
25.000–25.002 ms; uno recibió respuesta HTTP 503 indicando OpenAI degradado.
Los plazos agotados se correlacionan con respuestas Nginx 499 sin cuerpo,
aproximadamente 25 segundos después del inicio del sondeo. La petición llegó
a Nginx y el cliente dejó de esperar; eso no identifica qué dependencia tardó
ni demuestra indisponibilidad de todas las funciones del dashboard.

El endpoint espera en paralelo `SELECT 1`, `OpenAI.models.list` y la salud del
worker. La llamada de OpenAI no declara un plazo propio en ese servicio.
No existen tiempos separados por dependencia en la respuesta ni evidencia
suficiente para atribuir los diecinueve plazos agotados a OpenAI o PostgreSQL.
El HTTP 503 histórico con OpenAI `error` no prueba la causa de los otros casos.

Los logs del contenedor backend actual entre 15:30 y 15:50 UTC no mostraron
errores clasificados de salud, pool o memoria; el journal revisado tampoco
mostró firmas de OOM o disco. Esta ausencia no demuestra respuestas rápidas.
Los logs Docker disponibles corresponden al contenedor actual; los de
contenedores retirados no están completos. Los archivos Winston dentro del
contenedor no constituyen retención persistente de todos esos errores.

La evidencia privada filtrada permanece en la VPS, bajo
`/var/lib/mateos-pet-ai/observability/20261027/`: `failure-correlation.json`
y `log-classification.json`. No se publican IP, credenciales, cuerpos de
peticiones ni datos de pacientes.

## Decisión sobre la cobertura externa

Tras explicar los huecos de varias horas, el responsable eligió:
**«Mantener solo GitHub por ahora»**. Se conserva ese canal y su prueba de
recepción satisfactoria. No hay autorización pendiente ni se activará Sentry.
La limitación de frecuencia queda explícita; no se promete detección externa
en cinco minutos. La alternativa siguiente se conserva únicamente como
referencia, fuera del trabajo autorizado actual.

El conector de Sentry accede a la organización y al equipo `nexo-web`, pero
no devolvió proyectos ni monitores Uptime. El backend informa
`sentryConfigured: false`. La única alerta accesible corresponde a pull
requests y no vigila disponibilidad de la aplicación.

Alternativa preparada, no activada por decisión del responsable:

- Crear el proyecto `mateos-pet-ai-production` en el equipo existente.
- Crear un único monitor `Huella Nex — salud de producción`: GET público
  a `https://bot.nexoweb.co/api/health`, cada 300 segundos, plazo 25.000 ms,
  dos fallos consecutivos para abrir incidencia y un éxito para recuperación.
- Ambiente `production`, responsable: usuario actual de Sentry; sin trazas,
  captura de respuestas, headers de autenticación ni datos clínicos.
- Vincular aviso por correo únicamente al usuario actual. Comprobar primeras
  ejecuciones y recepción antes de acreditar el nuevo canal.
- Usar exclusivamente el cupo gratuito disponible. Si requiere contratar,
  ampliar plan o pagar, detener la activación. No instalar SDK ni modificar
  variables, imágenes o procesos de producción para esta comprobación.

Sentry publica que cada plan incluye un monitor gratuito en su
[anuncio oficial de Uptime](https://blog.sentry.io/uptime-monitoring-now-ga/).
Esto no sustituye comprobar la disponibilidad y condiciones de esta cuenta.
**No se ha creado ni activado ningún recurso o aviso de Sentry en esta revisión.**

## Relación con el ítem 9

Las series anteriores y los cinco fallos del corte de las 16:23 se conservan. No se cambió
el observador instalado, no se borraron muestras ni se reinició la ventana.
El 28/10 a las 14:57 Colombia se podrán contrastar 48 horas de cobertura de
esta versión si continúa; no serán automáticamente 48 horas sin fallos.
La causa de los retrasos sigue pendiente en el ítem 9. La alternativa de
alertas queda aplazada por decisión del responsable, sin bloquear trabajo
diagnóstico ni el cierre del criterio original del ítem 4.
