# ADR 004 — Resolver Disponibilidad del Staff puede consultar Servicios vía puerto de existencia

**Fecha:** 2026-07-01
**Estado:** Aceptado
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.2 — Sistema Operativo de Staff
**Origen:** Auditoría funcional del Entregable 2.2 (etapa 6 — Validación, `docs/PHASE_2_EXECUTION_RULE.md`). Mismo criterio aplicado en `docs/decisions/002-resolver-precio-consulta-atributos-mascota.md` (Entregable 2.1).

---

## Contexto

El contrato funcional aprobado para **Resolver Disponibilidad del Staff** (`docs/architecture/use-cases/sistema-operativo-staff.md`, sección 10) declara: *"Qué contextos consume — Ninguno externo de forma directa: capacidad y disponibilidad ya viven dentro de Staff."*

Esa afirmación es cierta para la disponibilidad y la capacidad en sí — ambas viven dentro de `Staff`. No es cierta para la validación de que el `serviceId` recibido como entrada realmente existe: ese dato vive en el contexto `Servicios`. La propia Arquitectura Técnica del mismo entregable, redactada en la misma etapa, ya había anticipado esto al listar `ReferencedServiceNotFoundError` como error posible del caso de uso — lo cual exige, necesariamente, consultar a `Servicios`. La auditoría funcional detectó esta inconsistencia entre dos secciones del mismo documento aprobado.

## Decisión

**Resolver Disponibilidad del Staff puede consultar el contexto Servicios, exclusivamente a través de `ServiceExistenceReaderPort.exists(serviceId)`**, el mismo puerto mínimo ya usado por `ManageStaffCapabilitiesUseCase`. No conoce ningún otro dato de `Servicios` — ni su categoría, ni su precio, ni su estructura completa.

Esta no es una excepción al límite "Staff no debe conocer Servicios más allá de lo mínimo". Es la misma forma de acceso ya autorizada en este entregable, aplicada a un segundo caso de uso que comparte la misma necesidad puntual: confirmar que un identificador recibido corresponde a un servicio real antes de razonar sobre él.

## Consecuencias

- El contrato funcional (`sistema-operativo-staff.md`, sección 10) se actualiza para reflejar esta decisión explícitamente.
- La Arquitectura Técnica no requiere cambios: ya documentaba `ReferencedServiceNotFoundError` y el puerto `ServiceExistenceReaderPort` en su sección de dependencias; este ADR formaliza que su uso por parte de `ResolveStaffAvailabilityUseCase` es intencional, no una desviación pendiente.
- Ningún otro caso de uso de Staff queda autorizado a consultar Servicios más allá de lo ya contratado (`ManageStaffCapabilitiesUseCase` y `RecordCommissionOnAppointmentCompletedUseCase`, vía sus puertos ya documentados, y ahora `ResolveStaffAvailabilityUseCase`). Cualquier necesidad adicional requiere su propio ADR.

---

*ADR 004 · Plataforma Operativa Inteligente · Mateos Pet*
