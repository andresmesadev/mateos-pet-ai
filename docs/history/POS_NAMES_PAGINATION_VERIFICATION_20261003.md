# Punto de venta — nombres y detalle paginado

Fecha: 2026-10-03. Cambios locales; publicación pendiente de la próxima solicitud de commit, push y despliegue.

## Resultado

Navegación, encabezado, migas, acceso rápido y enlaces de cobro usan Punto de venta. Pestañas: Cobrar, Caja diaria, Gastos, Historial de cobros y Reportes. Acciones y mensajes de registro de gastos usan el mismo vocabulario.

Los historiales consultan páginas en servidor y buscan en todo el período. Totales activos y conteos corresponden al conjunto filtrado completo. Orden por fecha descendente e id descendente; búsqueda sin tildes con comodines tratados como texto literal. Parámetros repetidos/incorrectos devuelven 400; operadores conservan la lectura exclusivamente del día actual. El establecimiento autenticado delimita conteo, suma, búsqueda y filas. Los consumidores anteriores conservan su contrato de arreglo.

## Evidencia automatizada

```text
npm run lint (frontend)
exit_code: 0 — sin diagnósticos

node --test scripts/financial-history-page.test.cjs scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs scripts/pos-expense.test.cjs scripts/pos-history.test.cjs scripts/pos-reports.test.cjs
tests 49; pass 49; fail 0

npm test -- --runInBand src/__tests__/integration/dashboard-history-pages.test.js src/__tests__/integration/dashboard-reports.test.js src/__tests__/integration/dashboard-expenses.test.js src/contexts/finance/__tests__/pos/void-manual-sale.usecase.test.js (backend)
Test Suites: 4 passed, 4 total
Tests: 43 passed, 43 total

npm run build -- --webpack (frontend, repetido tras unificar mensajes)
Compiled successfully in 9.2s
Finished TypeScript in 4.4s
Generating static pages (29/29)
exit_code: 0

node --check: financial-history-page.js, transactions.routes.js, expenses.routes.js, serve-inventory-ui-local.cjs
exit_code: 0
```

## PostgreSQL real y recorrido de interfaz

Base desechable `mateos_inventory_check_3d20d8922e69`, backend privado 3002 y frontend privado 3010. Ejecutado con `--seed-reports --seed-comparison --seed-pagination`. Datos reales del aplicativo sin alteraciones.

El recorrido verificó:

- Lectura del día: 228 cobros, 23 páginas, total activo 133406.94; 510 gastos, 51 páginas, total activo 15146.84. Conteos y sumas contrastados con agregación independiente en PostgreSQL.
- Última página real, recuperación del registro más antiguo, búsqueda sin tildes, búsqueda literal de `%_`, vacío confirmado, exclusión de anulados y aislamiento ante un segundo tenant de prueba con importes 99999.
- Período mensual en interfaz: 229 cobros (227 activos), importe activo $141.407,19. Última página 221–229. Gastos activos: 509 registros, $18.146,84, última página 501–509.
- Los importes anteriores coinciden con las tarjetas de Reportes. Los enlaces conservan fechas, selección y vuelta a Reportes. Cobros por revisar: un cobro de $55.000 con método sin confirmar.
- Búsquedas `balsamo unico 50%_` y `cafe unico 50%_` encuentran el registro antiguo correcto y vuelven a página 1.
- Selector de 50 filas: 1–50 de 229, página 1 de 5.
- Fallo HTTP 503 provocado: se ocultan datos y totales anteriores, aparece el error y el botón para reintentar. La recuperación restituye el resumen confirmado.
- Anulación de una venta ficticia de $1,29 desde filtro de activos: se vuelve a leer la página y el resumen; resultado confirmado sin operaciones y total 0. Antecedente conservado.
- Móvil 390×844: ancho del documento 380, sin desbordamiento horizontal de página. Navegación desplazable conserva las cinco pestañas. Vista de escritorio restaurada.
- Sesión privada cerrada, pestaña cerrada y proceso/base temporal retirados: `Private UI fixture removed.`

## Límites y versionado

Los límites de los consumidores antiguos permanecen para compatibilidad; las nuevas listas paginadas no usan esos límites. No hay cambios de esquema ni reglas monetarias. El versionado se evaluó como parte del paquete POS/Inventario todavía pendiente de publicación; no se crea un tag ni se declara un nuevo cierre oficial en esta tarea.
