# Aplicación de la revisión de viabilidad

**Inicio:** 9 de octubre de 2026.
**Origen:** [revisión completa](PROJECT_VIABILITY_REVIEW_20261009.md).
**Alcance autorizado:** aplicar las mejoras recomendadas; se conservan el número de prueba de Meta y PostgreSQL en la VPS.

Esta ejecución complementa el [plan de diez pasos](CLOSED_BETA_READINESS_PLAN_20260919.md). No crea otra fase ni sustituye sus condiciones de beta externa. Las mejoras funcionales de frontend de `2.45.0` ya están publicadas; no se vuelven a implementar.

## Trabajos y criterios de cierre

| Trabajo | Aplicado en esta ronda | Falta para cerrarlo |
| --- | --- | --- |
| Respaldo fuera de la VPS | Copia cifrada verificada, restauración local aislada y tarea diaria autorizada y ejecutada correctamente | Vigilar ejecuciones posteriores y disponibilidad del equipo del operador |
| Observación de estabilidad | Herramienta comprobada y nueva ventana de 48 horas iniciada el 9 de octubre a las 12:39 de Colombia | Terminar la ventana completa, contrastar cola/logs y observar capacidad con tráfico del piloto |
| Matriz de agenda | Guía de los casos pendientes y registro de evidencia | Ejecutar los casos reales restantes con remitentes de prueba autorizados |
| Aceptación del frontend | Lista de tareas y comprobaciones humanas en el procedimiento del piloto | Zoom real, lector de pantalla y prueba con personal real |
| Uso, soporte y rentabilidad | Hoja de medición y procedimiento para un establecimiento | Responsable, participantes autorizados, mediciones y costes reales |
| Documentación y transferencia de conocimiento | Comandos de comprobación y secuencia de recuperación enlazados | Otro operador debe demostrar que puede seguir el procedimiento |

## 1. Copia cifrada independiente

Herramienta: [copy-offsite-backup.cjs](../../scripts/copy-offsite-backup.cjs).

- Lee los respaldos ya publicados; no genera dumps ni escribe en la VPS.
- Solo descarga `database.dump.age`, `SHA256SUMS` y `manifest.txt`.
- No lee ni copia la clave SSH; OpenSSH utiliza su ruta existente. La verificación del host permanece activa.
- Rechaza respaldos antiguos, fechas inválidas, destinos fuera de `backups/offsite` y rutas locales con enlaces.
- Comprueba nombre, formato, cifrado, tamaño y SHA-256 antes de publicar la carpeta; un archivo parcial queda fuera del conjunto definitivo.
- Conserva un recibo sin datos de clientes. Una repetición verifica la copia existente; no la reemplaza.
- `backups/offsite/` está excluido de Git. No se elimina ningún respaldo existente ni se introduce retención automática en el equipo local.

Plan sin descarga ni escrituras locales, desde PowerShell en la carpeta del proyecto:

```powershell
node scripts/copy-offsite-backup.cjs --identity "C:\Users\andre\Desktop\Proyectos\server vps nexoweb\ssh-key-2026-08-25.key" --backup mateos-pet-ai-20261009T081741Z --plan
```

La revisión automática rechazó inicialmente la transferencia por requerir
autorización específica del archivo y destino. El operador la concedió después;
se ejecutó la copia autorizada sin eludir ese rechazo.

**Copia ejecutada:** `mateos-pet-ai-20261009T081741Z`, recibo del
9 de octubre a las **12:26:02 de Colombia**, en
`backups/offsite/mateos-pet-ai-20261009T081741Z/`. Archivo cifrado:
**302.059 bytes**, tamaño y SHA-256 verificados:

```text
5e90c9b614b8e08880964267a8da9cda845a82510553d9e1238b6d061df59970
```

**Restauración desde esa copia:** verificación de checksum y descifrado por
flujo hacia PostgreSQL temporal local, sin red ni puertos publicados. Se
recuperaron **48 tablas y 46 migraciones**; código de salida 0. La limpieza
retiró el contenedor y sus volúmenes anónimos, también ante fallos. No se
conectó a la base de producción ni se dejó un dump descifrado en el equipo.

### Copia diaria activada

El operador autorizó explícitamente la frecuencia y destino. La tarea Windows
`MateosPetAI-OffsiteBackup` copia el último conjunto publicado a las
**03:35 de Colombia**, con sesión del operador abierta. Si se pierde la hora,
`StartWhenAvailable` permite ejecutarla al estar disponible. No borra copias.

- Instalador: [install-offsite-backup-task.ps1](../../scripts/install-offsite-backup-task.ps1).
- Ejecutor: [run-offsite-backup-task.ps1](../../scripts/run-offsite-backup-task.ps1).
- Node y la identidad SSH se referencian mediante rutas absolutas; la acción usa Windows PowerShell instalado y una ventana oculta.
- La primera prueba falló con `0x80070002`: la ruta de PowerShell del runtime de Codex no existía fuera de la sesión. Se corrigió a la instalación de Windows y se repitió la prueba.
- Ejecución comprobada: **9 de octubre, 12:39:19**, `LastTaskResult=0`, estado `Ready`; próxima ejecución **10 de octubre, 03:35**.
- La tarea evita ejecuciones superpuestas y limita cada intento a 15 minutos. Un respaldo con más de 36 horas se rechaza; un fallo deja disponibles las copias anteriores.

