# ADR 031 — Cobrar vacunación por productos, sin cargo fijo impuesto

24/10/2026. Solicitud del responsable: Vacunación organiza la cita; el precio
depende de la vacuna elegida en Inventario. No imponer una línea inamovible de
Vacunación ni obligar al equipo a asignarle cero para poder cobrar productos.

## Cinco etapas y reconciliación

1. **Función.** Peluquería mantiene su componente principal obligatorio. Fuera de
   esa área, Caja permite conservar, editar o retirar el cargo principal de la
   cita y cobrar únicamente artículos elegidos. Una tarifa conocida positiva se
   propone; una tarifa ausente/cero no inserta automáticamente una línea vacía.
   El equipo puede agregar explícitamente un cargo por el servicio si aplica.
   No se usan nombres de productos/servicios para decidir la regla.
2. **Casos.** Vacunación con vacuna de inventario, vacuna más otros productos,
   aplicación cobrada por separado y consulta con tarifa propuesta editable.
   El cobro requiere al menos un artículo real y válido. No se permite retirar
   el componente obligatorio de peluquería ni añadirle transporte a otra área.
   Los comprobantes confirmados siguen siendo registros históricos de solo
   lectura; esta corrección no anula ni cambia pagos existentes.
3. **Arquitectura.** El adaptador de checkout deriva la obligatoriedad desde la
   categoría real del servicio mediante el clasificador del resolver central.
   El servidor vuelve a consultar la cita bajo el lock existente; ignora flags
   de obligatoriedad del navegador. Se reutilizan el workflow POS, referencias,
   operación idempotente, validación de catálogo y movimientos de inventario.
   Comisión principal solo existe si se cobra esa línea. Las comisiones de
   adicionales siguen sus reglas individuales del ADR 029.
4. **Persistencia.** Una Transaction de cita y sus artículos elegidos; no se
   crea una segunda venta. Cuando una cita diferida se paga sin cargo principal,
   finalPrice registra cero como **ausencia explícita de cargo separado** al
   confirmar los artículos, nunca como sustituto automático de precio al
   completar. Los productos no pasan a ser base de comisión del servicio.
   Si existía una comisión principal, retirarla durante checkout usa anulación
   sin reemplazo del ADR 009, en la misma transacción, con gates de cierre y
   liquidación. Todos los importes históricos se conservan.
5. **Esquema y verificación.** Sin migración. Probar productos solos, cantidad,
   tarifa propuesta, cero, edición/retiro del componente opcional, peluquería
   obligatoria, flags falsificados, otra cita/Tenant, pago repetido, stock y
   comisión; ejecutar lint/build/tests. Los borradores inciertos se conservan
   sin reescribir su petición de pago. Versión y publicación se evalúan al
   autorizar el siguiente despliegue.

Amplía ADRs 025/030 únicamente en la obligatoriedad del componente principal
fuera de peluquería. Conserva el cierre contable, la confirmación de pago y la
inmutabilidad de comisiones; no modifica citas o cobros reales para probarlo.
