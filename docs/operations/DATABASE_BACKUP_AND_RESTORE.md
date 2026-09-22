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
- `deploy/systemd/mateos-pet-ai-backup.{service,timer}`: ejecución diaria.

La imagen `postgres:18-alpine` fija las herramientas de copia y restauración. `age`
se instala desde su publicación oficial y se verifica contra el SHA-256 publicado.

## Instalación en la VPS

La clave que se entrega al instalador es pública:

```bash
./scripts/install-backup-service.sh /tmp/mateos-backup-recipient.pub
```

La configuración inicial contiene
`MATEOS_BACKUP_NOT_BEFORE=2026-10-01T00:00:00Z`. Hasta esa fecha el timer queda
activo pero omite la conexión, para no generar intentos inútiles durante el corte
de cuota de Neon. Desde esa fecha ejecutará el respaldo diario automáticamente.

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
contenedor temporal al terminar. Para una recuperación real se debe ensayar
primero de esta manera y luego aprobar explícitamente el destino definitivo.

## Criterios de alerta

- no aparece un nuevo directorio después de dos ventanas diarias;
- falla la suma SHA-256;
- `pg_restore --list` no reconoce el archivo;
- el ensayo no restaura tablas o migraciones;
- el espacio libre de la VPS baja de 20 GB.

## Estado durante el corte de Neon

La infraestructura queda instalada y se valida con una base PostgreSQL aislada.
El primer respaldo de los datos reales solo puede generarse cuando Neon reactive
la base el 1 de octubre de 2026. El paso 5 de preparación para beta no debe
declararse cerrado hasta conservar ese respaldo real y restaurarlo con éxito.
