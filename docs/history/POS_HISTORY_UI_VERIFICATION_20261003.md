# Historial de Caja y ventas — verificación local (2026-10-03)

## Alcance aplicado

Los cuatro ajustes aceptados son presentación e interacción sobre lecturas y comandos existentes de Finanzas e Inventario. Diseño registrado en `docs/architecture/pos-workspace.md`. Sin entidades, migraciones ni políticas financieras nuevas.

1. Periodos Hoy, Ayer, Últimos 7 días y Este mes; fechas reales, rango ordenado hasta hoy; búsqueda combinada por propietario, mascota, teléfono, artículo, referencia y quien registró. Filtros de origen, estado y método, incluyendo Por revisar.
2. Lista compacta con detalle desplegable, comprobantes y páginas locales de diez operaciones. Se conserva el límite existente de 200 registros por consulta; se muestra advertencia al alcanzar ese límite.
3. Resumen exacto del conjunto filtrado, incluidas todas sus páginas: importe activo, operaciones activas y anuladas. Se retiró el resumen mensual independiente de Historial. El análisis financiero tiene su sección Reportes.
4. Motivo obligatorio para anular; confirmación visible con fecha y motivo guardados; comprobación por GET cuando la respuesta sea incierta; distinción entre anulación financiera y recepción de mercancía, mostrando líneas pendientes y recibidas.

El cobro de una cita completada continúa siendo ingreso conforme al ADR 007. Un cobro de sistema sin operador registrado muestra método Por revisar, incluso si el campo almacenado tiene efectivo predeterminado. Su revisión sigue en Caja del día y no crea otra venta.

## Evidencia de comandos

`node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs scripts/pos-expense.test.cjs scripts/pos-history.test.cjs`:

```text
tests 37
pass 37
fail 0
```

Las siete pruebas nuevas cubren periodos inclusivos y cambios de mes/año, fechas iniciales válidas, búsqueda por operador y origen, métodos pendientes de revisión, suma exacta en centavos, mercancía pendiente y respuestas malformadas.

`backend: npm test -- --runInBand src/contexts/finance/__tests__/pos/void-manual-sale.usecase.test.js`:

```text
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

`frontend: npm run lint`:

```text
> frontend@0.1.0 lint
> eslint
exit 0, sin diagnósticos
```

`frontend: npm run build -- --webpack`:

```text
Compiled successfully in 5.2s
Finished TypeScript in 3.1s
Generating static pages (29/29)
exit 0
```

`git diff --check`: exit 0. Git emitió avisos de normalización LF/CRLF sobre archivos de trabajo; sin errores de espacios.

## Recorrido del navegador

Se usó el navegador interno en segundo plano, backend privado 3002 y frontend privado 3010. `scripts/serve-inventory-ui-local.cjs --seed-history` crea una base temporal con esquema local y datos ficticios propios; no copia clientes, ventas, mascotas ni saldos reales. Dos ejecuciones temporales finalizadas y eliminadas con `stop`.

| Comprobación | Resultado observado |
|---|---|
| Mes inicial, 18 registros | 17 activos, 1 anulado, importe activo $141.136,29 |
| Paginación | Primera página 10 filas; segunda 8; indicador 11–18 de 18 |
| Ayer | 1 operación, $8.000,25; nueva consulta vuelve a página 1 |
| Búsqueda `maria luna historial` | 6 filas, 5 activas y 1 anulada; importe $61,70 |
| Origen cobro de cita | Una operación, $55.000, método Por revisar |
| Cobro de cita + efectivo confirmado | Sin resultados; no presenta efectivo predeterminado como confirmado |
| Comprobante de cita pendiente | Comprobante de operación; método Por revisar en Caja del día |
| Fecha Desde posterior a Hasta/hoy | Aviso de fechas inválidas; conserva la consulta anterior |
| Anulación sin motivo | Bloqueada con Escribe el motivo de la anulación |
| Respuesta perdida después de anular | No repite POST; habilita Comprobar anulación |
| Cerrar y reabrir una anulación incierta | Conserva obligación de comprobar dentro del historial montado |
| GET de comprobación | Recupera estado anulado, fecha y motivo originales; resumen filtrado pasa a $0 |
| Comprobante de venta anulada | VENTA ANULADA, motivo y fecha; importe original $12,34 conservado |
| Venta privada de producto | Existencias 5 → 4 |
| Anulación de producto | Existencias continúan en 4; una línea de mercancía pendiente |
| Recepción apta por comando existente | Una línea recibida, botón de nueva recepción desaparece; existencias 4 → 5 |
| Detalle después de recepción | Ref., unidades, precio original, reposición y motivo de anulación visibles |
| Lectura 503 simulada | Aviso y Reintentar historial; cero listas y resúmenes antiguos visibles |
| Reintentar lectura | Recupera los 18 registros y $141.136,29 |
| Encabezado final | Un único título Historial de operaciones |
| Vista móvil 390 × 844 | Documento 380 px; sin inputs, selects o botones desbordados. Diálogo de anulación dentro del viewport |

Evidencia del primer cierre de fixture, después del recorrido de venta, anulación y recepción:

```text
Fixture evidence: products=1, movements=3, sales=19, returns=1, expenses=3, annulledExpenses=0
Private UI fixture removed.
```

Los tres movimientos corresponden a entrada inicial, venta y recepción apta. Una anulación de $12,34 se confirmó por GET tras perderse su respuesta; el número de ventas permaneció sin duplicaciones.

## Límites conservados

El resumen corresponde al rango y los filtros de la lista consultada, como máximo 200 operaciones; no se presenta como total global del establecimiento. La paginación es local a esa lista. La anulación no procesa reembolso bancario ni repone existencias. La recepción se realiza por líneas completas con las reglas existentes de Inventario. El comprobante sigue siendo interno y no una factura electrónica.

La marca de anulación incierta se conserva al cerrar/reabrir su diálogo durante la consulta. Al recargar o volver a Historial se consulta nuevamente el backend; no se introduce persistencia adicional de comandos de anulación.

Estado: implementado y comprobado localmente. Commit, push y despliegue quedan para después por instrucción del usuario. Sin tag ni cierre oficial de versión; el versionado se evaluará antes de publicar.
