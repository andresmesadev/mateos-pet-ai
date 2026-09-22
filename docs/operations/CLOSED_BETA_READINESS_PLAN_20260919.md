# Plan de preparación para beta cerrada

**Fecha de evaluación:** 2026-09-19

**Versión desplegada al iniciar:** `2.39.2`

**Commit desplegado al iniciar:** `e2efeec`
**Decisión:** no abrir todavía una beta externa. Continuar con pruebas internas supervisadas hasta completar los bloqueadores P0.

## Evidencia de partida

- CI verde: backend, PostgreSQL real y lint.
- Backend: 133 suites y 1.016 pruebas correctas.
- PostgreSQL real: 13 pruebas correctas.
- Base de datos y OpenAI responden `ok` en `/api/health`.
- 35 migraciones aplicadas.
- Cola entrante: 49 trabajos `done/complete`, 3 `needs_review/sending` y 0 leases vencidos.
- Producción registró 102 líneas de timeout de transacción en 17 horas; son al menos 51 ejecuciones fallidas del barrido de recuperación.
- WhatsApp usa todavía el número de prueba de Meta.
- `SENTRY_DSN` no está configurado y `/var/backups/mateos-pet-ai` no existe.
- Los términos y la política de privacidad siguen en borrador.

## Plan aprobado

| Paso | Trabajo | Criterio de cierre | Estado |
| --- | --- | --- | --- |
| 1 | Corregir los timeouts del worker entrante | El barrido tolera el arranque en frío de la base, tiene prueba de regresión y opera sin timeouts repetidos en producción. | ✅ Completado (`2.39.3`) |
| 2 | Garantizar capacidad de Neon | Consumo y plan verificados; la base no queda expuesta a suspensión durante el piloto. | 🧪 Free durante desarrollo; mitigación aplicada y validación pendiente tras el reinicio mensual |
| 3 | Actualizar dependencias vulnerables y runtime Node | Cero vulnerabilidades altas conocidas en dependencias de producción, runtime soportado y CI verde. | ✅ Completado (`2.39.6`) |
| 4 | Activar observabilidad | Sentry o equivalente recibe una excepción controlada y existe alerta de salud/worker. | ✅ Completado (`2.39.7`) |
| 5 | Implementar backup y restauración | Backup cifrado y periódico, retención definida y restauración ensayada. | 🧪 Infraestructura `2.39.8` instalada; primer respaldo real pendiente del reinicio de Neon |
| 6 | Configurar WhatsApp de producción | Número empresarial real registrado, app publicada y flujo entrante/saliente verificado. | Pendiente |
| 7 | Completar documentación legal del piloto | Política, términos y acuerdo de piloto completados y revisados. | Pendiente |
| 8 | Ejecutar matriz integral de agenda | Casos de veterinaria, peluquería, domingos, festivos, conflictos, cancelación y fallos aprobados. | Pendiente |
| 9 | Ejecutar período de estabilización | 48 horas sin errores del worker ni pérdida de mensajes; métricas y cola nominales. | Pendiente |
| 10 | Abrir cohorte inicial | Un establecimiento, alcance funcional explícito, 5–10 usuarios, soporte y criterio de rollback definidos. | Pendiente |

## Condiciones de salida a beta

La beta cerrada solo cambia a **GO** cuando los pasos 1–9 estén cerrados, los tres trabajos `needs_review` estén conciliados individualmente y exista un responsable operativo durante la primera cohorte.

## Registro del paso 1

La causa del `P2028` fue la combinación de dos condiciones: Prisma esperaba solo
2 segundos para adquirir una transacción interactiva y los tres barridos
operativos empezaban simultáneamente en los minutos 0/15/30/45. La versión
`2.39.3` amplía `maxWait` a 15 segundos para las transacciones de la cola y
ejecuta su recuperación en los minutos 2/17/32/47, cuando el compute ya fue
despertado por los demás barridos. La suite local, PostgreSQL real y CI quedaron
en verde. En producción se observó el ciclo completo de las 17:00 UTC y el
barrido escalonado de las 17:02 UTC: ambos finalizaron con cero errores `P2028`
desde el despliegue. El preflight posterior confirmó backend `2.39.3`, salud
general `ok`, base de datos y OpenAI `ok`, 35 migraciones al día y cero claims
vencidos. Paso cerrado el 2026-09-19.

## Registro del paso 2

La consola de Neon confirmó que `Mateos Pet AI` continúa en el plan Free y que
alcanzó el límite: 103,74 CU-horas consumidas desde el 1 de septiembre frente a
100 CU-horas incluidas. El proyecto muestra explícitamente `Limit reached`. La
base ocupa 40,27 MB, ha transferido 0,08 GB y su único compute de producción usa
autoscaling de 0,25 a 2 CU con suspensión tras 5 minutos de inactividad.

La cuota se reinicia al comenzar el siguiente ciclo mensual, el 1 de octubre de
2026. Se decidió mantener Free durante el desarrollo; no se introdujeron datos
de pago ni se activó ningún plan. Launch permanece como requisito antes de una
beta con usuarios reales, porque Free conserva un corte duro por capacidad.

La causa principal del consumo ya estaba corregida desde el 18 de septiembre:
el worker entrante dejó de consultar la base cada 5 segundos y pasó a activarse
por eventos. `2.39.4` agrupó su recuperación con los otros barridos trimestrales.
Después de que Neon aplicara el corte duro de la cuota el 22 de septiembre,
`2.39.5` añadió `NEON_LOW_USAGE_MODE`: en desarrollo, los tres barridos se
ejecutan una vez por hora y quedan agrupados entre el segundo 0 y el 30 de esa
misma ventana. A 0,25 CU y suspensión tras cinco minutos, la carga periódica
teórica se reduce a unas 16,5 CU-horas mensuales, antes del tráfico real.

