# Inventario: mejoras de interfaz

Fecha: 2026-10-05. Alcance solicitado y aprobado en la conversación: cuatro mejoras sobre Inventario existente.

## Cambios

- Listado con disponibilidad destacada, saldo físico, mínimo, presentación y estados legibles. Los filtros existentes de reposición, vencimiento próximo y unidades vencidas pasan a botones visibles; se añade limpiar filtros y recuperación de búsquedas vacías. No se presentan conteos parciales como métricas del establecimiento.
- Formulario organizado por identificación, áreas de uso, costos/precio y control de existencias. Explicación de presentación completa, valores en COP y campos que se conservan después del primer movimiento.
- Entradas, conteos y correcciones muestran una vista previa del saldo físico. El conteo utiliza el total del lote, permite cero y calcula la diferencia conservando los demás lotes. La vista previa no promete disponibilidad ni sustituye la validación del servidor.
- Detalle centrado con pestañas Resumen, Lotes y Movimientos. Acciones visibles y adaptadas a pantalla pequeña. Se cancelan las consultas de movimientos al cerrar o cambiar de producto para evitar mezclar resultados tardíos.

Se reutilizan los comandos, permisos e idempotencia existentes. No hay cambios en esquema, migraciones, reglas de precio ni dominio. El costo y los movimientos siguen restringidos a administración; el precio de venta sigue sujeto al permiso de caja. Esta revisión no constituye un cierre de fase ni una publicación de versión: commit, push y despliegue quedan para cuando se soliciten.

## Verificación

Comandos ejecutados con el resultado real:

```text
frontend: npm run lint
exit code 0, sin errores

node --test scripts/*.test.cjs
tests 71
pass 71
fail 0

frontend: npm run build -- --webpack
Compiled successfully in 7.5s
Finished TypeScript in 2.8s
Generating static pages (29/29)
exit code 0

git diff --check
exit code 0
```

Siete pruebas nuevas verifican entrada, conteo por lote, conteo cero, límites enteros, corrección acotada, saldos superiores al entero seguro de JavaScript y fechas de Bogotá.

### Recorrido en navegador, con PostgreSQL temporal

Se utilizó el verificador existente `scripts/serve-inventory-ui-local.cjs`, en los puertos privados 3002/3010 y con credenciales temporales:

1. Crear un producto con presentación Frasco de 250 ml, usos Venta/Peluquería, costo $12.000, precio $18.000, mínimo cinco y control de lote/vencimiento.
2. Registrar ocho unidades en QA-OCT-01, con vencimiento 2026-10-20. Vista previa: saldo físico ocho, costo $96.000. Guardado confirmado; listado y lote muestran ocho disponibles.
3. Contar cuatro unidades. Vista previa: diferencia -4, saldo físico cuatro. Guardado confirmado; estado Reponer y filtro de reposición muestran el producto.
4. Verificar el historial: entrada +8 y ajuste -4, con responsable, fecha y motivo; la entrada permanece.
5. Probar búsqueda sin resultados y recuperar el listado mediante Ver todos los productos.
6. Revisar el detalle final a 320 × 740 y en escritorio, con pestañas y botones accesibles. Restaurar el tamaño del navegador y cerrar la sesión temporal.

Se eliminaron ambas bases temporales. Consulta final de PostgreSQL: cero bases `mateos_inventory_check_%`. No se escribieron productos ni movimientos en la base real ni en la VPS.

### Aplicativo local

Después de la verificación, autenticación real local confirmada sin imprimir credenciales:

```text
/dashboard/inventory: HTTP 200, error de compilación=false
/api/proxy/dashboard/inventory/products: HTTP 200, error de compilación=false
/api/health del backend: HTTP 200, status=ok
```

Frontend disponible en http://localhost:3001/dashboard/inventory. Se inició el contenedor PostgreSQL local existente, que estaba detenido al comenzar la comprobación.
