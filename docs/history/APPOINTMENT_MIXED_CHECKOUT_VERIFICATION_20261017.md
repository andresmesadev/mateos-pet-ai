# Carrito único de atención — verificación local

17 de octubre de 2026. El responsable confirmó valores editables en un solo carrito/pago y comisión sobre el valor final de peluquería. [ADR 025](../decisions/025-carrito-unico-de-cita-y-comision-final.md) completa las cinco etapas y reconcilia únicamente el importe de la obligación todavía impagada.

## Comportamiento implementado

- Registrar pago desde Agenda, detalle, peluquería o Caja abre el carrito de esa cita con propietario/mascota y servicio/domicilio propuestos. Los valores se pueden editar; la tarifa habitual de la mascota no cambia. Productos y servicios adicionales comparten ese carrito y pago. Todos conserva ambos catálogos; los adicionales utilizan su propio precio base o acuerdo explícito, sin heredar por defecto la tarifa principal de peluquería.
- Confirmar liquida la misma Transaction pendiente: un id, fecha real, operador, importe y recibo final. Productos se validan contra su precio y stock actuales; inventario, obligación y corrección de comisión se confirman o revierten juntos. La operación recuperable conserva la huella del contenido y su resultado.
- Solo el valor final de la línea principal de peluquería entra en su comisión. Cambiarlo invoca el comando existente del ADR 009: anula la comisión anterior, conserva todos sus importes y crea un reemplazo enlazado. Domicilio, productos y servicios independientes no participan. La comisión sin cambio se conserva. Cierres y liquidaciones bloquean una corrección consolidada, con mensaje explícito y sin cobrar parcialmente.
- La generación de liquidaciones y corrección de checkout comparten gate por profesional y transacciones serializables. Los eventos se publican después del commit. La Agenda muestra Cobrado con el total confirmado, incluidos adicionales; el valor previo sigue siendo referencia antes de cobrar.
- Un borrador separado por cita conserva su preparación. La respuesta perdida se recupera por la misma clave sin duplicar pago, comisión o movimiento. Una segunda clave no permite pagar de nuevo una atención confirmada. Los pagos históricos siguen disponibles para revisión/comprobante, sin reclasificación.

## Evidencia real

```text
Backend Jest: Test Suites: 201 passed, 201 total
Backend Jest: Tests: 1645 passed, 1645 total
Backend Jest: Time: 37.584 s
Frontend ESLint de los archivos modificados: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs
  tests 24; pass 24; fail 0
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 25 passed, 0 failed
Prisma generate y migrate deploy local: correctos; 57 migraciones aplicadas
Base temporal desde cero: 57 migraciones correctas; sin diferencias con Prisma
git diff --check: exit_code 0
```

El recorrido real Chrome/NextAuth/proxy/PostgreSQL terminó una atención que dejó obligación de 103.000 COP y comisión original de 47.500. Desde su icono se precargaron 95.000 de peluquería y 8.000 de domicilio. Se editaron a 100.000 y 12.000; se agregaron colorimetría de 15.000 y champú de catálogo de 12.000. Tras recargar, las cuatro líneas seguían conservadas. Confirmó un único pago de 139.000, una salida de stock de una unidad y comisión activa de 50.000 sobre 100.000. La comisión original quedó anulada sin alterar su precio de 95.000; la tarifa habitual de la mascota siguió en 95.000.

La prueba interrumpió la respuesta después del commit: Consultar resultado recuperó el recibo original. Repetir la clave devolvió el mismo pago; otra clave fue rechazada. También verificó dos confirmaciones simultáneas con una salida de stock y una comisión activa, y ausencia de cobro/cambio de comisión/stock ante falta de existencias, otro propietario, liquidación vigente o día de prestación cerrado.

La carrera real entre checkout y generación de liquidación certificó que, si se cobra con la base nueva, la liquidación usa esa comisión corregida; si se consolida primero la base anterior, se bloquea la corrección y el pago revierte. Agenda mostró Cobrado: 139.000. Se conservaron pruebas de importación, dirección, estados rápidos, Todos, scroll y tamaños móviles. Captura privada del carrito revisada: `.cache/onboarding-verification/18-appointment-mixed-cart.png`.

## Migración y alcance

`20261017203000_appointment_checkout_components` añade `TransactionItem.appointmentComponent` opcional, su restricción de forma y unicidad parcial. La primera prueba PostgreSQL detectó que reutilizar `priceSourceSnapshot` violaba `inventory_item_shape`; se corrigió el diseño antes del cierre, conservando íntegra esa protección de catálogo. La columna nueva no modifica filas anteriores. Migración aplicada solo a `127.0.0.1:5433/mateos_dev` y a la base temporal.

El contenedor de prueba fue eliminado. No se importaron o modificaron clientes reales, ni se registraron pagos reales o enviaron mensajes externos. El aviso preexistente del reactor de automatizaciones descrito en la [verificación de pago pendiente](APPOINTMENT_PENDING_PAYMENT_VERIFICATION_20261017.md) sigue fuera de alcance; esta entrega no certifica reactivación de WhatsApp o automatizaciones.

Sin commit, push, tag ni despliegue. Producción y versión declarada siguen en 2.49.0; el lote funcional corresponde a versión menor candidata 2.50.0 al publicarse. Hay cuatro migraciones locales pendientes de publicación, incluidas las tres de transporte/pago anteriores. No se declara apertura de beta.
