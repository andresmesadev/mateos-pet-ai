# Corrección de recuperación y reintentos de la cola entrante

**Fecha:** 2026-09-15. **Versión local:** `2.36.1`.
**Estado:** implementación y validación local completas; migración y despliegue de producción pendientes. No se creó commit ni tag.
**Diseño:** [ADR 011](../decisions/011-recuperacion-segura-cola-entrante.md).

## Resultado

Se corrigieron los dos hallazgos prioritarios de la revisión general:

1. Los trabajos abandonados ya no quedan indefinidamente en `claimed`: una concesión de 120 segundos, renovada cada 20, permite detectar al worker interrumpido. Los puntos seguros se recuperan automáticamente; los inciertos quedan explícitamente en `needs_review`.
2. Los reintentos seguros guardan `nextAttemptAt` y esperan 5, 10, 20 y 40 segundos. El drenado no consume inmediatamente los cinco intentos. El quinto intento fallido es terminal.

Las respuestas preparadas se guardan antes del envío junto a un cursor. Recuperar una respuesta pendiente no vuelve a invocar el motor; las respuestas anteriores confirmadas no se repiten. Todas las actualizaciones del worker comprueban su generación (`attempts`) y concesión vigente. Los ticks solapados comparten un solo drenado por proceso.

### Límite deliberado y cambio observable

Un crash dentro del motor puede ocurrir después de crear una cita. Un crash durante `sendMessage` puede ocurrir después de que Meta recibió el mensaje. Sin idempotencia integral no es seguro repetir esos pasos: quedan en `needs_review` y requieren conciliación. **No se promete recuperación automática de todo crash ni entrega exactamente una vez.**

Por la misma razón, una excepción del motor después de entrar en `processing` ya no dispara replay ciego. Se conservan los tres intentos de envío en vivo de 8.4, con esperas de 1 y 2 segundos; sus errores de red siguen siendo potencialmente ambiguos. Agotarlos ya no certifica falsamente `done`.

Los jobs heredados `claimed` o `received` con intentos previos se migran a revisión, porque no contienen evidencia de qué acciones terminaron. No se vuelven a ejecutar automáticamente.

## Alcance y arquitectura

- Infraestructura: `inbound-job.service.js` y `inbound-message.job.js`.
- Persistencia: cinco campos nuevos en `InboundJob`, dos índices y una migración aditiva.
- Pruebas: regresiones del servicio y worker; nueva suite separada sobre PostgreSQL real.
- CI: job `inbound-postgres` con base local desechable, sin secretos de producción.
- Versionado: `backend/package.json` y lockfile en `2.36.1`; ambas respuestas de salud leen esa versión desde package.json.
- Documentación: ADR 011 y rectificaciones explícitas en los informes históricos de 8.2 y 8.4.

Se verificó por diff que no cambiaron `backend/src/contexts/` ni los servicios protegidos del motor (`whatsapp`, `conversation`, `scheduling`, `availability`). La búsqueda de todos los consumidores de la cola confirmó el contrato actualizado en el worker y las pruebas. No hay reglas de negocio nuevas, entidades de dominio nuevas ni una fase nueva.

## Evidencia de validación

### Regresiones antes de corregir

Dos pruebas nuevas fallaron con la implementación anterior: no se programaba una espera y una respuesta preparada volvía a ejecutar el motor.

```text
Test Suites: 2 failed, 2 total
Tests:       2 failed, 24 passed, 26 total
EXIT_CODE=1
```

### Suite completa después de corregir

```text
npm --prefix backend test -- --runInBand --silent --verbose=false
Test Suites: 132 passed, 132 total
Tests:       1003 passed, 1003 total
Snapshots:   0 total
Time:        22.729 s, estimated 26 s
EXIT_CODE=0
```

Una ejecución previa se interrumpió con código nativo de Windows `-1073740791`, sin resumen de Jest; no se contó como exitosa. La repetición completa anterior terminó correctamente. Persisten mensajes de error de mocks preexistentes descritos en la revisión general; no se corrigieron dentro de este alcance.

Tras unificar la versión del endpoint de salud, se verificaron nuevamente las áreas afectadas:

```text
npm --prefix backend test -- --runInBand --silent --verbose=false --runTestsByPath src/services/__tests__/health.service.test.js src/services/__tests__/inbound-job.service.test.js src/__tests__/integration/inbound-message.job.test.js
Test Suites: 3 passed, 3 total
Tests:       43 passed, 43 total
EXIT_CODE=0
```

### PostgreSQL real y terminación abrupta

