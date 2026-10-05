# Caja del día — verificación local (2026-10-03)

## Alcance aplicado

Presentación del frontend sobre las lecturas y comandos existentes de Finanzas. ADR 007 permanece vigente: confirmar el método de un cobro de sistema conserva su importe y no crea otra venta.

- Una lista operativa de hoy: búsqueda por propietario, mascota, artículo, referencia y usuario; filtros por revisión y medio de pago.
- Resumen por medios confirmados, separando el importe cuyo método sigue por revisar. El efectivo predeterminado del cobro de sistema no se presenta como confirmado.
- Origen (venta POS, servicio de cita o registro anterior), cantidades y operador; acceso al comprobante guardado.
- Resumen administrativo visible solo con `finance`, sin repetir la lista ni el desglose de ingresos de hoy. Fechas anteriores conservan listado y desglose histórico de métodos guardados.
- Selector de fecha, navegación entre días y regreso a hoy. Valida fechas reales y limita la consulta a hoy o fechas anteriores.
- Ingresos, egresos y diferencia con decimales conservados. Cálculo desde la colección completa del endpoint administrativo, evitando sus cabeceras históricas redondeadas a pesos.
- Egresos con categoría, medio, nota y hora. Resumen móvil en dos columnas.

## Evidencia de comandos

`frontend: npm run lint`: salida `> eslint`, código 0, sin diagnósticos.

`node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs`:

```text
tests 23
pass 23
fail 0
```

`backend: npm test -- --runInBand src/__tests__/integration/dashboard-business-access.test.js src/contexts/finance/__tests__/pos/settle-system-charge.usecase.test.js`:

```text
Test Suites: 2 passed, 2 total
Tests:       42 passed, 42 total
```

Incluye rechazo de accesos financieros para personal sin ese permiso y conservación del importe al confirmar el método. El mensaje `Configuration unavailable: offline` es un escenario negativo intencional del test de permisos.

`frontend: npm run build -- --webpack`:

```text
Compiled successfully in 6.2s
Finished TypeScript in 2.9s
Generating static pages (29/29)
```

## Recorrido en navegador y PostgreSQL temporal

Se extendió `scripts/serve-inventory-ui-local.cjs --seed-cash`: base privada con el esquema local y datos ficticios. No copia clientes, mascotas, ventas o egresos del negocio. Las credenciales del test solo existen en su proceso.

1. Cinco movimientos de hoy: efectivo 12.000,30; transferencia 24.000; tarjeta 36.000; otro 6.000; servicio de cita 55.000 por revisar.
2. Filtrar efectivo devuelve un movimiento por 12.000,30 y excluye el servicio sin revisar. `Por revisar` restablece el filtro de medio y muestra el servicio.
3. Confirmar transferencia para el servicio conserva 55.000 y los cinco movimientos actuales. Transferencias pasan a 79.000 y el importe por revisar a cero. Comprobante muestra nota y operador guardados. BD mantiene seis transacciones totales, incluyendo una de ayer.
4. Búsqueda `LUNA baño` devuelve el servicio correcto.
5. Resumen de hoy: ingresos 133.000,30, egresos 10.000,10, diferencia 123.000,20.
6. Día anterior: ingresos 8.000,25, egresos 3.000, diferencia 5.000,25. Lista histórica incluye mascota y propietario. Volver a hoy funciona.
7. Versión final móvil 390 × 844: contenido 380 px; dos columnas de 147,2 px en el resumen de medios. Sin desbordamiento horizontal de página.
8. Sesiones ficticias cerradas, tamaño del navegador restablecido y pestañas de prueba cerradas. Las interrupciones del proceso de herramientas cerraron los servidores temporales pero dejaron sus bases: se verificó su tenant único y los seis cobros/dos egresos antes de eliminar exclusivamente cada base privada. Los servidores del usuario se conservaron.

## Ajustes finales del resumen administrativo

Ampliación de presentación aprobada el mismo día: un único estado vacío de egresos con **Registrar egreso**, título **Diferencia del día**, fecha con capitalización natural y explicación desplegable del cálculo. Los gastos se filtran por categoría y medio de pago; sus notas se despliegan por fila. El resumen de categorías solo aparece cuando existen egresos en la fecha.

Verificación adicional sobre una base privada con dos egresos actuales (Insumos/Efectivo: 10.000,10; Nómina/Transferencia: 5.000) y uno de ayer:

- Insumos + Efectivo devuelve un egreso de 10.000,10. Insumos + Transferencia devuelve cero y ofrece limpiar filtros. Los totales administrativos permanecen en ingresos 133.000,30, egresos 15.000,10 y diferencia 118.000,20.
- Limpiar filtros devuelve las dos filas. **Ver nota** muestra `Comprobante de prueba`. Cambiar al día anterior restablece filtros y muestra su egreso de 3.000.
- El 1 de octubre sin gastos muestra un único enlace **Registrar egreso** dentro del bloque y ningún panel vacío de categorías.
- Móvil 390 × 844: ancho de documento 380 px, bloque de egresos 306,4 px; sin desbordamiento horizontal. Filtros, acción y nota abierta visibles.
- Sesión ficticia cerrada, viewport restablecido, pestaña cerrada. `stop` del servidor de prueba terminó con código 0 y `Private UI fixture removed.`; los servidores del usuario no se modificaron.

Comandos ejecutados otra vez: `npm run lint` código 0; suite de POS **23 pruebas, 23 aprobadas, 0 fallos**; `node --check scripts/serve-inventory-ui-local.cjs` código 0. Build final: `Compiled successfully in 4.1s`, TypeScript 2,7 s, 29/29 páginas generadas, código 0. No cambian contratos, permisos, cobros ni esquema de base de datos.

## Límites y publicación del conjunto

### Consistencia de botones solicitada

**Consultar** usa `Button` primario con icono de búsqueda; **Día anterior**, **Día siguiente** y **Volver a hoy** usan `Button` secundario con `asChild` sobre sus enlaces y los iconos correspondientes. Se alinean al pie del campo de fecha. Navegación etiquetada como **Cambiar fecha del resumen**. Se conservan el formulario GET, las fechas y la selección del establecimiento.

Comprobación adicional: ambos botones principales de fecha miden 40 px y comparten el mismo borde inferior en escritorio. Día anterior, Volver a hoy y Consultar al 2 de octubre funcionan. En móvil de 390 px, documento de 380 px sin desbordamiento. Cuenta ficticia cerrada y viewport restablecido; base privada eliminada mediante `stop`. Lint código 0; suite POS 23 aprobadas/0 fallos; build código 0 (`Compiled successfully in 5.1s`, TypeScript 2,8 s, 29/29 páginas).

### Límites vigentes

La lista operativa conserva el límite existente de 200 movimientos, indicado en pantalla. Sus filtros, conteos y sumas corresponden a esa lista; el resumen administrativo usa la colección completa. Las cifras históricas por método son métodos guardados y pueden incluir valores predeterminados; no certifican una conciliación bancaria. La diferencia del día considera todos los medios, no representa efectivo físico ni utilidad. No se incorpora apertura de turnos, arqueo físico ni pagos mixtos en este ajuste.

Estado: implementado y comprobado localmente. Backend 3000 y frontend 3001 devolvieron HTTP 200. Commit, push y despliegue quedan para después por instrucción del usuario. No se crea tag ni cierre oficial de versión; se evaluará el versionado antes de publicar el conjunto pendiente.
