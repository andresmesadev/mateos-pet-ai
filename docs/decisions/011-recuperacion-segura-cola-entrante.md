# ADR 011 — Recuperación segura de la cola entrante

Fecha: 2026-09-15. Estado: implementado y validado localmente como corrección autorizada de los hallazgos 1 y 2 de `REVISION_GENERAL_2026_09_15.md`. Despliegue pendiente; resultados en `docs/history/CORRECCION_COLA_ENTRANTE_2026_09_15.md`.

## 1. Definición funcional

Evitar trabajos abandonados en `claimed` y reintentos inmediatos. Recuperar automáticamente solo donde hay evidencia persistida de que repetir el siguiente paso es seguro. No cambiar reglas de negocio ni reescribir el motor conversacional.

## 2. Casos de uso e invariantes

- Reclamar exclusivamente trabajos vencidos para ejecución, conservando la exclusión atómica de PostgreSQL.
- Mantener una concesión temporal renovable durante el procesamiento; un propietario anterior no puede actualizar una reclamación posterior.
- Persistir las respuestas preparadas y un cursor de entrega: reanudar un envío pendiente no vuelve a ejecutar el motor ni respuestas ya confirmadas.
- Recuperar concesiones vencidas antes de procesar (`pending`) o entre envíos (`ready`). Finalizar sin reenviar si todas las respuestas quedaron confirmadas (`complete`).
- Interrupción dentro del motor (`processing`) o durante el envío (`sending`): `needs_review`, con causa y cursor persistidos. No reejecutar efectos cuyo resultado se desconoce. Las excepciones del motor se tratan con el mismo criterio: no garantizan que no haya ocurrido una escritura previa.
- Fallos anteriores a efectos y recuperaciones seguras: espera persistida exponencial de 5, 10, 20 y 40 segundos, máximo cinco reclamaciones.

## 3. Arquitectura y reconciliación

La cola permanece en infraestructura (`inbound-job.service.js`, `inbound-message.job.js`), reutilizando Recepcionista y Comunicación. No se tocan los contextos ni el motor. La garantía absoluta ante crash declarada en 8.2 era incorrecta: no hay transacción única entre el motor, PostgreSQL y Meta.

Se agregan checkpoints antes y después de cada efecto; `attempts` actúa como generación de propietario y todas las escrituras del worker exigen esa generación, estado `claimed` y concesión vigente. La recuperación usa bloqueos de fila y compara la concesión. Se renueva cada 20 segundos con duración de 120 segundos; si falla la renovación, el worker no inicia el siguiente efecto. Un drenado por proceso evita solapar ticks.

**Corrección operativa v2.39.1 (2026-09-18).** El sondeo vacío cada cinco segundos mantenía activo permanentemente el compute serverless de PostgreSQL. El webhook ahora solicita el drenado inmediatamente después de crear un trabajo, el arranque del backend recupera pendientes y un barrido cada 15 minutos conserva la red de seguridad para reinicios, señales perdidas y concesiones vencidas. Los checkpoints, leases y criterios de recuperación de este ADR no cambian. El worker consulta el próximo `nextAttemptAt` después de cada drenado y programa exactamente ese despertar, respetando el backoff persistido sin volver al sondeo permanente.

Los tres reintentos de envío en vivo de 8.4 se conservan, con su límite conocido: un error de red puede ser ambiguo. Esta corrección no promete entrega exactamente una vez frente a Meta; no agrega reenvíos automáticos después de un crash incierto. Agotarlos deja `needs_review`, no un falso `done`.

### Decisiones arquitectónicas diferidas

Idempotencia integral del motor y confirmación/idempotencia del proveedor quedan fuera de esta corrección. Requieren contratos de negocio/proveedor propios; no se simulan reencolando. No se añade una pantalla operativa nueva: el runbook incluye consultas de diagnóstico y exige conciliación humana antes de cualquier replay incierto.

## 4. Persistencia

`InboundJob` sigue siendo infraestructura sin relaciones de dominio nuevas. Se añaden `phase`, `replies` (solo contrato mínimo de envío), `replyCursor`, `nextAttemptAt` y `leaseExpiresAt`. El cuerpo entrante permanece intacto. `needs_review` es terminal para el worker automático.

## 5. Esquema físico y despliegue

Migración aditiva con índices `(status, nextAttemptAt, createdAt)` y `(status, leaseExpiresAt)`. Conservar el índice anterior. Los trabajos heredados `claimed` y `received` con intentos previos se ponen en `needs_review`: no tienen checkpoints y no es seguro asumir que no ejecutaron efectos. Los `done` se marcan `complete`.

El historial de migraciones no contiene la creación de `InboundJob`, aunque existe en el schema actual: la migración incluye `CREATE TABLE IF NOT EXISTS` con su estructura previa y luego los campos nuevos. Se debe detener el worker antiguo antes de aplicar la migración y desplegar el nuevo. Regenerar ambos clientes Prisma; no aplicar cambios contra producción durante esta tarea.

## Criterios de validación

Pruebas de recuperación y backoff sobre PostgreSQL aislado, reclamación concurrente, fencing de propietario vencido, conservación del cursor y ausencia de replay en `processing`/`sending`; pruebas del worker ante fallos entre checkpoints; suite completa, lint y build. Registrar los resultados reales antes del cierre.
