# Publicación 2.46.0 — Asistente y operaciones de agenda

**Fecha:** 10 de octubre de 2026, hora Colombia. **Estado:** código publicado y desplegado; continúa la validación interna. No habilita todavía beta externa.

## Código y CI

- Commit de implementación: `1d55f3e8a13b82f3a70c6136981f60eddde0bed0`, publicado en `main`.
- [CI de la implementación](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38083030421): `success` en los cuatro jobs: `test`, `lint`, `inbound-postgres` y `administration-postgres`.
- Backend local: 180 suites, 1.420 tests, exit 0. Lint: exit 0.
- PostgreSQL local real: 6 tests, 6 pass, 0 fail. Cubre reserva concurrente, movimiento concurrente y autorización; los fixtures propios se eliminaron. CI incorpora esa prueba en `administration-postgres`.

La prueba real detectó una incompatibilidad que los mocks no mostraban: el resultado `void` de `pg_advisory_xact_lock` no se podía deserializar con Prisma. Se convirtió a texto, siguiendo el patrón de la reserva existente. La prueba verifica también que una reserva nueva y una reprogramación compiten con el mismo bloqueo.

Diseño y alcance: [ADR 019](../decisions/019-asistente-contexto-y-operaciones-seguras.md), [implementación y pendientes](../operations/VIRTUAL_ASSISTANT_IMPROVEMENTS_EXECUTION_20261010.md). No hay migraciones nuevas ni cambios de schema.

## Respaldo y despliegue

Se ejecutó `mateos-pet-ai-backup.service` antes de desplegar: `Result=success`, `ExecMainStatus=0`. Respaldo cifrado: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261010T201456Z`.

Se ejecutó `scripts/deploy.sh` sobre el checkout limpio de la VPS. Backend construido; frontend reutilizó el build existente porque no cambió. Las 46 migraciones están aplicadas, sin pendientes. PostgreSQL permanece en Docker en la VPS; no se utiliza Neon.

Resultado de despliegue: exit 0, commit `1d55f3e`. Worker iniciado a las **15:19:06 de Colombia**. Los resets transitorios durante el arranque se recuperaron mediante los reintentos del script.

Comprobación HTTPS a las **15:19:54**:

```text
version=2.46.0
status=ok
database=ok
openai=ok
inboundWorker=ok
consecutiveFailures=0
```

Cola al publicar: 61 trabajos entrantes `whatsapp/done/complete`, cero leases vencidos. Logs recientes: cero firmas de error. Estas cifras son de partida; deben actualizarse con las pruebas posteriores. Los estados de entrega se contabilizan por separado como `provider=whatsapp_delivery`.

Smoke HTTPS sin escrituras de negocio ni mensajes salientes: autenticación de administrador aprobada, 14 destinos del dashboard HTTP 200, contratos de caja/servicios/inventario aprobados; petición ambigua HTTP 400 y proxy anónimo HTTP 401. No se cambiaron citas existentes durante el despliegue.

Dependencias de producción del backend: instalación informó cero vulnerabilidades. La instalación temporal raíz de herramientas volvió a informar cuatro hallazgos altos ya documentados en 2.45.1; esa carpeta se elimina de la imagen final. No se declara resuelto ese conjunto de desarrollo.

## Observación de estabilidad

Se conservó el archivo anterior de 2.45.2: 265 muestras, 22,79 horas, cero fallos de salud y un hueco. Ventana incompleta; no satisface 48 horas. Se detuvo únicamente su proceso identificado, PID 14236, antes de cambiar de versión.

Nueva ventana de 2.46.0:

- Archivo local `.cache/stability/ventana-2.46.0-20261010T201948Z.jsonl`, PID inicial 33648.
- Inicio: **10 de octubre a las 15:19:48 de Colombia**. Muestras cada cinco minutos.
- Final previsto: **12 de octubre a las 15:19:48**, si el equipo y proceso permanecen disponibles.
- Primera muestra correcta, versión única 2.46.0. Estado actual: `incomplete`.

Esta observación solo mide salud pública; no reemplaza probar cola, entregas, carga ni comprensión del modelo.

## Pruebas reales y pendientes

El operador envió «Quiero peluquería para Matías el martes 13 de octubre». A las 15:21:33 el asistente ofreció el martes 13 a las 11:00; la sesión mantuvo `bath_grooming`, Matías y el día propuesto, sin crear cita. El ID del mensaje saliente se relacionó con estados reales `sent` y `read` de Meta. No se exige recibir `delivered` para reconocer que este mensaje concreto llegó y fue leído.

Después envió «Para hoy ya no hay?». A las 15:22:29 el asistente ofreció hoy a las 16:00 para Matías; conservó peluquería y no listó la cita veterinaria de Akiles. Es una comprobación real del incidente y de que el hueco vencido de las 11:00 no bloquea el turno futuro.

La prueba también detectó un dato antiguo: la sesión conservaba `pet_type=other`, aunque solo Akiles estaba registrado y Matías no tenía especie confirmada. La detección de petición nueva dependía de la palabra «cita» y no reconocía «quiero peluquería». Se preparó la corrección `2.46.1` y una regresión del recorrido real para preguntar la especie antes de ofrecer horario; ver el [seguimiento](RELEASE_2_46_1_ASSISTANT_TRIAL_20261010.md). No se registró mascota ni cita nueva en estas dos pruebas.

Siguen pendientes: regreso a disponibilidad durante ese borrador, negativos, correcciones, recogida, cancelación ambigua, reprogramación fallida desde WhatsApp, dos clientes disputando un turno, recibos reales de entrega, atención humana/adjuntos y medición de tiempo de respuesta/tokens. No confundir la concurrencia comprobada en PostgreSQL con un recorrido completo por WhatsApp.

## Recuperación

La base no cambió de esquema. Ante regresión, detener el recorrido afectado y preservar trabajos inciertos para revisión. La reversión de código puede hacerse con un revert revisado del commit de implementación sobre `main`, CI y el mismo procedimiento de despliegue. No restaurar la base ni repetir operaciones inciertas automáticamente. La restauración de datos sigue la [guía de respaldo y recuperación](../operations/DATABASE_BACKUP_AND_RESTORE.md), con destino comprobado y autorizado.
