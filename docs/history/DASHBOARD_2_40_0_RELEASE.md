# Entrega de mantenimiento del dashboard — v2.40.0

Fecha: 2026-10-01. Autorización: commit, push y despliegue en la VPS.

## Alcance

- Clientes y mascotas: fichas, expedientes, registros e historial; navegación a la cita exacta y agenda filtrada por propietario; protección de borradores y paginación.
- WhatsApp: bandeja y chat similares a WhatsApp Web, búsqueda, borradores, autores reales, contexto de citas según perfil y atención humana persistente con devolución explícita a la IA.
- Acceso de administrador, veterinario, recepción y peluquería, validado contra credenciales vigentes del servidor y limitado por establecimiento.
- Contexto Docker del backend excluye dependencias locales, secretos y archivos de entorno; la configuración de producción se sigue inyectando en ejecución.

Diseño y decisiones: `docs/architecture/contacts-dashboard-maintenance.md`, `docs/architecture/whatsapp-dashboard-maintenance.md`, `docs/architecture/whatsapp-team-workspace.md` y ADR 014. Es mantenimiento autorizado de capacidades existentes; no inaugura una fase.

## Evidencia previa al commit

```text
npm test -- --runInBand --silent --json --outputFile=%TEMP%/mateos-release-jest.json
Test Suites: 154 passed, 154 total
Tests:       1166 passed, 1166 total
Time:        29.056 s
Exit:        0

Frontend npm run lint
> eslint
Exit: 0

Frontend npm run build (verificación de implementación)
Compiled successfully
Finished TypeScript
Generating static pages (28/28)
Exit: 0

node --test scripts/whatsapp-workspace.test.cjs scripts/contact-navigation.test.cjs scripts/contact-profile-utils.test.cjs
tests 15 / pass 15 / fail 0

git diff --check
Exit: 0
```

El recorrido local se comprobó en PostgreSQL y navegador con los cuatro perfiles, móvil y escritorio. Los datos sintéticos fueron retirados. La entrega externa de mensajes se probó con proveedor simulado; falta una prueba real de WhatsApp autorizada.

## Publicación y recuperación

Versión funcional menor 2.40.0, declarada por el backend y su lockfile; el endpoint de salud lee esa misma versión. Migración aditiva `20261001180000_whatsapp_team_control`, aplicada antes de iniciar el nuevo backend.

VPS: `/home/ubuntu/mateos-pet-ai`, una instancia de backend. Estado previo: commit `1eb644b`, checkout limpio, base y worker saludables. Respaldo PostgreSQL previo al despliegue: `/home/ubuntu/backups/mateos-pet-ai/before-v2.40.0-20261001T1845.dump`, listado de archivo verificado y permisos 600. Imágenes anteriores conservadas como `mateos-pet-ai-backend:rollback-1eb644b` y `mateos-pet-ai-frontend:rollback-1eb644b`.

Si fallan salud o acceso tras actualizar, restaurar conjuntamente las imágenes anteriores. Las columnas añadidas son compatibles con el código anterior; no se necesita borrar datos ni revertir la migración para ese retorno. El respaldo queda disponible para recuperación de la base si fuese necesaria.
