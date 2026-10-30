# Backup y restauración de PostgreSQL

- **Versión inicial:** `2.39.8`
- **Frecuencia VPS vigente desde el 26/10:** cada 30 minutos, minutos 00 y 30 UTC, sin demora aleatoria; ejecución persistente si se omitió una ventana
- **Retención:** 14 días
- **Ubicación:** `/var/backups/mateos-pet-ai` en la VPS
- **Cifrado:** `age`, usando la clave pública SSH del operador

**Decisión final del operador — 28/10/2026, 14:31 Colombia:** retirar la tarea
local `MateosPetAI-OffsiteBackup`, que correspondía a una prueba. Se comprobó
su identidad, se guardó la configuración recuperable en
`.cache/offsite-task-retired-20261028.xml` y se eliminó del Programador de tareas.
La comprobación posterior confirmó su ausencia y la conservación de las 112
carpetas de respaldo descargadas. No se borraron datos ni claves.

El timer de la VPS permanece activo cada 30 minutos; su ejecución de las 14:30
terminó con `Result=success` y estado 0. No se conectó Google Drive ni otro
destino externo nuevo. Las copias locales dejan de actualizarse automáticamente.
Los ensayos siguientes documentan la configuración vigente en sus fechas; el
objetivo de copia externa reciente ya no está cubierto por una tarea automática.
La aplicación y la generación de respaldos en la VPS funcionan sin el equipo
del centro. Ver
[separación del producto y su infraestructura](../ALCANCE_DEL_PRODUCTO.md).

## Garantías operativas

- La clave privada no se copia a la VPS. Permanece en el equipo del operador.
- La copia sin cifrar solo existe en un directorio temporal privado durante el proceso y se elimina incluso si el proceso falla.
- La credencial de PostgreSQL se entrega a `pg_dump` mediante un archivo temporal con permisos `600`; no aparece en los argumentos del proceso ni en los logs.
- Cada respaldo incluye una suma SHA-256 y se valida con `pg_restore --list` antes de considerarse completo.
- La publicación del conjunto es atómica: un directorio incompleto nunca adopta el nombre definitivo.
- La restauración de ensayo usa un contenedor PostgreSQL desechable y no conoce la URL de producción.
- El timer conserva los últimos 14 días y elimina solamente directorios con el patrón exacto de este sistema.

## Ensayo del 26 de octubre de 2026

El responsable pidió cerrar el ítem 3 y continuar el 5. Aceptó como objetivos
de recuperación **RPO de una hora** (pérdida máxima de registros) y **RTO de
una hora** (tiempo de recuperación del servicio). Son objetivos operativos;
el tiempo de restauración de PostgreSQL por sí solo no certifica el RTO completo.

Evidencia del ensayo local, terminado a las 16:48 Colombia:

- Conjunto externo existente `mateos-pet-ai-20261026T081917Z`, generado a las
  03:19 Colombia y copiado por la tarea automática. Última tarea diaria: 03:35,
  resultado `0`. Archivo cifrado de 537.131 bytes, SHA-256 correcto.
- Descifrado por tubería con la identidad SSH local; clave no copiada a la VPS,
  sin archivo de dump descifrado en el equipo. Restauración PostgreSQL 18/
  pgvector en un contenedor local sin red ni puertos, limitado a 1 CPU/1 GiB.
- **73 tablas**, incluidos los 72 modelos del esquema actual y el historial
  Prisma. **66 migraciones**, todas terminadas y ninguna revertida.
- **Cero índices inválidos y cero FKs/checks sin validar.** Restauración con
  `--exit-on-error`, conservando datos y restricciones del respaldo.
- Lectura de la copia: 261 usuarios, 311 mascotas, 29 citas, 44 transacciones,
  101 artículos, 41 comisiones, seis cierres, tres bases de caja, 26 productos,
  26 lotes, 56 movimientos y dos credenciales. Huellas de tablas financieras,
  inventario y estado de credenciales conservadas en evidencia privada.
