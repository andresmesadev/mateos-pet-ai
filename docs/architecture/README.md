# Arquitectura y contratos aprobados

## Fuentes principales

- [Modelo de dominio](domain-model-v1.md): entidades, contextos y responsabilidades; Tenant es la unidad de aislamiento.
- [Casos de uso](use-cases/README.md) y [diseño técnico por contexto](technical-design/README.md): especificaciones aprobadas de los entregables originales.
- [Decisiones arquitectónicas](../decisions/README.md): reconciliaciones y ampliaciones posteriores.
- [Estado actual](../ESTADO_ACTUAL.md): diferencia entre diseño aprobado, implementación local y publicación.

## Integraciones operativas

Revisión de cierre del frontend: [diagnóstico original](FRONTEND_CIERRE_REVISION_PROFUNDA_20261008.md) y [correcciones, comprobaciones y límites actuales](../history/FRONTEND_CIERRE_AJUSTES_20261008.md).

| Área | Referencia |
| --- | --- |
| Perfiles y áreas del negocio | [Equipo y acceso](team-business-access.md) |
| Clientes y mascotas | [Mantenimiento del dashboard](contacts-dashboard-maintenance.md) |
| Historia clínica | [Correcciones y trazabilidad](clinical-history-corrections.md) |
| Peluquería | [Atenciones e historial](grooming-dashboard.md) |
| WhatsApp | [Atención compartida](whatsapp-team-workspace.md), [mantenimiento](whatsapp-dashboard-maintenance.md), [mapa de desacoplamiento](whatsapp-decoupling-map.md) |
| Punto de venta | [Espacio de trabajo](pos-workspace.md), [detalle paginado](pos-history-pagination.md) |
| Inventario | [Definición y casos de uso](inventory-workspace.md), [arquitectura](inventory-technical-design.md), [persistencia](inventory-persistence-model.md), [esquema físico](inventory-physical-schema.md) |
| Seguimiento de clientes | [Integración](customer-followup-integration.md) |
| Excepciones fechadas de agenda | [Etapas aprobadas y estado](../history/AGENDA_EXCEPTIONS_COMPLETION_REPORT.md) |

Los archivos `inventory-schema-draft.prisma` e `inventory-migration-draft.sql` son evidencia del diseño aprobado, no el esquema ni la migración de producción. El SQL sigue siendo consumido por `scripts/validate-inventory-schema-draft.cjs`; se conserva su ubicación. El esquema ejecutable está en `prisma/schema.prisma` y las migraciones en `prisma/migrations/`.

Las propuestas concluidas se consultan en [historial de diseños](../history/designs/README.md). Los diagramas de un commit anterior se consultan en [diagramas históricos](../history/diagrams/README.md).
