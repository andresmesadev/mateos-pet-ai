# Reportes de Caja y ventas — verificación del 2026-10-03

## Alcance aprobado

Cuatro ajustes aceptados por el responsable: resumen financiero exacto, navegación por períodos, desgloses y gráfico legibles, eliminación de recordatorios duplicados con errores independientes. Diseño documentado en `docs/architecture/pos-workspace.md`.

Se mantienen las reglas existentes: un cobro de cita completada ya constituye ingreso (ADR 007), Tenant es la única unidad de aislamiento, los precios históricos no se recalculan y las anulaciones conservan sus antecedentes. Los nuevos agregados son adaptadores administrativos de lectura; no crean entidades, migraciones ni comandos de dominio. No modifican comisiones ni el motor conversacional.

## Cambios comprobados

- Ingresos y egresos usan `status: active`. La diferencia conserva centavos y no se presenta como utilidad ni como efectivo de caja.
- Semana, mes y año se calculan en Bogotá. La fecha final visible es inclusiva; las consultas utilizan un límite final exclusivo. Hay regreso al período actual y comparación explícita con el período anterior completo. El período en curso se identifica como parcial.
- Resumen y desglose se leen dentro de transacciones `RepeatableRead`, para conservar coherencia entre los agregados de cada respuesta.
- Por revisar separa los cobros de citas sin responsable que haya confirmado su método; no se suman al efectivo confirmado. Los medios desconocidos se conservan como sin identificar.
- Productos y servicios se clasifican mediante los datos persistidos del artículo y el origen de la transacción. No se deduce un tipo a partir del nombre. Se conservan artículos sin clasificación y cualquier diferencia sin detalle.
- El gráfico anual corresponde al año en que comienza el período seleccionado, conserva barras con altura real y ofrece una tabla exacta de doce meses.
- Servicios más atendidos cuenta exclusivamente citas completadas. Actividad de clientes muestra clientes nuevos y cantidad de citas vigentes, sin afirmar que sea retención; sus seis meses actuales se identifican como contexto separado.
- Se retiraron los recordatorios de la pantalla de Reportes. Cada sección tiene carga, error y reintento propios. Cambiar de período oculta inmediatamente los resultados anteriores.
- Acceso administrativo y tenant autenticado preservados. Todas las solicitudes del navegador utilizan el proxy autorizado.

## Evidencia automatizada

Comandos ejecutados con salida satisfactoria:

```text
frontend: npm run lint
exit code 0 (sin errores ni advertencias)

frontend: npm run build -- --webpack
Compiled successfully in 4.6s
Finished TypeScript in 2.7s
Generating static pages (29/29)
exit code 0

node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs scripts/pos-expense.test.cjs scripts/pos-history.test.cjs scripts/pos-reports.test.cjs
tests 44; pass 44; fail 0

backend: npm test -- --runInBand src/__tests__/integration/dashboard-reports.test.js src/__tests__/integration/dashboard-expenses.test.js src/contexts/finance/__tests__/pos/void-manual-sale.usecase.test.js
Test Suites: 3 passed, 3 total
Tests: 24 passed, 24 total
```

Once pruebas de Reportes cubren límites de Bogotá, febrero bisiesto, semanas que cruzan años, rechazo de fechas futuras/mal formadas, aislamiento del tenant, denegación a recepción/veterinario/peluquero, estados activos, centavos, mascotas sin expediente, clasificación y contexto de actividad. Siete pruebas del frontend cubren rangos visibles, importes, rechazo de respuestas incompletas, reconciliación y alturas de barras.

## Recorrido real con PostgreSQL y navegador

Se usó `node scripts/serve-inventory-ui-local.cjs --seed-reports`: base temporal sin datos personales copiados, backend 3002 y frontend de producción 3010. Los datos reales del aplicativo no se modificaron.

| Comprobación | Resultado observado |
| --- | --- |
| 18 cobros, uno anulado | 17 activos; ingresos $141.136,29 |
| Cuatro egresos, uno anulado | Tres activos; egresos $18.000,10 |
| Diferencia | $123.136,19 |
| Efectivo confirmado | Siete cobros; $12.074,34 |
| Transferencias | Dos cobros; $32.000,25 |
| Tarjetas | Seis cobros; $36.061,70 |
| Otro | Un cobro; $6.000 |
| Cobro de cita sin revisar | Un cobro; $55.000, excluido del efectivo confirmado |
| Artículos | Productos $12,34; servicios $55.012,34; sin clasificación $86.111,61 |
| Citas | Dos vigentes, una completada, una cancelada y una no asistida; ranking una atención |
| Semana actual | 28 de septiembre a 4 de octubre de 2026 |
| Mes anterior | 1 a 30 de septiembre; ceros reales, sin cifras de octubre retenidas |
| Año anterior | Gráfico y tabla de 2025; actividad identificada como mayo–octubre de 2026 |
| Conciliación con Historial | Mismo importe activo de $141.136,29, con 17 activas y una anulada |
| Error 503 del resumen | Desglose y servicios disponibles; resumen sin cifras viejas; reintento correcto |
| Error 503 del desglose | Resumen disponible; reintento recupera las tablas |
| Vista móvil de 390 px | Sin secciones fuera de pantalla; tablas dentro de sus contenedores |
| Compilación final | Un solo encabezado de Reportes, ranking “Peluquería”; sin errores de consola |

Ambas bases de prueba se retiran al terminar. La cuenta utilizada existe únicamente en esos procesos privados.

## Publicación y límites

No se realizó commit, push, tag ni despliegue: la publicación conjunta del POS sigue diferida por instrucción del responsable. Este ajuste de lectura e interfaz no declara una fase nueva; el versionado del conjunto se evaluará antes del commit de publicación.

No se agrega utilidad/margen, facturación fiscal, conciliación bancaria, políticas nuevas de reembolso ni cobro doble de citas. Los porcentajes sin una base positiva se muestran sin base porcentual. La comparación del período parcial con el anterior completo se conserva y se explica, sin cambiar silenciosamente el criterio existente.
