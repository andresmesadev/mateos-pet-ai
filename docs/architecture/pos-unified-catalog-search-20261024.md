# POS — una búsqueda para productos y servicios

24/10/2026. Ajuste del adaptador de interfaz solicitado por el responsable.
No cambia reglas de dominio, precios, stock, pagos ni permisos.

1. Función: abrir cada cobro en Todos, con una sola barra para nombre de producto,
   código/barras o nombre de servicio. Productos/Servicios filtran esa búsqueda.
   El catálogo sigue cerrado hasta buscar o pulsar Ver catálogo.
2. Casos: venta de mostrador, pago de cita, nuevo cobro, selección de mascota,
   cambio de filtro conservando consulta, escaneo rápido, selección por teclado,
   paginación de productos y fallos independientes de los catálogos.
3. Arquitectura: selector visual único en POS, reutilizando los endpoints de
   Inventario y catálogo de Caja y los callbacks existentes de agregar al carrito.
   El selector de insumos de otras pantallas permanece independiente. No hay
   API nueva ni decisiones de precio en la interfaz. F2 enfoca el buscador único.
4. Persistencia: el filtro visual no se guarda en el borrador; siempre inicia en
   Todos. Se mantienen el carrito, claves inciertas, snapshots de catálogo y
   contexto de mascota/establecimiento existentes. Respuestas de otra consulta
   o contexto se descartan; escanear no agrega una respuesta obsoleta.
5. Esquema/validación: sin schema ni migración. Comprobar filtro, tildes, código
   exacto, límite de stock y comisión/tarifa del servicio seleccionado, además
   de lint/build y regresiones de POS. No introducir validaciones de negocio
   nuevas. Versionado se evalúa al publicar el siguiente lote autorizado.

## Validación local

- `node --test scripts/pos-catalog-search.test.cjs scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs`:
  `tests 28`, `pass 28`, `fail 0`. Incluye render de cada filtro con un único
  buscador, combinación de catálogos, tildes, códigos exactos, stock agregado,
  tarifa/comisión del servicio y regresiones del carrito y borradores.
- `npm run lint` en `frontend/`: salida `eslint`, código de salida 0.
- `npm run build` en `frontend/`: `Compiled successfully`, TypeScript correcto,
  `Generating static pages (32/32)`, código de salida 0.
- `git diff --check`: sin errores de espacios.
- Revisión visual e interacción en navegador pendientes: el uso del navegador
  local está deshabilitado en esta sesión. No se ejecutó el escenario de cierre
  de caja; se actualizó únicamente su selector del buscador reemplazado.
- Sin operaciones sobre datos reales, commit, push ni despliegue en este lote.
