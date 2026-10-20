# Registro y correcciones de inventario — 20 de octubre de 2026

Diseño local solicitado durante la beta. Complementa el contexto 13 y el ADR 015;
no cambia la venta, los precios ni las reglas de Caja. Publicación pendiente.

## 1. Definición funcional

El alta permite registrar existencias iniciales (cero por defecto), con el costo
unitario de referencia y el lote/vencimiento exigido por el producto. Eliminar un
registro equivocado lo retira del catálogo, conservando su identidad y auditoría.
Solo se permite si está desactivado, sin saldo y sin usos reales. Una entrada
puede corregirse en cantidad y costo, con motivo obligatorio. Lote y vencimiento
conservan su identidad. No se editan hechos ni se generan gastos en Caja.

## 2. Casos de uso

- Crear producto y su entrada inicial en una sola transacción; un error revierte
  ambas partes. Repetir la misma clave no duplica existencias.
- Corregir entrada: comprobar versión de stock, anular sus unidades y registrar
  la cantidad/costo corregidos en el mismo lote. Cero cancela la entrada. El
  antecedente permanece visible y solo admite una reversión; la nueva entrada
  puede corregirse después. Se rechaza si el lote tuvo salidas posteriores o no
  conserva las unidades originales: corresponde revisar el conteo físico.
- Eliminar producto: desactivado, saldo cero y movimientos exclusivamente de
  entradas/reversiones; sin selecciones operativas. El registro deja de aparecer,
  incluido el filtro de desactivados, y libera código y barras para corregir el
  alta. Sus identificadores nunca se reutilizan.
- Todos los comandos requieren administración y Tenant autenticado. Conservan
  idempotencia, recuperación de respuestas perdidas y control de concurrencia.

## 3. Arquitectura técnica

Se extienden los comandos y lecturas del contexto Inventario, el repositorio
transaccional y sus adaptadores HTTP/UI existentes. `create_product` reutiliza
`addEntry`; `correct_entry` bloquea el producto y referencia el movimiento de
origen. `remove_product` conserva el producto para sus claves foráneas y hechos.
Los eventos reutilizan ProductoActualizado y AjusteDeInventarioRegistrado.
La UI utiliza el protocolo duradero de operaciones existente. Ningún dato de
identidad procede del formulario. El selector operativo y las lecturas excluyen
registros retirados; los recibos e historiales existentes conservan referencias.

## 4. Modelo de persistencia

InventoryProduct incorpora `removedAt` opcional; nunca se borra físicamente.
InventoryOperation admite `remove_product` (resultado producto) y `correct_entry`
(resultado movimientos, operación origen). InventoryMovement añade
`entry_reversal`, delta negativo y vínculo al movimiento original. Se mantiene
la inmutabilidad de operaciones, movimientos, lotes y devoluciones. La revisión
del producto cambia una vez por comando con movimiento.

## 5. Esquema físico y validación

Migración aditiva: timestamp de retiro; índices únicos parciales de código y
barras para productos no retirados; CHECK de retiro solo inactivo; ampliación de
CHECK de operaciones/movimientos y unicidad parcial de reversión por origen.
Los triggers que impiden borrar hechos/productos permanecen. Regenerar Prisma.
Validar en PostgreSQL desechable: atomicidad, replay, corrección, salidas que
bloquean, versiones, aislamiento, retiro y reutilización de código; comprobar
formularios en navegador, lint y regresiones existentes antes de publicar.
