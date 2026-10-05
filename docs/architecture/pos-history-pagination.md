# Punto de venta: nombres y detalle completo

## Definición funcional

El módulo se presenta como Punto de venta, con Cobrar, Caja diaria, Gastos, Historial de cobros y Reportes. El detalle de Reportes permite recorrer todas las operaciones del período sin truncar a 200 cobros o 500 gastos.

## Casos de uso

Consultar páginas, buscar en todo el período, combinar filtros, consultar totales del conjunto filtrado y volver al reporte conservando su selección. Tras anular se vuelve a consultar el resultado persistido.

## Arquitectura técnica

Los adaptadores GET existentes aceptan opcionalmente pagination=1 y devuelven data, total, page, pageSize, totalPages y summary. Las llamadas anteriores conservan su respuesta en forma de arreglo. Validación de parámetros antes de consultar; identidad y permisos existentes; recepción limitada al día para operadores. Consultas SQL parametrizadas para búsqueda sin tildes y orden estable por fecha/id. Conteo, suma y página comparten una transacción de lectura RepeatableRead. El navegador invalida resultados al cambiar filtros y descarta respuestas antiguas.

## Persistencia

Reutiliza Transaction, TransactionItem, User, Pet y Expense. Los totales activos excluyen anulados; la lectura no altera cobros, precios, comisiones ni existencias. No se introduce ninguna regla monetaria nueva.

## Esquema físico y verificación

Sin migraciones. Reutiliza índices por tenant y fecha. Verificar parámetros inválidos, límites de rol, aislamiento, búsqueda de registros antiguos, totales de todas las páginas, navegación y comportamiento ante errores. Ejecutar lint, pruebas de POS y lectura financiera, build y recorrido con una base desechable que supere los límites anteriores.