Comprobar después de cada ventana diaria:

```powershell
Get-ScheduledTaskInfo -TaskName MateosPetAI-OffsiteBackup |
  Select-Object LastRunTime, LastTaskResult, NextRunTime
```

Esperar `LastTaskResult=0` y revisar la fecha del conjunto y `copy-receipt.json`.
La repetición sobre un conjunto ya copiado verifica su integridad; un resultado
0 no implica que el servidor generó un respaldo nuevo ese día. La antigüedad
del conjunto y la ejecución del timer de la VPS también deben revisarse.

La copia local es independiente de una pérdida de la VPS, pero no equivale a
alta disponibilidad. El computador debe estar encendido, conectado a la red y
con sesión abierta; sin esas condiciones no se garantiza una copia diaria.
No se contrató almacenamiento externo ni se copiaron claves privadas.

## 2. Ventana de salud

Herramienta: [observe-production.cjs](../../scripts/observe-production.cjs).

Comprobación puntual, sin archivo ni escrituras de negocio:

```powershell
node scripts/observe-production.cjs --sample
```

Observación de 48 horas, con una muestra cada cinco minutos:

```powershell
node scripts/observe-production.cjs --output .cache/stability/ventana-20261009.jsonl --hours 48 --interval-seconds 300
```

El archivo se crea solo si no existe. No cerrar la terminal ni suspender el equipo. Si se interrumpe, conservar el archivo y resumirlo:

```powershell
node scripts/observe-production.cjs --summarize .cache/stability/ventana-20261009.jsonl --hours 48 --interval-seconds 300
```

Resultados posibles:

- `incomplete`: falta duración o hay huecos de muestreo.
- `incident`: hubo una muestra degradada, fallo del worker registrado, reinicio o cambio de versión.
- `health_window_passed`: la ventana solicitada de salud tiene cobertura y no presenta las señales anteriores.

El último resultado **no cierra automáticamente los pasos 2 o 9**. El endpoint público no demuestra entrega de WhatsApp, ausencia de leases vencidos, logs sin errores ni capacidad bajo carga. Esas comprobaciones siguen siendo obligatorias. Cinco minutos entre muestras tampoco garantizan capturar toda interrupción breve.

**Primer registro interrumpido:** `.cache/stability/ventana-20261009T171516Z.jsonl`
contiene dos muestras saludables, a las 12:15 y 12:20. El proceso de terminal
dejó de existir; su resumen es `incomplete`. Se conserva como evidencia y no
se suma a otra ventana para certificar continuidad.

**Nueva ventana:** `.cache/stability/ventana-20261009T173919Z.jsonl`, primera
muestra saludable a las **12:39:19 de Colombia del 9 de octubre**. Se inició
mediante `Start-Process -WindowStyle Hidden`, con Node como proceso independiente
(`PID 28444` al comprobarlo). Sus salidas técnicas quedan en los archivos
`.stdout.log` y `.stderr.log` junto al registro. Una interrupción del equipo
todavía puede detenerlo; no se presenta como servicio permanente.

Si mantiene continuidad, termina aproximadamente el **domingo 11 de octubre
de 2026 a las 12:39**. Todavía no hay resultado de 48 horas. Para verificar:

```powershell
node scripts/observe-production.cjs --summarize .cache/stability/ventana-20261009T173919Z.jsonl --hours 48 --interval-seconds 300
```

Una suspensión del equipo o interrupción exige revisar el resumen y no
certificar una ventana incompleta.

Comprobación a las **12:44:19 de Colombia**: el nuevo registro tiene dos
muestras saludables, cero huecos y cero fallos; `verdict=incomplete`, como
corresponde a cinco minutos de una ventana de 48 horas. El proceso continúa
activo y su salida de errores está vacía.

La alerta externa existente de GitHub se conserva. Este observador no la reemplaza ni añade llamadas de generación a OpenAI: consulta el endpoint de salud ya disponible.

## 3. Evidencia de producción de esta ronda

Inspecciones de solo lectura:

- SSH con la clave existente funcionó; el inventario de respaldos contiene `mateos-pet-ai-20261009T081741Z`.
- Salud a las **12:08:11 de Colombia** (`2026-10-09T17:08:11.390Z`): HTTP 200, versión `2.45.0`, base/OpenAI/worker `ok`, cero fallos consecutivos y `lastFailureAt=null`.
- Una muestra de `docker stats`: frontend 114,7 MiB, backend 209,7 MiB, PostgreSQL 56,54 MiB; CPU de PostgreSQL 0,75 % y de las otras dos aplicaciones 0,00 % en esa muestra. No es un ensayo de carga ni un promedio de la jornada.

