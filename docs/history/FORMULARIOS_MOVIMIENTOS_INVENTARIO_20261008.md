# Formularios de inventario y adaptabilidad del listado

Fecha: 8 de octubre de 2026. Estado: aplicado y verificado localmente; pendiente de publicación.

## Alcance aprobado y resultado

Se aplicaron los cuatro ajustes de la [propuesta aceptada](../architecture/FRONTEND_AJUSTES_RESTANTES_FORMULARIOS_INVENTARIO_20261008.md), sobre capacidades de inventario existentes.

1. **Formularios organizados:** Entradas, Conteos físicos, Correcciones de consumo, Insumos utilizados y Devoluciones utilizan la estructura común de encabezado, cuerpo desplazable y botones fijos. Los errores aparecen junto al campo y llevan el foco al primer dato inválido. Unidades, costo en COP, lotes, vencimientos y motivos tienen etiquetas permanentes. La nota de entrada es opcional y plegable; el motivo del consumo vinculado a una atención sigue siendo opcional.
2. **Borradores y operaciones protegidos:** Escape, el botón de cierre y el fondo respetan la confirmación de descarte. Durante el guardado se bloquea el cierre. Una respuesta incierta conserva la clave y el contenido enviados; cerrar el editor no cancela la operación. Se puede consultar el resultado desde Inventario o reintentar la misma operación. Solo la confirmación de la operación enviada por ese editor puede marcarlo como guardado o limpiar su borrador.
3. **Inventario adaptable:** tarjetas en móvil y tableta; tabla desde el ancho de escritorio de 1280 px. Se conservan búsqueda, filtros, paginación, estados, cantidades y acciones. Los precios siguen condicionados al permiso de caja; los costos no se agregan a las tarjetas. Las acciones de gestión continúan sujetas a sus permisos. Los nombres extensos pueden dividirse en varias líneas.
4. **Controles y teclado:** Quitar mascota, Quitar insumo y el cierre de los diálogos tienen áreas de 44 × 44 px; los controles de recuperación y los botones fijos también mantienen altura cómoda. Se conservan nombres accesibles y foco visible. Escape distingue las sugerencias de insumos del cierre del editor. Al cerrar un movimiento, el foco vuelve a la acción del producto; si esa acción ya no está, vuelve a la búsqueda. La actualización conserva el listado visible y bloquea nuevas escrituras mientras consulta las existencias.

## Archivos principales

- [Estructura común](../../frontend/components/dashboard/form-layout.tsx) y [protección del cierre](../../frontend/components/dashboard/protected-dialog.tsx).
- [Entradas, conteos y correcciones](../../frontend/components/dashboard/inventory/stock-form.tsx), [insumos](../../frontend/components/dashboard/inventory/consumption-button.tsx), [devoluciones](../../frontend/components/dashboard/inventory/return-button.tsx).
- [Confirmación por editor](../../frontend/components/dashboard/inventory/use-inventory-form-operation.ts), [estado de operaciones](../../frontend/components/dashboard/inventory/operation-status.tsx), [editor de producto](../../frontend/components/dashboard/inventory/product-form.tsx).
- [Listado](../../frontend/components/dashboard/inventory/inventory-workspace.tsx), [selector de productos](../../frontend/components/dashboard/inventory/product-picker.tsx), [registro de propietario y mascotas](../../frontend/components/dashboard/new-owner-pets-sheet.tsx), [diálogo compartido](../../frontend/components/ui/dialog.tsx).

Las operaciones reutilizan los contratos existentes y el almacenamiento duradero ya implementado. No se agregaron entidades, migraciones, reglas de descuento de existencias, precios, permisos ni endpoints. Se mantienen el aislamiento por establecimiento y las llamadas autenticadas mediante el proxy.

## Evidencia real

Los comandos se ejecutaron con Node instalado en `C:/Program Files/nodejs/node.exe`. Los scripts de navegador utilizaron Playwright del runtime de Codex mediante `NODE_PATH`, un backend simulado en 3030 y una compilación aislada del frontend en 3031. No utilizaron PostgreSQL real ni enviaron mensajes externos.

