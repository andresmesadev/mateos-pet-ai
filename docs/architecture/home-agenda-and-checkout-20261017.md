# Agenda propia y cobro con carrito — ensayo del 17 de octubre

Requisito del responsable: Agenda de hoy en un espacio propio de ancho completo para sus botones; opción Todos en POS; tarifa de mascota como valor inicial para cobrar, con posibilidad de incluir productos y otros servicios como colorimetría.

## Cinco etapas del ajuste de presentación

1. Función: eliminar la competencia horizontal entre prioridades y Agenda de hoy. Consultar productos y servicios juntos sin cambiar de pestaña.
2. Casos: Agenda ocupa una fila completa, seguida de prioridades; estados rápidos y filtros conservan permisos. Todos muestra ambos catálogos; Productos y Servicios conservan su consulta independiente. Cada catálogo conserva búsqueda, selección y validaciones propias.
3. Arquitectura: cambiar composición de HomeJourney, retirar la medición de altura compartida y añadir Todos al formulario POS. Reutilizar ProductPicker y ServiceCatalog y sus endpoints autenticados; ningún cálculo de precio nuevo en componentes.
4. Persistencia: ninguna modificación de datos, tarifas ni pagos. Se conservan el borrador y el carrito existentes.
5. Esquema y validación: sin migración. Lint, build/TypeScript y recorrido real de navegador para ancho, botones, catálogos y ausencia de desbordamiento en 320/390/768 px.

## Cobro con carrito: decisiones resueltas

El cobro actual de una cita completada conserva una obligación única y una comisión inmutable (ADRs 007, 009 y 024). El catálogo POS ya consulta el resolver y permite usar la tarifa de la mascota como valor inicial al elegir el servicio; los artículos manuales pueden editarse. Crear otra venta independiente para cobrar una atención pendiente duplicaría el ingreso.

El responsable confirmó un solo carrito con servicio/domicilio editables y extras, y comisión sobre el valor final de peluquería. [ADR 025](../decisions/025-carrito-unico-de-cita-y-comision-final.md) concreta las cinco etapas, reconcilia el importe congelado de una obligación impagada y conserva anulación/reemplazo, cierres y liquidaciones.

Decisiones arquitectónicas diferidas: abonos, crédito, impuestos y comisiones de otros servicios independientes quedan fuera de alcance. Se conserva el snapshot original de la atención; el recibo identifica el valor efectivamente cobrado.
