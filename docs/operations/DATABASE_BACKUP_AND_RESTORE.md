# Backup y restauración de PostgreSQL

- **Versión inicial:** `2.39.8`
- **Frecuencia:** diaria, 08:10 UTC (03:10 en Colombia), con demora aleatoria de hasta 10 minutos
- **Retención:** 14 días
- **Ubicación:** `/var/backups/mateos-pet-ai` en la VPS
- **Cifrado:** `age`, usando la clave pública SSH del operador

## Garantías operativas

- La clave privada no se copia a la VPS. Permanece en el equipo del operador.
- La copia sin cifrar solo existe en un directorio temporal privado durante el proceso y se elimina incluso si el proceso falla.
- La credencial de PostgreSQL se entrega a `pg_dump` mediante un archivo temporal con permisos `600`; no aparece en los argumentos del proceso ni en los logs.
- Cada respaldo incluye una suma SHA-256 y se valida con `pg_restore --list` antes de considerarse completo.
- La publicación del conjunto es atómica: un directorio incompleto nunca adopta el nombre definitivo.
- La restauración de ensayo usa un contenedor PostgreSQL desechable y no conoce la URL de producción.
- El timer conserva los últimos 14 días y elimina solamente directorios con el patrón exacto de este sistema.

## Componentes

- `scripts/backup-database.sh`: genera y cifra el respaldo.
- `scripts/restore-database-drill.sh`: verifica integridad y restaura en una base temporal.
- `scripts/install-backup-service.sh`: instala configuración y timer.
- `scripts/copy-offsite-backup.cjs`: copia y verifica el conjunto cifrado en el equipo del operador; no descifra ni escribe en producción.
- `scripts/install-offsite-backup-task.ps1`: prepara o registra la copia diaria en Windows tras autorización del operador.
- `scripts/run-offsite-backup-task.ps1`: ejecuta la copia desde el Programador de tareas con rutas absolutas.
- `deploy/systemd/mateos-pet-ai-backup.{service,timer}`: ejecución diaria.

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
contenedor temporal de `pg_dump` con PostgreSQL. El timer ejecuta diariamente
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

El operador autorizó y se activó `MateosPetAI-OffsiteBackup`, diaria a las
**03:35 de Colombia**, con `StartWhenAvailable` y sesión abierta. La prueba
desde el Programador terminó con `LastTaskResult=0`; próxima ejecución
10 de octubre a las 03:35. Copias existentes preservadas, carpeta excluida de Git.

```powershell
Get-ScheduledTaskInfo -TaskName MateosPetAI-OffsiteBackup |
  Select-Object LastRunTime, LastTaskResult, NextRunTime
```

El paso 5 tiene comprobadas copia independiente, frecuencia y restauración.
El operador debe vigilar las ejecuciones futuras y la fecha del conjunto: el
equipo necesita estar encendido, conectado y con sesión abierta. La tarea no
crea alta disponibilidad ni garantiza el respaldo externo mientras el equipo
está apagado. Un respaldo remoto con más de 36 horas produce fallo; investigar
el timer de la VPS y no borrar las copias anteriores.
