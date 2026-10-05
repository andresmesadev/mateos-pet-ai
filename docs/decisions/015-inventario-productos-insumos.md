# ADR 015 — Incorporar Inventario de productos e insumos

Fecha: 2026-10-02.

Estado: aceptado e implementado localmente en 2.42.0. Las cinco etapas se aprobaron explícitamente antes de integrar código y migración. Ver [informe de implementación](../history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md). Publicación y VPS pendientes.

## Contexto y evidencia

`domain-model-v1.md` enumera `InventoryItem` como capacidad operativa diferida. Perfiles y módulos, aprobado el 2026-10-01, habilita Pet shop mediante ventas manuales por descripción/cantidad/precio, y excluye expresamente catálogo e inventario. `pos-workspace.md` conserva esa exclusión para la mejora de interfaz.

El responsable del producto ahora pide inventario para productos vendidos, incluidos medicamentos y artículos de Pet shop, y acepta catálogo, existencias, lotes/vencimientos, integración con POS y permisos. Existe un requerimiento funcional explícito para evolucionar la capacidad previamente diferida. No se interpreta como inventario ya construido ni como defecto en el cierre anterior.

## Decisión de alcance

- Incorporar conceptualmente Inventario al Dominio Operativo por Establecimiento. Producto, Lote y Movimiento de Inventario expresan mercancía y sus hechos físicos; no son una segunda entidad Servicio ni una prescripción.
- Documentar la Etapa 1 aceptada y someter los casos de uso concretos de Etapa 2 a aprobación explícita en `docs/architecture/inventory-workspace.md`. Esa aprobación se recibió el 2026-10-02 mediante «acepto empieza»; se preparó la Etapa 3 sin avanzar aún a persistencia.
- Seguir después las etapas de arquitectura técnica, persistencia y esquema físico antes de implementar. No crear ni reabrir una fase cerrada para registrar este trabajo solicitado.
- Conservar Tenant como única unidad de aislamiento, resolución central de precios, comisiones inmutables y restricciones financieras vigentes. La incorporación de stock no autoriza reescribir cobros o cierres.

## Alternativas evaluadas

1. **Mantener solo productos manuales:** conserva la capacidad actual pero no resuelve existencias, trazabilidad ni vencimientos solicitados.
2. **Añadir un contador de stock a Servicios o a la pantalla POS:** confunde servicios e insumos y sitúa las reglas físicas en el canal. No satisface la soberanía del dominio ni las necesidades de consumo sin venta.
3. **Diseñar Inventario operativo y coordinarlo con Finanzas:** opción elegida para el alcance base; sus contratos, transacciones y autorizaciones se decidirán en las siguientes etapas.

## Consecuencias y límites

La actualización conceptual precedió a la implementación. Con las cinco aprobaciones recibidas, Inventario amplía el alcance histórico de Perfiles y módulos y del POS mediante catálogo, stock y consumo por área. Venta, consumo, anulación económica y devolución física tienen significados diferentes y deben mantener su trazabilidad.

Las reglas detalladas de lotes, unidades, devolución y acceso de profesionales quedaron aprobadas en la Etapa 2. La arquitectura que las implementará se aprobó por separado en la Etapa 3 y el ADR 016; este ADR de alcance no sustituye su diseño técnico. La Etapa 4 se preparó para aprobación antes de esquema físico. La sección de decisiones diferidas del documento de diseño delimita capacidades que no se han aceptado para esta entrega.
