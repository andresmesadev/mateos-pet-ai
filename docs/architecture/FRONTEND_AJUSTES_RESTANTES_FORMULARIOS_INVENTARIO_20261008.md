# Cuatro mejoras siguientes del frontend

Fecha: 8 de octubre de 2026. Estado: propuesta aceptada y aplicada localmente. La evidencia y los límites de verificación están en el [informe de implementación](../history/FORMULARIOS_MOVIMIENTOS_INVENTARIO_20261008.md). Pendiente de publicación.

La revisión del código identifica una siguiente ronda concreta sobre operaciones existentes. No requiere agregar funciones de negocio, modelos ni permisos nuevos.

## 1. Extender el formato común a los movimientos de inventario

Aplicar la estructura de secciones, botones visibles y errores junto al campo a **Entradas, Conteos, Correcciones de consumo, Insumos utilizados y Devoluciones**. Estos formularios todavía usan estructuras propias y no utilizan la validación compartida recién implementada.

Mostrar siempre la presentación del producto y distinguir claramente **unidades**, **costo en COP**, **lote**, **vencimiento** y **motivo**, según la operación elegida. Conservar sus cálculos, restricciones y confirmaciones actuales.

Fuentes: [movimientos](../../frontend/components/dashboard/inventory/stock-form.tsx), [consumos](../../frontend/components/dashboard/inventory/consumption-button.tsx), [devoluciones](../../frontend/components/dashboard/inventory/return-button.tsx).

## 2. Proteger los cambios antes de cerrar esos formularios

Actualmente sus botones de cierre y Escape pueden cerrar directamente el editor. Añadir la misma protección de cambios que tienen clientes, citas y productos: avisar si hay datos escritos y bloquear el cierre durante el guardado.

Si el resultado está pendiente de comprobar, explicar que cerrar la ventana conserva la operación para recuperarla. No confundir descartar un borrador con cancelar una operación enviada; mantener la misma clave al consultar o reintentar.

## 3. Mejorar el listado de inventario en móvil

El [listado actual](../../frontend/components/dashboard/inventory/inventory-workspace.tsx) utiliza una tabla con ancho mínimo de 780 px. En móvil, presentar tarjetas con **producto, presentación, unidades disponibles, estado y acciones**, conservando la tabla en escritorio.

Mantener los filtros y mostrar precios y costos exclusivamente a los perfiles que ya tienen autorización.

## 4. Facilitar el uso con el dedo y el teclado

Ampliar controles pequeños, como **Quitar mascota** del [registro de propietario](../../frontend/components/dashboard/new-owner-pets-sheet.tsx), que todavía usa un icono pequeño y poco espacio de pulsación. Mantener sus nombres accesibles y el foco visible.

Comprobar la navegación con Tab, Enter y Escape, el retorno del foco al cerrar y el diseño con zoom al 200 %. Esta revisión fue estática: no certifica contraste, lector de pantalla ni medidas reales de todos los controles.

## Orden recomendado

Implementar 1 y 2 juntos; después 3 y 4. Verificar entradas, conteos, consumos, correcciones y devoluciones con datos simulados, incluidos fallos de conexión y recuperación sin duplicados, en móvil, tableta y escritorio.
