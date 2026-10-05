# ADR 016 — Coordinar venta y stock en una confirmación atómica

**Fecha:** 2026-10-02.

**Estado:** aceptado el 2026-10-02 mediante aprobación explícita de la Etapa 3 de Inventario por el responsable del producto. Las etapas posteriores de persistencia y esquema físico fueron aprobadas explícitamente antes de implementar; coordinación integrada localmente en 2.42.0.

## Contexto

Los casos de uso de Inventario están aprobados. Exigen que una venta no se confirme sin descontar mercancía, que dos operadores no vendan la misma última unidad y que reintentar una confirmación no duplique cobro ni stock.

La creación manual de venta vive en `transactions.routes.js`, mientras Finanzas mantiene guard de extras, anulación y cobro de sistema. La unidad de trabajo compartida y repositorios con `ctx.tx` ya existen; su uso no cubre todavía la venta manual y todos sus lectores. El publisher de eventos vigente ofrece certificación no bloqueante; no es una garantía de atomicidad de venta y stock.

## Decisión aceptada

Extraer el registro manual de venta a un caso de uso de Finanzas, conservando invariantes vigentes, y coordinarlo con Inventario mediante `ConfirmPosSale` en la capa de aplicación. Ensamblar contratos en el root de integración existente, sin añadir un bounded context POS.

Ejecutar venta, artículos, asignación de lotes, movimientos, saldos y referencia de recuperación en una única transacción PostgreSQL con exclusión por producto y aislamiento serializable. Añadir claves de operación durables scoped por Tenant, actor y tipo, vinculadas a huella y resultado.

Certificar eventos informativos después de commit con la infraestructura existente y sus garantías reales. La anulación financiera sigue siendo distinta de la devolución de mercancía; un evento `VentaAnulada` nunca aumenta stock por sí solo.

## Opciones consideradas

| Opción | Complejidad | Ventaja | Límite |
| --- | --- | --- | --- |
| Frontend descuenta stock después de cobrar | Baja inicial | Poco wiring | Crash/red produce venta sin salida; navegador puede omitir descuento |
| Evento posterior a venta descuenta stock | Media | Usa infraestructura reactiva | Venta se confirma antes de validar stock; no satisface última unidad ni rollback conjunto |
| Coordinador transaccional con contratos de ambos contextos | Media | Una decisión durable, recuperable y verificable | Requiere propagar `ctx`, controlar locks y migración aditiva para idempotencia |

Se acepta la tercera opción. La plataforma ya usa una transacción compartida para completar cita y registrar cobro/comisión; no se necesita introducir una cola ni base de datos adicional para esta operación.

## Consecuencias

- El dominio de Inventario conserva sus reglas de mercancía; Finanzas conserva dinero, extras, cierre y anulación.
- Las rutas pasan a adaptar comandos y resultados. Los servicios y comisiones mantienen sus reglas.
- La nueva autoridad de precio de producto será una extensión aditiva del resolver existente, sin política paralela en la UI.
- Una clave vieja no recupera permisos viejos. Los resultados se filtran por la autorización vigente.
- Operación y movimiento son la auditoría durable; la notificación externa posterior no se usa para decidir que el stock existe.
- La persistencia de Etapa 4 fue aprobada; [índices y restricciones físicos de Etapa 5](../architecture/inventory-physical-schema.md) fueron aprobados e integrados localmente. No se promete outbox de certificación nuevo ni capacidad de varias bodegas.

Diseño completo y decisiones diferidas: [Inventario — Arquitectura técnica](../architecture/inventory-technical-design.md).
