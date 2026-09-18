# Corrección de CI y consumo continuo de Neon

**Fecha:** 2026-09-18  
**Versión:** v2.39.1

## Problemas confirmados

1. El trabajo general de GitHub Actions instalaba exclusivamente `backend/` y ejecutaba Jest sin generar el cliente Prisma. Después de incorporar `AgendaException`, 22 suites fallaban al cargar `@prisma/client` con una única causa raíz: `.prisma/client/default` ausente.
2. El worker de `InboundJob` consultaba PostgreSQL cada cinco segundos incluso con la cola vacía. Ese patrón impedía que el compute serverless alcanzara su ventana de inactividad y contribuyó a agotar la cuota mensual de Neon.

## Correcciones

- El trabajo `test` de CI instala las herramientas raíz, instala el backend y genera los clientes Prisma raíz y backend antes de Jest.
- El webhook despierta el worker únicamente cuando crea un trabajo nuevo.
- El worker drena al arrancar y conserva un barrido de recuperación cada 15 minutos.
- Después de cada drenado se consulta el próximo `nextAttemptAt` y se programa exactamente ese despertar para retomar los backoffs pendientes.
- Se mantienen sin cambios los leases, checkpoints, exclusión atómica y estados `needs_review` definidos por el ADR 011.

## Alcance

No hay cambios de esquema, reglas de negocio, contextos ni motor conversacional. La corrección se limita a infraestructura de CI y activación del worker de cola entrante.
