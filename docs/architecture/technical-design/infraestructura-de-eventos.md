# Entregable 3.0 — Infraestructura de Eventos

**Fecha:** 2026-07-03
**Fase:** Fase 3 — Empleados Digitales Especializados
**Proceso aplicado:** misma disciplina de la Regla de Ejecución de la Fase 2, adaptada con Etapa 1 = Modelo de Dominio (en vez de Definición Funcional), por tratarse de un contexto de infraestructura sin equivalente funcional directo hacia el cliente.
**Estado de este documento:** Implementado y validado. Etapa 3 congelada.
**Contexto de dominio que cubre:** Eventos (ver `docs/architecture/use-cases/infraestructura-de-eventos.md`, Etapas 1-2)

---

## Etapa 3 — Arquitectura Técnica

Este documento traduce el contrato funcional aprobado a una estructura técnica. No contiene código, ni endpoints, ni esquema de base de datos.

### 1. Estructura del contexto

Mismo patrón de capas ya establecido en 2.1–2.3 y el Puente: `domain / application / infrastructure`, composition root propio. Bounded context nuevo, sin relación jerárquica con los demás — todos lo conocen, él no conoce la lógica interna de ninguno.

### 2. Puertos de aplicación (interfaces, sin implementación)

- **`EventoDeDominioRepositoryPort`** — crear un Evento de Dominio; consultarlo por id, por tipo, por rango de fechas, por tenant.
- **`EntregaDeEventoRepositoryPort`** — crear una Entrega de Evento; listar las entregas de un evento; listar entregas fallidas de un consumidor (soporte del reintento).
- **`CatalogoDeEventosPort`** — registrar un Tipo de Evento; desactivarlo; consultarlo por nombre; listar tipos activos.
- **`DomainEventPublisherPort`** — mismo contrato ya usado por Finanzas/Staff/Servicios (`publish(name, payload)`), reutilizado para que Eventos publique sus propios hechos (`EventoDeDominioRegistrado`, `EntregaFallida`).

Ningún puerto asume su mecanismo de persistencia ni de entrega — eso se decide a continuación.

### 3. Relación con el dispatcher del Entregable Puente

**El `DomainEventDispatcher` del Puente no se toca ni se reabre.** Sigue siendo el mecanismo de composición síncrono, dentro de la misma transacción, que resuelve `CitaCompletada → Comisión + Cobro de sistema` con la garantía transaccional del ADR 007.

**Decisión:** Eventos introduce una **capa persistente de certificación** sobre ese dispatcher síncrono. La certificación del Evento de Dominio (caso de uso 3) forma parte del **cierre exitoso de la misma transacción lógica** ya existente — no depende del orden de ejecución de los demás handlers ni se describe como "un handler más" entre otros: es una condición del cierre exitoso de la transacción, junto con los efectos ya wireados. Esto da durabilidad y catálogo a los eventos existentes sin alterar ninguna garantía transaccional ya validada del Puente.

La **estrategia concreta de entrega asíncrona** hacia consumidores nuevos (empezando por Automatizaciones, 3.3) — incluida la posibilidad de un patrón Outbox — **permanece como decisión diferida** para las siguientes etapas de implementación. Esta etapa se limita a establecer que existe una capa persistente de certificación; no nombra ni compromete el mecanismo de entrega.

### 4. El Catálogo de Eventos se persiste

Dado que la Etapa 1 lo modeló como entidad con identidad y ciclo de vida gestionada por un caso de uso humano (Administración), una definición fija en código no podría soportar la desactivación en caliente que el Modelo de Dominio exige. El Catálogo de Eventos se persiste.

### 5. Naturaleza de "Registrar Entrega" y "Reintentar Entrega"

Conforme al ajuste congelado en la Etapa 2: no son casos de uso invocables por un canal ni por un operador — son invocados exclusivamente por el propio mecanismo de entrega de Eventos. No tienen adaptador HTTP ni humano en ningún punto de esta arquitectura.

### 6. Decisiones diferidas (Etapa 4/5, no se resuelven aquí)

1. Mecanismo exacto de entrega asíncrona (proceso continuo, poll periódico, patrón Outbox u otro) y su política de reintentos/backoff.
2. Migración de los publishers ya existentes (Finanzas, Staff, Servicios) para que sus eventos, además de su wiring síncrono actual, queden también certificados como Evento de Dominio.
3. Versionado del contrato de payload por Tipo de Evento.
4. Retención/purga histórica de Eventos de Dominio y Entregas.
5. Qué pasa con las Reglas de Automatización que referencian un Tipo de Evento desactivado — no pertenece a este contexto; se entrega como precondición de diseño al Entregable 3.3.

### 7. Sin tensión con contextos existentes

Verificado contra el mapa de contextos vigente: Eventos no necesita conocer la lógica interna de Agenda, Finanzas, Staff ni Servicios (solo el contrato tipo+payload, igual que Automatizaciones); no compite ni se superpone con Comunicación (§10), que sigue siendo exclusivamente la capa hacia canales externos.