La API permanecerá sin acceso a PostgreSQL hasta que Neon renueve la cuota el
1 de octubre de 2026. Ese día se debe confirmar la recuperación del endpoint de
salud y comenzar la medición del nuevo ciclo. El paso seguirá abierto hasta
observar consumo real suficiente y resolver la capacidad requerida para beta.

## Registro del paso 3

La auditoría inicial encontró 6 vulnerabilidades altas en las herramientas de
Prisma de la raíz, 4 altas en el backend y 9 altas más 3 críticas en el
frontend. La versión `2.39.6` actualizó las correcciones compatibles de Prisma,
Axios, Next.js y NextAuth, y alineó los contenedores, CI y el flujo manual de
despliegue con Node 24. Los tres manifiestos declaran explícitamente ese runtime.

El CLI de Prisma permanece como herramienta de construcción, pero se elimina
de la imagen final después de generar y copiar el cliente requerido por el
backend. CI ejecuta desde este cierre `npm audit --omit=dev --audit-level=high`
para raíz, backend y frontend, impidiendo que una vulnerabilidad alta de
producción vuelva a entrar silenciosamente.

Validación de cierre: las tres auditorías de producción reportaron cero
vulnerabilidades; 134 suites y 1.020 pruebas del backend, 13 pruebas contra
PostgreSQL real, lint y build del frontend finalizaron correctamente. GitHub CI
en Node 24 quedó verde en la ejecución `35783848165`. En la VPS, backend y
frontend ejecutan Node `24.21.0`, el backend sirve `2.39.6`, la auditoría del
contenedor reporta cero vulnerabilidades y el portal responde HTTP 200. El 503
del endpoint de salud corresponde exclusivamente al corte de cuota de Neon ya
registrado en el paso 2. Paso cerrado el 2026-09-22.

## Registro del paso 4

Se eligió GitHub Actions como equivalente gratuito de alerta externa mientras
el proyecto continúa en desarrollo, conservando Sentry como integración
opcional para cuando exista un `SENTRY_DSN`. La versión `2.39.7` incorporó un
estado operacional explícito del worker entrante: inicio, ejecución activa,
último éxito, último fallo, fallos consecutivos, cantidad procesada y detección
de ejecución bloqueada o atrasada. `/api/health` incluye este estado y degrada
la respuesta cuando el worker falla, se bloquea o deja de ejecutar su barrido.

El workflow `Production health alert` comprueba cada hora la base, OpenAI y el
worker. Comparte la ventana de actividad de Neon para no introducir despertares
adicionales. Los chequeos programados se activan el 1 de octubre de 2026; antes
de esa fecha permanecen silenciosos por el corte de cuota conocido. Una prueba
controlada produjo la ejecución fallida esperada `35785507188`, verificando el
canal de alerta sin provocar un error real de aplicación.

Validación de cierre: 135 suites y 1.024 pruebas del backend, 13 pruebas contra
PostgreSQL real, lint y build del frontend correctos; CI verde en la ejecución
`35785482249`. En la VPS, `2.39.7` expone correctamente `database: error` e
`inboundWorker: error` durante el bloqueo actual de Neon, incluyendo marca de
tiempo y contador de fallos, sin revelar credenciales ni mensajes entrantes.
Paso cerrado el 2026-09-22.

## Registro del paso 5

La versión `2.39.8` incorporó una copia completa diaria de PostgreSQL a las
08:10 UTC, con demora aleatoria de hasta diez minutos y retención de 14 días.
Cada copia se genera en formato personalizado de PostgreSQL, se valida antes de
publicarse, se cifra con `age` y conserva su suma SHA-256. La VPS solo almacena
la clave SSH pública del operador; la clave privada permanece en el equipo
local y no se copió ni se imprimió durante la instalación.

El mecanismo de restauración descifra por flujo de datos dentro de un
PostgreSQL temporal sin escribir el contenido abierto en disco ni conocer la
URL de producción. El ensayo aislado completó copia, validación, cifrado,
descifrado y restauración de dos tablas y una migración. Una segunda prueba
confirmó que un archivo cifrado en la VPS para la clave pública real puede
abrirse con la clave privada local existente.

En producción, `mateos-pet-ai-backup.timer` quedó habilitado y activo. El
directorio `/var/backups/mateos-pet-ai` tiene permisos `700`; la configuración y
el destinatario público pertenecen a `root`. La ejecución manual del servicio
finalizó correctamente con `backup skipped until 2026-10-01T00:00:00Z`, por lo
que no intentará despertar una base bloqueada durante el corte conocido de
cuota. El primer respaldo real se ejecutará en la ventana del 1 de octubre de
2026 entre 08:10 y 08:20 UTC.

Validación técnica previa al despliegue: 135 suites y 1.024 pruebas del backend,
13 pruebas contra PostgreSQL 18 real, lint y build del frontend, tres auditorías
de dependencias sin vulnerabilidades y prueba integral de respaldo/restauración
correctas. La VPS ejecuta el commit `f465193`, backend `2.39.8` y conserva el
timer activo. El paso permanece abierto hasta verificar y restaurar el primer
respaldo real de Neon después del reinicio de cuota.

## Criterios de rollback de la beta

- un mensaje entrante se pierde o queda sin respuesta sin alerta;
- una cita se duplica o se confirma sin persistencia;
- la base de datos queda indisponible o alcanza su límite operativo;
- aparecen errores repetidos del worker durante dos ciclos consecutivos;
- se rompe el aislamiento entre establecimientos;
- no puede restaurarse la información desde el respaldo verificado.
