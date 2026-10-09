# Estado actual del proyecto

Fecha de corte documental: **8 de octubre de 2026**. Este documento orienta la lectura; no sustituye el Plan Maestro, el modelo de dominio ni los ADR.

## Publicación y trabajo local

| Ámbito | Estado respaldado por evidencia |
| --- | --- |
| Versión declarada del backend | `2.45.0`, en `backend/package.json` y salud de producción; [publicación certificada](history/RELEASE_2_45_0_VPS_20261008.md). |
| Última publicación documentada | [2.45.0 — Dashboard unificado](history/RELEASE_2_45_0_VPS_20261008.md), publicada y comprobada el 8 de octubre, hora de Colombia: CI verde, respaldo cifrado, 14 destinos HTTPS y conteos conservados. |
| Inicio, navegación y continuidad de trabajo | Mejoras publicadas en 2.45.0, después de la [revisión general del dashboard](history/REVISION_GENERAL_DASHBOARD_20261008.md). |
| Correcciones finales del frontend | Recuperación del pago, pendientes de todas las fechas, seguimiento clínico con reintento y bloqueo del precio durante el guardado publicados en 2.45.0. [Evidencia y límites del cierre local](history/FRONTEND_CIERRE_AJUSTES_20261008.md). La comprobación manual con zoom real y lector de pantalla continúa sin certificar. |
| Inventario y Seguimiento de clientes | Publicados en [2.43.0](history/RELEASE_2_43_0_VPS_20261005.md), después de la implementación y migración de Inventario en [2.42.0](history/RELEASE_2_42_0_VPS_20261005.md). |

## Fuentes por módulo

| Módulo | Diseño o contrato | Evidencia de referencia |
| --- | --- | --- |
| Inicio y recorridos entre módulos | [Modelo de dominio](architecture/domain-model-v1.md) y [propuestas implementadas](history/designs/README.md) | [Revisión general local](history/REVISION_GENERAL_DASHBOARD_20261008.md), [continuidad y seguimientos](history/CIERRE_INICIO_CONTINUIDAD_Y_SEGUIMIENTOS_20261008.md) |
| Administración | [Acceso por perfil y áreas](architecture/team-business-access.md), [decisiones](decisions/README.md) | [Revisión del conjunto](history/ADMINISTRACION_REVISION_CONJUNTO_20261007.md), [publicación](history/RELEASE_2_44_0_VPS_20261007.md) |
| Agenda | [Horarios por servicio](decisions/012-horarios-por-servicio.md), [excepciones](decisions/013-excepciones-fechadas-de-agenda.md), [equipo](decisions/011-equipo-disponibilidad-agenda.md) | [Excepciones de agenda](history/AGENDA_EXCEPTIONS_COMPLETION_REPORT.md), [disponibilidad del equipo](history/EQUIPO_DISPONIBILIDAD_AGENDA_20261007.md) |
| Consultas y expediente | [Correcciones de historia clínica](architecture/clinical-history-corrections.md), [clientes y mascotas](architecture/contacts-dashboard-maintenance.md) | [Recorrido real en PostgreSQL local](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| Peluquería | [Diseño e integración](architecture/grooming-dashboard.md) | [Recorrido y aislamiento local](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| WhatsApp | [Atención compartida](architecture/whatsapp-team-workspace.md), [ADR 014](decisions/014-whatsapp-atencion-compartida.md) | [Revisión local y límites](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| Punto de venta | [Espacio POS](architecture/pos-workspace.md), [nombres y paginación](architecture/pos-history-pagination.md) | [Publicación 2.42.0](history/RELEASE_2_42_0_VPS_20261005.md), [integración local](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| Inventario | [Cinco etapas aprobadas](architecture/inventory-workspace.md), [ADR 015](decisions/015-inventario-productos-insumos.md), [venta atómica](decisions/016-venta-inventario-atomica.md) | [Implementación](history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md), [publicación 2.43.0](history/RELEASE_2_43_0_VPS_20261005.md) |
| Seguimiento de clientes | [Integración](architecture/customer-followup-integration.md) | [Ajustes y comprobaciones](history/SEGUIMIENTO_CLIENTES_AJUSTES_FINALES_20261005.md), [límites de prueba real](history/RELEASE_2_43_0_VPS_20261005.md) |

## Pendientes que la limpieza no cierra

- **Accesibilidad manual:** zoom real y lector de pantalla continúan pendientes; los controles automatizados no sustituyen esas comprobaciones.
- **Beta externa:** el [plan de preparación](operations/CLOSED_BETA_READINESS_PLAN_20260919.md) y la [matriz de agenda](operations/CLOSED_BETA_AGENDA_MATRIX_20260926.md) conservan comprobaciones reales pendientes. Las pruebas de dashboard y PostgreSQL local no sustituyen la observación del piloto ni todos los casos del canal WhatsApp.
- **Reactivación por WhatsApp real:** el informe de publicación 2.43.0 documenta la falta de nombre/idioma de plantilla aprobada. No consta en ese informe un envío real concluido; no darlo por certificado a partir de pruebas simuladas.
- **Documentos legales:** ambas plantillas conservan campos del prestador, contacto y fecha por completar. [Estado y alcance](legal/README.md).
- **Fase 8:** el roadmap 8.1–8.3 y la extensión 8.4 tienen informes de cierre. Eso no equivale a inventar un cierre formal de fase distinto del registrado en el Plan Maestro.

## Uso de documentos antiguos

Las propuestas concluidas sirven para entender el diseño y sus aprobaciones. Las auditorías y procedimientos anteriores sirven como antecedentes, con sus límites originales. Para saber qué funciona hoy, partir de esta página y contrastar el diseño con sus ADR, el código y la evidencia más reciente.
