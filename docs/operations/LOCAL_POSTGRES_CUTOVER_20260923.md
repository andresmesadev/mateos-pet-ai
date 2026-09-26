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
3. Cambiar `DATABASE_URL` en `backend/.env` al hostname interno `db` y retirar
   cualquier variable de configuración que perteneciera a Neon.
4. Ejecutar `prisma migrate deploy` desde un contenedor temporal Node 24 en
   la red privada. Exigir todas las migraciones versionadas aplicadas (36 tras
   la corrección del esquema).
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

## Resultado del cambio

El 2026-09-23 se aplicaron las 35 migraciones en PostgreSQL 18/pgvector 0.8.6.
Se inicializó el establecimiento con dos empleados digitales, un canal de
WhatsApp, 15 servicios y tres miembros de staff. El backend `2.39.9` quedó
conectado a la base privada de Docker y `/api/health` respondió `status: ok`,
con base, OpenAI y worker entrante en `ok`. El timer diario quedó activo y
produjo la copia cifrada `mateos-pet-ai-20260923T171826Z`. Se descifró en el
equipo del operador y se restauró en una base temporal aislada: 37 tablas y
35 migraciones verificadas. La clave privada no salió del equipo local.

**Pendiente de validación funcional:** enviar un WhatsApp nuevo al número de
prueba y confirmar respuesta, trabajo entrante completado y una cita visible
en el panel. Es una prueba manual con un remitente autorizado; no se simula
una conversación real con clientes. Revisar también los horarios y precios de
servicios reiniciados antes de usar la agenda.

**Corrección posterior de la prueba de WhatsApp:** el primer mensaje reveló
que `schema.prisma` incluía columnas y tablas sin migración versionada. Los
trabajos quedaron en `needs_review/sending` porque faltaba
`Conversation.abandonReminderSent`; el envío a Meta todavía no había ocurrido.
La migración `20260923180000_reconcile_schema_after_fresh_install` añadió los
objetos faltantes. La diferencia entre esquema y base pasó a cero, los dos
trabajos de prueba se reanudaron de forma controlada y quedaron en
`done/complete`, con dos mensajes salientes registrados. El backend `2.39.10`
respondió `status: ok`; hay 36 migraciones aplicadas. Se creó otra copia
cifrada después de la corrección (`mateos-pet-ai-20260923T172733Z`). CI ahora
aplica todas las migraciones en una base vacía y comprueba que no haya deriva.

Sigue pendiente comprobar una reserva completa y su aparición en el panel.

El workflow manual de GitHub llamado `Deploy` se retiró porque seguía
ejecutando migraciones contra la URL antigua de Neon y nunca desplegaba en la
VPS. CI usa ahora una URL local ficticia para las pruebas unitarias; el trabajo
de PostgreSQL usa exclusivamente su contenedor de prueba. Los despliegues
actuales se hacen desde la VPS mediante `git pull --ff-only`, migraciones
contra la red privada y reconstrucción de los servicios. Se recomienda borrar
el secreto `DATABASE_URL` antiguo del repositorio de GitHub si ya no tiene
consumidores externos conocidos; no se necesita para el CI actual.
