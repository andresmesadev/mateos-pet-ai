# Nueva venta: mejora de la operación con inventario

Fecha: 2026-10-02. Alcance: los cuatro ajustes de Nueva venta aceptados por el responsable del producto, sobre el inventario local ya implementado. Este documento complementa el cierre de Inventario; no sustituye sus pruebas ni certifica un despliegue nuevo en producción.

## Cambios

1. Catálogo visible al comenzar: productos y servicios según los módulos y permisos del establecimiento. Los productos muestran nombre, presentación, código, precio y disponibilidad consultada. El ingreso manual queda como opción secundaria y los productos manuales indican que no descuentan inventario.
2. Carrito compacto con cantidades ajustables. Seleccionar o escanear otra vez el mismo SKU, con el mismo precio y versión, suma unidades en la misma fila. El escáner puede enviar Enter antes de terminar la búsqueda; la selección pendiente conserva el código completo, incluidos ceros iniciales.
3. Avisos por producto para existencias insuficientes, desactivación o cambios de precio. Antes de un primer cobro se vuelve a consultar el catálogo. Un precio cambiado requiere actualización explícita y revisión del total; el carrito se conserva. El servidor mantiene la validación atómica definitiva.
4. Efectivo exacto, importes rápidos y cambio visible. F2 lleva a buscar, F4 al pago y F8 al botón de confirmación. F8 no registra el cobro; Enter en los campos tampoco lo registra.

## Reglas conservadas

- Las peticiones autenticadas del navegador usan `proxyUrl`.
- No hay tablas, columnas ni migraciones nuevas para estos cuatro ajustes.
- Los precios por mascota y los servicios siguen consultando el catálogo existente y su resolución de precios.
- Los reintentos de una venta incierta conservan la clave y el contenido originales. No se valida otra vez el stock descontado por una venta que ya pudo haberse confirmado.
- Los módulos y permisos deciden qué catálogo se ofrece; esta mejora no activa Pet shop en el establecimiento principal.
- El borrador sigue aislado por contexto y cuenta, con recuperación durable para un cobro incierto.

## Evidencia automatizada

Comandos ejecutados:

```text
node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs
tests 18
pass 18
fail 0
cancelled 0
skipped 0
todo 0
exit 0

cd frontend
npm run lint
> frontend@0.1.0 lint
> eslint
exit 0

npm run build
> frontend@0.1.0 build
> next build
Compiled successfully
Finished TypeScript
Generating static pages (29/29)
exit 0

node --check scripts/serve-inventory-ui-local.cjs
exit 0

git diff --check
exit 0
```

Las pruebas nuevas verifican la fusión de SKU sin cambiar su precio, rechazo de cantidades inválidas o desbordadas y avisos de stock agregado/precio/desactivación. Las pruebas existentes verifican importes, límites, efectivo, borradores, reintentos y filtros de historial. No se presentan como ejecutadas de nuevo las pruebas de backend registradas en el cierre de Inventario.

## Recorrido real en navegador

Entorno: Chrome, frontend compilado en localhost:3010 y adaptador del dashboard en localhost:3002. PostgreSQL temporal con un establecimiento independiente y cinco unidades de un champú ficticio. Se copió únicamente el esquema y la configuración global de tipos de evento. No se copiaron clientes, ventas ni existencias del establecimiento principal.

| Comprobación | Resultado observado |
|---|---|
| Catálogo al entrar | Champú, presentación Frasco 250 ml, código QA-POS, cinco unidades y precio COP 12.000 visibles. |
| Escaneo `00123456789` + Enter antes de terminar la consulta | El producto se agregó y la búsqueda volvió a quedar disponible. |
| Segundo escaneo del mismo código | Una sola fila con cantidad dos. |
| Botones de cantidad | Subir a tres y volver a dos sin crear filas adicionales. |
| Pedir seis unidades teniendo cinco | Aviso en la fila; no se registró un cobro y se conservó el carrito. |
| F2 / F4 / F8 | Foco en búsqueda / efectivo / Confirmar cobro, respectivamente. Enter en efectivo no envió la venta. |
| Cambio del precio a COP 15.000 por otro comando del catálogo | Se bloqueó el precio anterior. La actualización explícita modificó el precio, total y cambio; el selector también mostró el precio nuevo. |
| Producto desactivado durante la preparación | Aviso por producto y carrito conservado sin cobro. |
| Respuesta perdida después de confirmar la venta | La interfaz conservó la clave y bloqueó cambios. Tras recargar, Reintentar misma venta recuperó el resultado confirmado. |
| Venta recuperada | Dos unidades a COP 15.000, total COP 30.000, efectivo COP 50.000 y cambio COP 20.000. Comprobante con la misma referencia recuperada. |
| Inventario después de recuperar | Tres unidades disponibles y físicas. |
| Conteo privado al cerrar el primer recorrido | `products=1, movements=2, sales=1, returns=0`: una entrada y una salida, sin venta duplicada. |
| Segunda fixture, con la compilación actualizada | Cambio de precio coherente entre selector y carrito; efectivo exacto con cambio cero. No se confirmó ninguna venta. |
| Pantalla 390 × 844 | Carrito y pago apilados, controles legibles; ancho del documento 380 frente a viewport de 390, sin desbordamiento horizontal. Se retiró la emulación al terminar. |
| Servidor principal localhost:3001 | Nueva venta visible con catálogo de servicios y los controles nuevos. El establecimiento principal no tiene Pet shop habilitado. |

Se corrigió también el cierre del banco de pruebas: su pool de PostgreSQL ahora tiene propietario explícito y se cierra antes de retirar la base temporal. El segundo cierre terminó con `Private UI fixture removed.` y exit 0. La consulta final a `pg_database` no devolvió bases con el prefijo `mateos_inventory_check_`.

## Estado de entrega

Implementado y verificado localmente. Los cambios permanecen en el árbol de trabajo junto al entregable de Inventario. Commit, push y despliegue de esta entrega están pendientes.

## Corrección posterior: catálogos bajo demanda

El mismo 2026-10-02 el responsable pidió ocultar los listados automáticos. Esta solicitud reemplaza la presentación inicial descrita en el punto 1: ahora aparecen al escribir una búsqueda o pulsar **Ver servicios** / **Ver catálogo de productos**. Borrar la búsqueda, ocultar o agregar un artículo despeja los resultados. Se mantiene el buscador visible y el comportamiento del selector de insumos fuera del POS.

Verificación de esta corrección:

- En localhost:3001 no había filas de servicio al abrir. **Ver servicios** mostró el catálogo; **Ocultar servicios** lo cerró. Buscar `consulta` mostró Consulta veterinaria; borrar la búsqueda dejó cero filas.
- En una nueva fixture compilada de localhost:3010 no había listbox de productos al abrir. **Ver catálogo de productos** mostró el champú ficticio; **Ocultar catálogo** lo cerró.
- Escanear `00123456789` y enviar Enter antes de terminar la consulta agregó una unidad. Después la búsqueda quedó limpia, el listbox ausente y el botón volvió a decir **Ver catálogo de productos**.
- Se ejecutaron de nuevo lint, compilación de frontend y las 18 pruebas de checkout/borrador/historial: exit 0, 18 aprobadas y cero fallos.

La comprobación no registró cobros ni modificó el catálogo del establecimiento principal.
