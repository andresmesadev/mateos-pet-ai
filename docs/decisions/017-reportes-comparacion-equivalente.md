# ADR 017 — Comparación y salida de Reportes

Fecha: 2026-10-03. Estado: aceptado por el responsable del producto.

## Definición funcional

Los tres ajustes aprobados son exportar Excel e imprimir el resumen, abrir ingresos/egresos/cobros por revisar con sus mismas fechas y comparar períodos equivalentes. Refinan la lectura administrativa existente; no introducen un entregable operativo nuevo ni entidades de dominio.

## Casos de uso

El administrador selecciona semana, mes o año, elige comparación completa o equivalente y puede revisar sus operaciones o producir un documento. Las fechas, el establecimiento y la hora de consulta quedan explícitos. Las listas conservan sus límites visibles de 200 cobros y 500 egresos; sus sumas no sustituyen los agregados completos de Reportes.

## Arquitectura técnica

El adaptador de lectura sigue consultando exclusivamente el tenant autenticado y movimientos activos. La opción completa mantiene el comportamiento anterior. La equivalente corta el período en curso al final del día de Bogotá y el anterior en el mismo día de semana, día de mes o mes/día del año. Si el mes anterior es más corto, utiliza su último día y lo informa. Un período histórico usa su último día como referencia. Las fechas efectivas se aplican por igual al resumen, desglose y ranking; el contexto anual permanece anual.

Los enlaces abren las vistas existentes con fechas inclusivas y filtros activos, conservan el tenant seleccionado y permiten volver a la selección de Reportes. Las ventanas completas que terminan después de hoy se admiten solo como lectura del contexto enlazado; no habilitan registrar gastos futuros.

Excel e impresión utilizan la misma copia del resumen y desglose validado. Se habilitan cuando fechas, selección, total y cantidad de cobros coinciden. Si una consulta falla o los resultados difieren, se solicita actualizar antes de exportar. Excel contiene números reales y textos literales; impresión utiliza una hoja A4 independiente de la navegación.

## Modelo de persistencia

Reutiliza Tenant, Transaction, TransactionItem, Expense, Appointment y User. El nombre del establecimiento se lee junto al resumen. Sin escrituras ni cambios de precios, comisiones o cobros.

## Esquema físico

Sin tablas, índices, migraciones ni cambios de Prisma. La comparación resuelve una decisión de presentación previamente diferida en pos-workspace.md; no altera el cierre financiero ni reglas monetarias.

## Verificación y versión

Verificar límites Bogotá, meses cortos y bisiestos, aislamiento, enlaces/filtros, centavos y tipos de celda Excel, vista de impresión, errores y navegación real. Evaluar el versionado con el conjunto POS/Inventario al preparar la publicación; este ajuste no crea un tag independiente.