Ejecutado con PostgreSQL 18.4 local, base `inbound_test`, schema aleatorio por ejecución y cliente Prisma real. El runner local usó [embedded-postgres](https://github.com/leinelissen/embedded-postgres), instalado únicamente en `.cache/`, fuera de las dependencias del producto. El servidor se detuvo al terminar. En CI se usa un servicio PostgreSQL 18.

Comando portable con `INBOUND_TEST_DATABASE_URL` configurada explícitamente:

```text
npm --prefix backend run test:postgres
```

En esta máquina el runner `.cache/inbound-postgres/run-tests.mjs` inició la base, configuró esa variable y ejecutó el mismo archivo de pruebas con `node --test`:

```text
✔ concurrent claims cannot acquire the same row twice
✔ abandoned pending job is recovered with durable delay; old owner is fenced
✔ crash during processing requires review and cannot replay
✔ crash during sending requires review and cannot replay
✔ ready checkpoint retains reply cursor across recovery
✔ abrupt worker exit leaves a durable checkpoint recoverable by a new worker
✔ safe failures respect 5/10/20/40 second delays and stop after five claims
ℹ tests 13
ℹ pass 13
ℹ fail 0
ℹ skipped 0
EXIT_CODE=0
```

La prueba de crash termina un proceso hijo con código 23 después del checkpoint y recupera su fila desde otro proceso. Se adelanta explícitamente la expiración en la base de pruebas para evitar esperar 120 segundos. Los efectos del motor y Meta se verifican mediante las pruebas del worker; no se enviaron mensajes reales ni se crearon citas reales.

Las pruebas SQL también verifican la migración de filas heredadas, deduplicación concurrente, rechazo de concesiones vencidas, heartbeat, finalización desde `complete` y excepciones inciertas. No usan `DATABASE_URL` ni cargan dotenv: requieren una URL local explícita cuyo nombre de base incluya `test` y borran exclusivamente el schema generado para esa ejecución.

### Frontend y schema

```text
npm --prefix frontend run lint
✖ 3 problems (0 errors, 3 warnings)
EXIT_CODE=0

npm --prefix frontend run build
✓ Compiled successfully in 3.6s
  Finished TypeScript in 5.7s ...
✓ Generating static pages using 11 workers (26/26) in 437ms
EXIT_CODE=0

npx prisma generate
✔ Generated Prisma Client (v7.8.0)

npx prisma validate
The schema at prisma\schema.prisma is valid
```

Las tres advertencias de lint son los imports sin uso ya detectados en `sale-form.tsx` y `week-calendar.tsx`. El backend no tiene script de lint. `git diff --check` no encontró errores de whitespace; Git emitió únicamente avisos de conversión LF/CRLF.

## Puesta en producción pendiente

El procedimiento operativo detallado y los scripts de inspección/backup están en [QUEUE_RECOVERY_2_36_1_DEPLOYMENT.md](../operations/QUEUE_RECOVERY_2_36_1_DEPLOYMENT.md). Se prepararon sin conexión al servidor.

1. Revisar el estado real de migraciones y respaldar la base según el procedimiento del entorno. Esta tarea solo aplicó la migración en PostgreSQL aislado.
2. Detener el backend/worker antiguo antes de aplicar `20260915170000_inbound_job_recovery`. No mezclar workers antiguos y nuevos: el antiguo desconoce fases, concesiones y esperas.
3. Aplicar la migración revisada, generar Prisma y desplegar `2.36.1`. La migración contempla instalaciones donde 8.2 creó `InboundJob` mediante `db push`, sin migración histórica de esa tabla.
4. Confirmar versión de salud, arranque del worker y procesamiento de un mensaje controlado. Comprobar que no aumenta la cola vencida.
5. Revisar los casos heredados o nuevos `needs_review`; no convertirlos masivamente a `received`. El CI nuevo quedó configurado, pero su ejecución remota aún no se ha observado.

### Diagnóstico de solo lectura para operación autorizada

```sql
SELECT status, phase, COUNT(*)
FROM "InboundJob"
GROUP BY status, phase
ORDER BY status, phase;

SELECT id, "providerEventId", phase, attempts, "replyCursor",
       "claimedAt", "leaseExpiresAt", "finishedAt", "lastError"
FROM "InboundJob"
WHERE status IN ('needs_review', 'failed')
ORDER BY "createdAt" ASC
LIMIT 100;
```

Ante `processing`, contrastar conversación y operaciones realizadas (por ejemplo, cita creada) antes de decidir una acción. Ante `sending`, contrastar el mensaje saliente y el proveedor: la falta de una confirmación local no demuestra que Meta no lo entregó. Atender la conversación mediante el flujo humano existente; cualquier replay técnico requiere evidencia individual y un procedimiento separado. Este cambio no añade una pantalla de revisión ni un comando de replay.

## Cierre local

La corrección queda implementada, con pruebas locales y documentación. El despliegue, la conciliación de filas reales y una garantía integral de idempotencia permanecen fuera de lo verificado. No se modificaron los otros pendientes de la revisión general (cobertura amplia, limpieza de mocks, pruebas de interfaz y reconciliación global del roadmap).