Se inició la nueva observación de salud; no se enviaron mensajes de WhatsApp
y no se crearon citas. El iniciador normal de terminal de Codex falló con
`helper_unknown_error: setup refresh had errors`. La ejecución fuera del
sandbox, aprobada automáticamente para pruebas locales y observación pública,
permitió ejecutar las pruebas y operaciones autorizadas. La descarga se
realizó después de la autorización específica del operador. SSH funcionó.

## Evidencia de verificación

Comprobaciones ejecutadas en esta ronda:

```text
node --test --test-reporter=tap scripts/copy-offsite-backup.test.cjs scripts/observe-production.test.cjs
Exit: 0
# tests 12
# pass 12
# fail 0

node --test --test-reporter=tap scripts/*.test.cjs
# Ejecución seleccionada: 20 archivos, excluyendo *-postgres.test.cjs
Exit: 0
# tests 127
# pass 127
# fail 0
# skipped 0

# En backend
node node_modules/jest/bin/jest.js --runInBand --silent
Exit: 0
Test Suites: 167 passed, 167 total
Tests:       1337 passed, 1337 total

# En frontend
node node_modules/eslint/bin/eslint.js .
Exit: 0
Sin diagnósticos.

# Ensayo real desde la copia cifrada local, después de corregir limpieza
database.dump.age: OK
restore drill passed: tables=48 migrations=46
Exit: 0

# Programador de tareas, después de corregir la ruta de PowerShell
LastRunTime: 2026-10-09T12:39:19-05:00
LastTaskResult: 0
NextRunTime: 2026-10-10T03:35:00-05:00

# Sintaxis de ambos scripts PowerShell y del ensayo Bash
PowerShell syntax: OK
Restore Bash syntax: OK
git diff --check: OK

# Verificación del instalador sin volver a registrar la tarea
status: registered_unchanged

# Enlaces locales, resolviendo las rutas con caracteres codificados
Local documentation links (URL-decoded): 0 missing
```

Las pruebas de copia usan datos ficticios; no descargan respaldos reales.
El 9 de octubre se repitieron las 127 pruebas de scripts, el lint del frontend y
las 1.337 pruebas del backend después de completar las operaciones; todas
terminaron con código 0 (backend: 167 suites, 29,615 segundos). El ensayo de
restauración y la ejecución del Programador son comprobaciones reales
adicionales, separadas de las pruebas unitarias.

El backend no declara comando de lint y no se presenta como ejecutado. No se
repitieron build ni pruebas PostgreSQL de integración: no cambian producto,
schema ni adaptadores de base; esa evidencia de `2.45.0` sigue en su informe
de publicación. Las herramientas nuevas quedan incluidas automáticamente en
el conjunto `*.test.cjs` de CI existente.

## 4. Piloto y siguientes comprobaciones

Usar [procedimiento y hoja de medición del piloto interno](INTERNAL_PILOT_RUNBOOK.md). Mantener un establecimiento y destinatarios de prueba verificados. El responsable y los datos comerciales se deben completar con información real; no se inventan.

No se reconstruyen el motor conversacional, la arquitectura ni los módulos consolidados. Los servicios grandes se mantienen bajo pruebas de regresión; una extracción de código futura requerirá un cambio concreto que la justifique.

## Estado de publicación

Esta ronda añade herramientas operativas y documentación, sin entidades, migraciones, dependencias nuevas ni cambios funcionales del producto. Por eso no se cambia `2.45.0` ni se crea un tag oficial. Los cambios son locales hasta publicar y verificar CI; no se declara un despliegue nuevo.

### Actualización posterior: publicación conjunta con la reparación de WhatsApp

El estado anterior describe la ronda operativa inicial. El usuario autorizó
después commit, push y despliegue de las herramientas junto con la reparación
funcional del incidente de dos remitentes. Esa entrega sí cambia el producto:
se publicó como **2.45.1**, commit `a73007a`, CI verde y VPS comprobada el
9 de octubre a las 15:02 de Colombia. Ver [informe de publicación](../history/RELEASE_2_45_1_VPS_20261009.md).

Antes de desplegar se creó y copió el respaldo cifrado
`mateos-pet-ai-20261009T200043Z`, con checksum verificado. No se eliminaron
las copias anteriores. La tarea diaria permanece instalada.

El reinicio planificado del worker obliga a conservar como incompleta la
ventana de las 12:39. Se detuvo su proceso identificado y se abrió una nueva
a las **15:03:11 de Colombia** (`.cache/stability/ventana-20261009T200311Z.jsonl`,
PID inicial `31200`). Primera muestra saludable con 2.45.1; final previsto
11 de octubre a las 15:03 si no hay interrupciones. Los pasos 2, 8 y 9
siguen abiertos para carga, repetición real y estabilización completa.