- Tiempo técnico medido: **15,24 segundos**, incluyendo arranque, descifrado,
  restauración y consultas. No incluye diagnóstico de incidente, descarga,
  preparación de un servidor nuevo ni validación funcional del equipo.
- Contenedor y volumen anónimo eliminados al terminar. Producción y observador
  de estabilidad continuaron activos; WhatsApp siguió pausado. No se crearon
  pagos, mensajes ni movimientos de inventario.

El primer intento restauró el esquema, pero el verificador usó por error el
nombre de tabla `Contact` en vez de `User`: falló la consulta de conteo y se
limpió el contenedor. Se corrigió el verificador y se repitió íntegramente el
ensayo con resultado correcto. No fue un fallo del respaldo.

Esta copia corresponde a la madrugada: **precede las rectificaciones de esta
tarde**. No se comparó con una base viva que sigue recibiendo escrituras, ni
se presenta como respaldo de esas modificaciones posteriores.

Nuevo respaldo completo VPS `mateos-pet-ai-20261026T214349Z`, terminado a las
16:43:51 Colombia, 540.767 bytes y SHA-256 correcto. Frecuencia VPS cambiada
a cada 30 minutos mediante un drop-in de systemd; configuración anterior
conservada en `/var/lib/mateos-pet-ai/backup-recovery-20261026`.

**Autorización posterior y ejecución — 17:21 Colombia:** el responsable
autorizó expresamente la copia cifrada inmediata y cada 15 minutos. La revisión
automática inicial había bloqueado esa exportación por faltar ese permiso;
se ejecutó después de recibirlo, sin usar una vía alternativa.

- Se conservó `MateosPetAI-OffsiteBackup`, sus acciones, destino, identidad
  y copias anteriores. Solo cambió su trigger a repetición `PT15M`.
  Configuración previa en `.cache/offsite-task-before-20261026.xml`, excluida
  de Git. El instalador permite un intervalo explícito, predeterminado de 15 minutos.
- Respaldo reciente `mateos-pet-ai-20261026T222020Z`, generado a las 17:20:20
  Colombia: 541.279 bytes, SHA-256 verificado, copiado a `backups/offsite/`.
- Tarea iniciada a las 17:20:59 y finalizada con `LastTaskResult=0`; próxima ejecución
  comprobada para las 17:35:59. El runner rechaza respaldos de más de una hora,
  en lugar de aceptar silenciosamente una copia antigua de hasta 36 horas.
- Restauración de esta copia terminada a las 17:21:19: **73 tablas, 72 modelos,
  66 migraciones aplicadas, cero restricciones/índices inválidos**.
  Tiempo técnico **13,19 segundos**. Misma imagen fijada por digest, sin red
  ni puertos; contenedor y volumen temporal eliminados.
- La copia reciente contiene 32 citas, 48 transacciones, 108 artículos,
  47 comisiones, seis cierres y cuatro bases. Inventario: 26 productos,
  26 lotes y 56 movimientos. Es una fotografía de su fecha; no se comparó con
  la base viva que sigue recibiendo escrituras. No sustituye ningún registro real.

**Pendiente al corte del 26/10:** practicar con Lina y medir la recuperación
de aplicación frente al objetivo de una hora. Se resolvió el 27/10 con el
[ensayo y cierre asistido](RECOVERY_APPLICATION_DRILL_20261027.md), dentro de
su alcance y límites expresos.
Las frecuencias nominales dejan hasta unos 45 minutos más el tiempo de
ejecución entre creación y copia externa. Esto depende de ejecuciones exitosas:
el computador debe estar encendido, conectado y con sesión abierta. Su
indisponibilidad o un respaldo atrasado deben tratarse como incumplimiento del
objetivo; no existe garantía de una hora si falla esa condición. Un ensayo
local de PostgreSQL de 13 segundos no certifica por sí solo todo el RTO.

