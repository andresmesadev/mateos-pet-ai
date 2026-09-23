# Cambio de Neon a PostgreSQL en la VPS

**Fecha:** 2026-09-23. **Alcance:** reinicio deliberado de los datos de prueba,
autorizado por el operador. La base de Neon no se borra ni modifica. El portal
y WhatsApp comienzan con un establecimiento nuevo y sin clientes ni citas.

## Arquitectura

`docker-compose.yml` ejecuta PostgreSQL 18 con pgvector en una red privada de
Docker. No publica el puerto 5432. La contraseña se guarda fuera de Git en
`secrets/postgres_password`; `backend/.env` contiene la URL interna y tiene
permisos `600`. El volumen `postgres_data` persiste aunque se reconstruyan los
contenedores. El backend espera a que la base responda antes de arrancar.

## Secuencia de cambio

1. Generar una contraseña aleatoria en `secrets/postgres_password` con permisos
   `600` y guardar una copia privada del `backend/.env` anterior.
2. Arrancar solo `db`; comprobar `pg_isready` y `pgvector`.
3. Cambiar `DATABASE_URL` en `backend/.env` al hostname interno `db` y poner
   `NEON_LOW_USAGE_MODE=false`.
4. Ejecutar `prisma migrate deploy` desde un contenedor temporal Node 24 en
   la red privada. Exigir 35 migraciones aplicadas.
5. Reconstruir backend, ejecutar `bootstrap-local-tenant.js` y establecer
   `SINGLE_TENANT_ID` con el identificador recién creado.
6. Sembrar Catálogo de Eventos, Canal WhatsApp, Servicios y Staff; reiniciar
   backend para incorporar `SINGLE_TENANT_ID`.
7. Verificar salud, vector, datos de arranque, agenda y un mensaje entrante
   real. Comprobar que el trabajo entrante termine en `done/complete`.
8. Quitar la suspensión del timer, ejecutar una copia cifrada y restaurarla
   en PostgreSQL desechable.

## Límites conocidos

- Los mensajes enviados mientras Neon estaba bloqueado no fueron persistidos
  por el backend; deben enviarse de nuevo.
- Clientes, mascotas, citas, configuración de servicios y horarios anteriores
  eran datos de prueba y no se importan. La configuración operativa nueva debe
  revisarse en el panel antes de pruebas de agenda.
- Las copias automáticas en la misma VPS protegen contra errores de datos, pero
  no contra pérdida de la máquina completa. Para beta externa se necesita copia
  cifrada en un segundo lugar.
