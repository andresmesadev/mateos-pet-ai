# Verificación del espacio POS — 2026-10-02

## Alcance implementado

Mejora frontend de Caja y ventas sobre los comandos existentes. Diseño en `docs/architecture/pos-workspace.md`.

- Cliente y mascota opcionales, búsqueda cancelable y navegación del autocompletado con teclado.
- Carrito con renglones etiquetados, tipo de artículo según módulos, cantidad, precio COP, subtotal y total. Validación de todos los renglones y límites monetarios; no se omiten artículos incompletos.
- Pago con cuatro métodos existentes, cálculo de efectivo/cambio y bloqueo de doble envío concurrente. Un resultado de red incierto pide consultar Caja antes de repetir la operación.
- Confirmación persistida que permanece en pantalla, nueva venta y comprobante interno imprimible. Efectivo recibido/cambio se muestran en la sesión original; no se inventan para transacciones históricas.
- Búsqueda y filtros de movimientos de hoy; revisión de método de pago de citas para recepción y administrador. Conserva el importe y la misma transacción del servicio.
- Resumen financiero por fecha, egresos, historial y reportes conservan su restricción administrativa. Los enlaces del resumen por fecha conservan el establecimiento seleccionado.

## Evidencia de comandos

```text
npm run lint  (frontend)
> frontend@0.1.0 lint
> eslint
exit_code: 0; sin errores ni advertencias

npm run build  (frontend)
Compiled successfully
Finished TypeScript
Generating static pages (28/28)
exit_code: 0

node --test scripts/pos-checkout.test.cjs scripts/contact-profile-utils.test.cjs scripts/contact-navigation.test.cjs scripts/whatsapp-workspace.test.cjs
tests 20; pass 20; fail 0

npm test -- --runInBand src/contexts/finance/__tests__/pos  (backend)
Test Suites: 3 passed, 3 total
Tests: 18 passed, 18 total

node scripts/verify-pos-local.cjs --verify
PASS: persisted sale totals/items/actor; receipt read; administrator settlement;
unchanged system amount/count; operational review updated; receptionist financial privacy

node scripts/verify-pos-local.cjs --cleanup
Disposable local POS fixtures removed
```

## Recorrido real y revisión visual

Docker local únicamente, base `mateos_dev`, cuentas sintéticas de recepción y administrador. El verificador rechaza bases que no sean locales y se limita al Tenant local configurado.

Se comprobó en navegador: impedir el cobro con segundo renglón incompleto; buscar propietario; seleccionar mascota; registrar un cobro de 55.000 COP con 100.000 recibidos y 45.000 de cambio; abrir el comprobante y verificar identidad del operador, ítems, propietario y mascota; consultar el movimiento en Caja; filtrar por mascota y pagos por revisar; bloquear la confirmación de efectivo vacío y confirmar el servicio de 42.000 con 50.000 recibidos y 8.000 de cambio. La prueba HTTP confirma que la revisión no crea una transacción adicional ni modifica su importe.

Recepción muestra solo Nueva venta y Caja del día. Administrador muestra además Egreso, Historial, Reportes y Resumen financiero por fecha. Sin errores de consola durante el recorrido observado.

Revisión a 375 px: campos etiquetados y sin desbordamiento horizontal (ancho del documento 365 px). A 1440 px: columnas de carrito y pago de 729,6 px y 360 px; documento de 1430 px, sin desbordamiento. La dimensión temporal del navegador se restableció al finalizar.

Las cuentas, cliente, mascota, cita, servicio y ventas sintéticas se retiraron; la limpieza comprueba que no queden estas entidades de prueba. No se cambiaron módulos ni cuentas reales, ni se enviaron mensajes o procesaron pagos bancarios. La impresión física no se verificó: se comprobó la vista del comprobante y su botón de impresión.

## Entrega y versionado

Verificada localmente. Sin cambios de schema ni migraciones; la ampliación incorpora dos lecturas del adaptador backend y sus permisos, sin cambiar las reglas del dominio. Esta mejora no está publicada todavía en GitHub/VPS. Por incorporar capacidades funcionales, se recomienda una versión menor al preparar su publicación; no se crea tag ni se altera la versión publicada 2.41.0 en esta tarea local.

## Ampliación: cuatro ajustes aceptados

- Catálogo de servicios activos con búsqueda, filtro por módulos y precio sugerido resuelto exclusivamente por `price-resolver.service.js`. Puede usar tarifa acordada por mascota, tarifa general de peluquería o precio base; el operador revisa el valor antes de cobrar. Cambiar de mascota refresca el catálogo; no modifica retroactivamente los renglones ya preparados.
- Preparación en `sessionStorage`, separada por actor, versión de credencial y establecimiento efectivo; recuperación después de cambiar pestañas del POS o recargar. Expiración de 12 horas para preparaciones normales; un envío incierto permanece bloqueado para revisión. Éxito y cierre de sesión limpian los borradores.
- Historial con rango de fechas, búsqueda por propietario/mascota/teléfono/referencia/descripción, método de pago y estado. Comprobante recuperado de la transacción guardada, incluidas las anulaciones. La lista informa su límite de 200 operaciones; el resumen financiero mensual se mantiene aparte, plegable.
- Anulación de venta manual desde administración con motivo obligatorio. Usa el comando existente; los cobros de sistema, las ventas anuladas y los días con cierre oficial conservan sus protecciones. No procesa devoluciones bancarias.
- Nueva venta, Caja del día e Historial recibieron cambios. Egreso y Reportes conservan su interfaz previa y sus restricciones; no se declaran rediseñados.

### Evidencia final de esta ampliación

```text
npm run lint (frontend)
> eslint
exit_code: 0

npm run build (frontend)
Compiled successfully in 1178ms
Finished TypeScript in 2.8s
Generating static pages (28/28)
exit_code: 0

node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs
tests 12; pass 12; fail 0

npm test -- --runInBand src/__tests__/integration/dashboard-pos-catalog.test.js src/__tests__/integration/dashboard-business-access.test.js src/contexts/finance/__tests__/pos
Test Suites: 5 passed, 5 total
Tests: 62 passed, 62 total

node scripts/verify-pos-local.cjs --verify
PASS: authenticated draft contexts; resolved catalogue price;
receptionist void denied; administrator void retained original amount/items/reason;
system charge protected; void excluded from operational income

node scripts/verify-pos-local.cjs --cleanup
Disposable local POS fixtures removed

node --check backend/src/routes/dashboard/access.routes.js
node --check backend/src/middleware/allowVeterinaryDashboard.js
git diff --check
exit_code: 0
```

Recorrido en navegador, con cuentas y datos ficticios exclusivamente locales: agregar servicio de catálogo a 42.000 COP, elegir propietario/mascota, ingresar nota y 50.000 recibidos, navegar a Historial y volver, recuperar campos/cambio de 8.000, recargar y guardar. Venta de prueba `cmur94ud000066ohzjq7v9t0z` localizada por mascota y efectivo, anulada desde el formulario con motivo obligatorio. El comprobante mostró `VENTA ANULADA`, fecha, motivo, artículos y precio original; no mostró efectivo recibido/cambio histórico inventado. También se verificó consulta del rango 2026-10-02 a 2026-10-02, filtro por anuladas, y una nueva venta vacía después del cobro. Consola sin errores. A 375 px, documento de 365 px y campos legibles sin desbordamiento horizontal de página. Dimensión temporal restablecida y sesión de prueba cerrada. Las entidades ficticias fueron retiradas; impresión física no verificada.