## Práctica operativa del 27 de octubre

Andre confirmó la presencia de Lina para continuar el ítem 5. El equipo indicó
que Lina avisaría a Andre y seguiría anotando en el Excel habitual. Se explicó
que un cobro sin respuesta debe verificarse en el historial antes de repetirlo.
El equipo confirmó después que Lina encontró un cobro desde su cuenta, abrió
su comprobante y verificó importe y método de pago sin modificarlo. También
confirmó que Lina encontró la carpeta más reciente y sus tres archivos sin
editarlos ni compartirlos. Esta práctica no acredita por sí sola autonomía
para restaurar la aplicación ni el tiempo de recuperación integral.

A las 11:20 Colombia: respaldo externo `mateos-pet-ai-20261027T160019Z`
(11:00:19), 541.279 bytes y SHA-256 correcto; tarea con repetición `PT15M`,
última ejecución 11:06, resultado `0`. VPS con timer activo, respaldo terminado
11:00:20, salud 2.58.1 correcta y trabajador WhatsApp pausado.

El recorrido y su lista de comprobación están en la
[guía para Andre y Lina](CLINIC_RECOVERY_OPERATOR_GUIDE.md). La práctica verbal
se complementó después con el [ensayo de aplicación de las 11:38](RECOVERY_APPLICATION_DRILL_20261027.md),
incluyendo backend/frontend y medición desde el primer intento. No se restauró
sobre el destino productivo; producción continuó funcionando. Con ese alcance
se cierra el criterio original del ítem 5; sus límites y dependencias permanecen
documentados y no se certifica reconstruir una VPS perdida en una hora.

## Componentes

- `scripts/backup-database.sh`: genera y cifra el respaldo.
- `scripts/restore-database-drill.sh`: verifica integridad y restaura en una base temporal.
- `scripts/install-backup-service.sh`: instala configuración y timer.
- `scripts/copy-offsite-backup.cjs`: copia y verifica el conjunto cifrado en el equipo del operador; no descifra ni escribe en producción.
- `scripts/install-offsite-backup-task.ps1`: prepara o registra la copia periódica en Windows tras autorización del operador.
- `scripts/run-offsite-backup-task.ps1`: ejecuta la copia desde el Programador de tareas con rutas absolutas.
- `deploy/systemd/mateos-pet-ai-backup.{service,timer}`: respaldo VPS cada 30 minutos.

La imagen `postgres:18-alpine` fija la herramienta de copia. La restauración usa
`pgvector/pgvector:0.8.6-pg18-bookworm`, porque el esquema contiene columnas
vectoriales. `age` se instala desde su publicación oficial y se verifica contra
el SHA-256 publicado.

## Instalación en la VPS

La clave que se entrega al instalador es pública:

```bash
./scripts/install-backup-service.sh /tmp/mateos-backup-recipient.pub
```

La configuración usa la red privada `mateos-pet-ai_default` para conectar el
contenedor temporal de `pg_dump` con PostgreSQL. El timer ejecuta cada 30 minutos
sin depender de la cuota de Neon.

## Comprobación diaria

```bash
systemctl status mateos-pet-ai-backup.timer --no-pager
journalctl -u mateos-pet-ai-backup.service --since '2 days ago' --no-pager
find /var/backups/mateos-pet-ai -maxdepth 2 -type f -printf '%TY-%Tm-%Td %TH:%TM %p\n'
```

Un respaldo válido es un directorio `mateos-pet-ai-YYYYMMDDTHHMMSSZ` que contiene:

- `database.dump.age`
- `SHA256SUMS`
- `manifest.txt`

## Recuperación

1. Copiar el directorio cifrado desde la VPS al equipo de recuperación.
2. Instalar `age` y Docker en ese equipo.
3. Ejecutar el ensayo con la clave SSH privada correspondiente:

```bash
./scripts/restore-database-drill.sh \
  /ruta/absoluta/mateos-pet-ai-YYYYMMDDTHHMMSSZ \
  /ruta/absoluta/ssh-key-2026-08-25.key
```

