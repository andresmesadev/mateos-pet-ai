# Nueva venta — cuatro ajustes de presentación

Fecha: 2026-10-03. Alcance aprobado por el responsable: «perfecto acepto eso cambios».

## Diseño y alcance

Se conserva el lenguaje visual del dashboard: tipografía existente, fondo claro, blanco para las superficies, verde para las acciones y el bloque de total en `#1b353b`. La distribución utiliza preparación a la izquierda y resumen/pago a la derecha; en móvil se apilan. Cliente, catálogo y carrito siguen el orden de uso de recepción y caja.

Los cuatro ajustes mejoran la presentación de operaciones ya modeladas y aprobadas en `pos-workspace.md` e Inventario. No introducen un caso de uso de dominio, una nueva regla de cobro ni un esquema físico. La resolución del precio sigue en el servidor y los catálogos respetan los módulos activos.

## Implementación

1. Se retiró el encabezado repetido «Punto de venta». Cliente y catálogo comparten una superficie con separadores y el carrito utiliza filas compactas. Los catálogos permanecen ocultos hasta buscar o pulsar su botón. Se retiró el aviso repetido del selector de servicios.
2. Cliente y mascota aparecen antes del catálogo. La venta de mostrador sigue siendo opcionalmente anónima. El resumen identifica al cliente y mascota seleccionados. Cambiar de mascota no altera precios agregados; una fila cotizada en otro contexto muestra un aviso para revisarla.
3. Un servicio con precio se presenta con nombre, precio unitario, origen, cantidad y subtotal. «Editar artículo» abre descripción y precio; «Listo» cierra una edición válida. Los artículos sin descripción o precio abren la edición directamente. Una tarifa distingue catálogo, mascota, precio ingresado y precio editado.
4. El resumen de pago muestra artículos, cantidades y subtotales. Las indicaciones y la etiqueta de la nota se adaptan a efectivo, transferencia, tarjeta u otro. La referencia sigue guardándose en la nota existente del cobro.

`CheckoutLine.serviceQuote` es metadato opcional de presentación conservado en el borrador del navegador. Se valida al recuperarlo y no se envía en el comando de cobro. Los borradores anteriores siguen siendo válidos; no se atribuye un origen a sus precios sin evidencia.

## Verificación automatizada

```text
node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs
tests 20
pass 20
fail 0
Código de salida: 0

cd frontend
npm run lint
> eslint
Código de salida: 0

npm run build -- --webpack
Compiled successfully in 5.9s
Finished TypeScript in 3.1s
Generating static pages (29/29)
Código de salida: 0

node --check scripts/serve-inventory-ui-local.cjs
Código de salida: 0

git diff --check -- <archivos de esta entrega>
Código de salida: 0
```

Las dos comprobaciones nuevas cubren el origen de la tarifa al editar, equivalencia decimal y conservación/validación de los metadatos del borrador. Las pruebas existentes cubren importes, cantidades, stock, recuperaciones y reintentos.

## Recorrido en navegador

Se ejecutó la compilación local y se utilizó `scripts/serve-inventory-ui-local.cjs --seed-checkout` con un PostgreSQL temporal, backend de prueba en 3002 y frontend de prueba en 3010. Los datos ficticios incluyeron un propietario, dos mascotas, dos servicios y un producto. Las credenciales de prueba existieron exclusivamente en el proceso temporal.

| Comprobación | Resultado observado |
|---|---|
| Orden inicial | Cliente y mascota antes de agregar artículos; catálogos ocultos. |
| Cliente y tarifa | Buscar el propietario mostró sus dos mascotas. Luna mostró baño a COP 55.000 y Toby a COP 75.000 mediante el catálogo del servidor. |
| Editar artículo | Se borró el precio y se escribió `60000` carácter a carácter sin perder el campo; «Listo» devolvió la fila compacta con «Precio editado». |
| Resumen | Cliente, mascota, nombre del artículo, cantidad y subtotal coincidieron con el carrito. |
| Cambiar mascota | Se conservó COP 60.000 y apareció el aviso de revisión de la tarifa de Luna para Toby. |
| Servicio sin tarifa | Se abrió el editor, permitió escribir `35000` completo y volvió a una fila compacta con «Precio ingresado». |
| Transferencia y tarjeta | Se mostraron sus instrucciones y etiquetas de referencia específicas. |
| Recargar | Se recuperaron el propietario, mascota, artículo, precio y medio de pago del borrador. |
| Móvil 390 × 844 | Controles apilados y legibles; ancho del documento 380 frente a viewport 390. Se retiró la emulación al terminar. |
| Efectivo exacto | Para COP 35.000, recibido COP 35.000 y cambio COP 0. |

No se confirmó ningún cobro en este recorrido. El conteo final de la base privada fue `sales=0, products=1, movements=1`. Se cerraron únicamente sus procesos temporales y se retiró su base: `Private UI fixture removed. Remaining private databases: 0`.

Los servidores y los datos principales se conservaron. Commit, push y despliegue de esta entrega siguen pendientes.
