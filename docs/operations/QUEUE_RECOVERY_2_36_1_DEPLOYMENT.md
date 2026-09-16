# Despliegue de recuperación de cola 2.36.1

Estado: preparado el 2026-09-16. Este documento no autoriza por sí mismo ningún despliegue. La revisión de la estación de trabajo no encontró acceso SSH, alias SSH ni dominio de producción; el servidor debe ejecutar la inspección desde su checkout real.

## Hechos verificados antes de producción

- Producción usa Oracle Cloud, Nginx y `docker-compose`; `scripts/deploy.sh` es el camino documentado.
- El último CI remoto exitoso corresponde al commit `2e557f3`, anterior a esta corrección. La nueva suite PostgreSQL se ejecutará en CI solo después de subir el cambio.
- La actual corrección introduce la migración `20260915170000_inbound_job_recovery`, versión `2.36.1`, checkpoints de cola y `needs_review`.
- La migración de 8.2 creó `InboundJob` con `db push`; por eso esta migración puede crear la tabla si falta y conserva instalaciones que ya la tienen.
- El worker anterior no conoce `phase`, `nextAttemptAt` ni concesiones. No debe seguir ejecutándose tras aplicar esta migración.

## Inspección del servidor

Desde el checkout de la VPS, antes de hacer cambios:

```bash
chmod +x scripts/vps-preflight.sh scripts/backup-inbound-job.sh
./scripts/vps-preflight.sh
```

Guardar el resultado con hora, commit, versión activa, estado de migraciones, estado de los contenedores y resumen de `InboundJob`. El script es de solo lectura: usa `docker compose exec` para consultar la base a través del contenedor backend y no muestra credenciales.

No continuar si ocurre alguno de estos casos:

- el checkout del servidor tiene cambios sin identificar;
- `npx prisma migrate status` muestra migraciones fallidas, pendientes distintas a esta entrega, o drift;
- backend o health no están sanos antes de empezar;
- hay `claimed` vencidos, `failed` o `needs_review` sin una conciliación previa;
- la versión y el commit activos no coinciden con los que se esperan desplegar.

## Backup antes de la migración

El snapshot contiene payloads y puede contener datos personales. Crear primero un directorio privado fuera del repositorio, con cifrado y retención aprobados por quien opera la VPS. Por ejemplo, si ya existe `/var/backups/mateos-pet-ai` con permisos del operador:

```bash
./scripts/backup-inbound-job.sh /var/backups/mateos-pet-ai
sha256sum /var/backups/mateos-pet-ai/inbound-job-pre-2.36.1-*.json
```

La salida guarda filas de `_prisma_migrations` y de `InboundJob`. No copiar ese archivo a un chat, al repositorio ni a logs públicos. Confirmar que el hash y la ruta se registraron antes de detener el worker.

## Secuencia propuesta

La ventana debe incluir una persona que pueda atender conversaciones mientras el backend se actualiza. Detener los webhooks entrantes no es necesario: Meta puede reintentarlos y el backend responderá una vez esté arriba; lo imprescindible es que el worker antiguo no procese durante la transición.

1. Ejecutar y guardar el preflight.
2. Crear y verificar el backup.
3. Confirmar que el commit de la entrega y CI están disponibles en `main`.
4. Detener solo el backend: `docker-compose stop backend` (o `docker compose stop backend`, según el resultado del preflight). El frontend puede permanecer arriba; sus llamadas al backend fallarán temporalmente.
5. Actualizar el checkout de forma limpia y revisar el diff/commit. Ejecutar `npm ci`, `npx prisma migrate status` y `npx prisma migrate deploy` desde la raíz del repositorio. No usar `prisma db push`.
6. Ejecutar `npx prisma generate` después de la migración.
7. Ejecutar el seed idempotente del Catálogo de Tipos de Evento: `docker compose run --rm --workdir /app backend node backend/src/scripts/seed-event-types.js`. Esto evita que los Empleados Digitales generen errores de certificación cuando el catálogo aún no tenga sus tipos.
8. Construir y arrancar los contenedores: `docker-compose up -d --build`.
9. Esperar el arranque y repetir el preflight. Confirmar versión `2.36.1`, `status: ok` en `/api/health`, y el log `Scheduled every 5 seconds`.
10. Enviar un único mensaje controlado de WhatsApp. Confirmar una respuesta, una fila `done/complete` y ausencia de errores o `needs_review` nuevos. No repetir el mismo webhook ni reenviar manualmente el mismo mensaje durante esa prueba.
11. Observar logs y resumen de cola durante 15 minutos. Verificar tanto el backend como el flujo de dashboard principal.

## Rollback y límites

No se debe restaurar automáticamente el código anterior después de aplicar esta migración: el worker anterior ignora los nuevos checkpoints y podría volver a consumir reintentos sin respetar la espera.

Si falla antes de ejecutar `migrate deploy`, volver a levantar el backend existente con `docker-compose up -d backend` y revisar la causa.

Si falla después de la migración, mantener el backend detenido, conservar logs y backup, y decidir con el operador entre reparar la entrega o restaurar base y artefacto de forma coordinada. No convertir en lote `needs_review` a `received`; cada fila puede corresponder a una cita o respuesta cuyo resultado es incierto.

Revertir o restaurar requiere confirmar el commit/imágenes previamente activos y la consistencia de PostgreSQL. Es una operación de producción con riesgo de datos; no se ha automatizado en scripts locales.

## Evidencia posterior esperada

Registrar: commit desplegado, hora de inicio/fin, hash de backup, resultado de `migrate status`, salida de health, versión, resumen de cola antes y después, identificación del mensaje controlado y cualquier fila `needs_review` conciliada. El informe de corrección local sigue siendo [CORRECCION_COLA_ENTRANTE_2026_09_15.md](../history/CORRECCION_COLA_ENTRANTE_2026_09_15.md).