El comando verifica la suma, descifra por flujo de datos, restaura en un
PostgreSQL aislado, comprueba que existan tablas y migraciones, y destruye el
contenedor temporal y sus volúmenes anónimos al terminar, también ante fallos.
El contenedor no tiene red ni puertos publicados. Para una recuperación real se debe ensayar
primero de esta manera y luego aprobar explícitamente el destino definitivo.

## Comprobaciones de esquema opcionales

El ensayo admite `MATEOS_RESTORE_EXPECT_MIGRATIONS` (entero positivo) para exigir el historial completo aplicado, y `MATEOS_RESTORE_REQUIRED_TABLES` (nombres separados por comas, solo letras/dígitos/guion bajo, sin SQL) para exigir tablas y cero FKs/checks sin validar. Si falta un requisito el ensayo falla y limpia su contenedor temporal. Los valores se toman de la publicación que se pretende recuperar, no de una cifra histórica.

La [comprobación del 16 de octubre](OWN_CLINIC_BETA_APPLICATION_20261016.md#recuperación-actual-comprobada) exigió 52 migraciones y las 21 tablas nuevas de empleados/canal privado. No conectó la copia restaurada a workers, WhatsApp o servicios de la aplicación.

## Criterios de alerta

- no aparece un nuevo directorio después de dos ventanas diarias;
- falla la suma SHA-256;
- `pg_restore --list` no reconoce el archivo;
- el ensayo no restaura tablas o migraciones;
- el espacio libre de la VPS baja de 20 GB.

## Estado tras la migración a VPS

El primer respaldo de la nueva base debe ejecutarse manualmente al concluir el
cambio de proveedor y restaurarse en aislamiento antes de declarar cerrado el
paso 5. La copia permanece en la misma VPS; antes de una beta con usuarios
externos se requiere otra copia cifrada en un lugar independiente.

## Herramienta para copia fuera de la VPS (2026-10-09)

La descarga usa OpenSSH y la identidad local existente, verifica el
host y publica únicamente un conjunto íntegro en `backups/offsite/`, excluido
de Git. No elimina copias anteriores. La clave privada no forma parte del
conjunto descargado. Antes de transferir datos, confirmar el respaldo y destino.

Consultar comandos, límites y estado real en
[aplicación de la revisión](VIABILITY_IMPROVEMENT_EXECUTION_20261009.md).
**Comprobado el 9 de octubre:** copia cifrada independiente del conjunto
`mateos-pet-ai-20261009T081741Z`, integridad verificada y restauración local de
48 tablas y 46 migraciones, con eliminación del contenedor temporal y sus
volúmenes. No se alteró producción.

Histórico del 9/10: el operador autorizó y se activó `MateosPetAI-OffsiteBackup`, diaria a las
**03:35 de Colombia**, con `StartWhenAvailable` y sesión abierta. La prueba
desde el Programador terminó con `LastTaskResult=0`; próxima ejecución
10 de octubre a las 03:35. Copias existentes preservadas, carpeta excluida de Git.

```powershell
Get-ScheduledTaskInfo -TaskName MateosPetAI-OffsiteBackup |
  Select-Object LastRunTime, LastTaskResult, NextRunTime
```

Ese corte histórico del paso 5 comprobó copia independiente, frecuencia y restauración.
El seguimiento vigente y el nuevo objetivo de recuperación se describen en el
ensayo del 26/10 anterior; esta evidencia del 9/10 no cierra sus pendientes nuevos.
El operador debe vigilar las ejecuciones futuras y la fecha del conjunto: el
equipo necesita estar encendido, conectado y con sesión abierta. La tarea no
crea alta disponibilidad ni garantiza el respaldo externo mientras el equipo
está apagado. Un respaldo remoto con más de 36 horas produce fallo; investigar
el timer de la VPS y no borrar las copias anteriores.