```text
Frontend: node node_modules/eslint/bin/eslint.js .
Exit code: 0; sin errores ni advertencias.

Frontend: NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build
✓ Compiled successfully in 1012ms
Finished TypeScript in 2.7s
✓ Generating static pages using 11 workers (29/29) in 496ms
Exit code: 0

node scripts/verify-general-dashboard.cjs --inventory-forms-only
PASS: 320px: inventory cards/table, stock, price and actions fit the viewport.
PASS: 320px: entry validation prevents invalid writes, retains drafts, and saves tracked lot/cost with fixed footer.
PASS: 320px: count accepts zero, requires lot/reason, preserves conflict draft and stock revision.
PASS: 320px: correction cannot exceed original consumption; additive payload and fixed footer.
PASS: 320px: keyboard product selection, inline selection/quantity/reason errors, consumption confirmation clears own draft.
PASS: 320px: returns require complete selected lines/reason, lock already returned lines, preserve disposition without financial writes.
Mismos seis grupos PASS a 768 y 1440 px.
PASS: Slow entry blocks closing and duplicate submission until confirmation.
PASS: Uncertain entry remains durable after closing; workspace recovery confirms it without duplicate write.
PASS: Uncertain return retries the same durable key/content; own confirmation refreshes history and closes editor.
PASS: Escape dismisses product suggestions first and protects a consumption draft on dialog dismissal.
PASS: Consumption recovery clears only its confirmed items and reason.
PASS: Supplies used during an appointment preserve appointment link; reason remains optional.
PASS: Pet remove and modal close targets are 44px; pet removal works with keyboard.
PASS: Entry passes emulated 200% reflow with doubled pixels; fixed actions remain visible and no horizontal page overflow.
PASS: Long product names and unbroken references wrap within mobile cards.
PASS: vet: inventory cards preserve management and financial visibility permissions.
PASS: groomer: inventory cards preserve management and financial visibility permissions.
PASS: receptionist: inventory cards preserve management and financial visibility permissions.
PASS: Zero browser errors, no real DB writes or external messages; only additive fixture inventory commands.
Exit code: 0

node scripts/verify-general-dashboard.cjs --inventory-forms-only --inventory-zoom-only
PASS: Entry passes emulated 200% reflow with doubled pixels; fixed actions remain visible and no horizontal page overflow.
Exit code: 0

node scripts/verify-general-dashboard.cjs --forms-only
PASS: 33 form structure scenarios; fixture-only API writes, no real database changes or outgoing messages.
Exit code: 0

node scripts/verify-general-dashboard.cjs --feedback-only
PASS: 19 focused scenarios; fixture-only writes, zero real database changes or outgoing messages.
Exit code: 0

node --test scripts/inventory-display.test.cjs
ℹ tests 7
ℹ pass 7
ℹ fail 0
Exit code: 0
```

Total: **31 grupos de inventario y 52 escenarios de regresión del frontend**, además de **7 pruebas unitarias** de cantidades, conteos, saldos grandes, correcciones, estados y fechas. La repetición aislada de ampliación no se suma nuevamente al total. Se comprobaron Tab, Shift+Tab, Enter y Escape, el retorno del foco y botones visibles a una altura de 608 px.

Las capturas locales reproducibles están en `.cache/general-dashboard/inventory-*.png`. Se inspeccionaron visualmente la entrada ampliada, la devolución en móvil y el listado en tableta. El reflujo equivalente al 200 % se comprueba mediante un contexto de navegador con 320 × 608 píxeles CSS y factor de píxel 2, que representa una pantalla de 640 × 1216 al duplicar la escala. No se presenta como prueba manual del control de zoom de Chrome, certificación de contraste o validación con lector de pantalla.

## Límites y publicación

Comprobaciones finales: `node --check` de los dos scripts modificados y `git diff --check` terminaron con código 0. El verificador documental examinó 277 documentos, 262 Markdown y 687 enlaces: cero enlaces rotos, referencias ausentes, enlaces locales no portables, errores del catálogo o duplicados exactos. Los puertos de comprobación 3030 y 3031 quedaron libres.

Las verificaciones certifican la interfaz y los contratos simulados descritos; no sustituyen pruebas de integración del inventario en una base de datos real. No se tocaron los servidores de desarrollo del usuario ni se publicaron cambios en la VPS. No se creó commit, push, tag o nueva versión; el versionado se evaluará al preparar la publicación correspondiente. Los cambios anteriores del repositorio se conservaron.
