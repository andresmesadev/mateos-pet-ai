# Inventario: registro y correcciones — validación local

20 de octubre de 2026. Implementación local; sin commit, push ni despliegue.
Versión publicada vigente: 2.52.0. El versionado de la próxima publicación se
evaluará al preparar su cierre, junto con los ajustes móviles pendientes.

Diseño en cinco etapas: [registro y correcciones](../architecture/inventory-registration-corrections.md).

## Resultado funcional

- Nuevo producto incluye existencias iniciales, cero por defecto. Si hay saldo,
  registra una entrada real al costo unitario de referencia, con lote/vencimiento
  cuando correspondan. Todo se confirma o revierte junto al producto.
- Detalle → Movimientos → Corregir cantidad y costo. Motivo obligatorio;
  reversión y nueva entrada conservan antecedente, lote y vencimiento. Cero
  cancela una entrada sin usos posteriores. Un lote con salidas posteriores
  requiere revisar Conteo físico. No modifica Caja ni gastos anteriores.
- Producto desactivado → Eliminar. Exige saldo cero y ausencia de ventas,
  consumos, otros usos o selecciones operativas. El retiro es definitivo para
  el catálogo; sus hechos e identidad permanecen. Se pueden reutilizar el código
  y las barras al registrar el producto correcto.
- La ficha recibe la última revisión de stock al actualizar el listado; se
  corrigió un conflicto detectado al realizar dos correcciones seguidas.

## Evidencia ejecutada

Comandos con Node del runtime local. Logs completos en `.cache/` del workspace.

| Comando | Salida real |
| --- | --- |
| `node scripts/verify-inventory-local.cjs --fresh-migrations` | `Inventory application checks: 45 passed, 0 failed. Disposable database only.` |
| `node scripts/verify-onboarding-local.cjs --grooming-transport --inventory-registration` | `Onboarding integration: 56 passed, 0 failed. Local disposable data only; no jobs, external messages or real charges.` |
| `cd backend` y `node node_modules/jest/bin/jest.js --runInBand` | `Test Suites: 214 passed, 214 total`; `Tests: 1766 passed, 1766 total` |
| Helpers de CI, excluyendo suites PostgreSQL y operational-cash-query | `tests 166`; `pass 166`; `fail 0` |
| `cd frontend` y `node node_modules/eslint/bin/eslint.js .` | Exit 0; salida vacía |
| `NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build` desde frontend | Exit 0; compilación y TypeScript aprobados |
| `prisma generate` | Prisma Client 7.10.0 generado |
| `prisma migrate deploy` + `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` en BD desechable | Exit 0; las 63 migraciones aplican desde cero, sin drift |
| `git diff --check` | Exit 0 |

Logs: `inventory-registration-postgres.log`,
`inventory-registration-browser-final.log`, `inventory-registration-backend-tests.log`,
`inventory-registration-helper-tests.log`, `inventory-registration-lint.log`,
`inventory-registration-build.log` y `inventory-registration-local-migration.log`.
El recorrido final no registró errores del backend ni errores de navegador.

Se verificaron atomicidad y rollback, concurrencia de altas/correcciones,
repetición y recuperación sin duplicados, costo/cantidad, permisos y Tenant,
revisión obsoleta, bloqueo de lotes usados, retiro/reutilización de código y
barras, inmutabilidad de antecedentes y prohibición de reactivar retirados.
Las regresiones de agenda, servicios por área, comisiones, Caja y los ajustes
móviles anteriores también pasaron en el recorrido de 56 comprobaciones.

## Migración y revisión visual

Migración nueva: `20261020120000_inventory_registration_corrections`.
Aplicada únicamente a la base de desarrollo validada por host loopback, puerto
5433 y nombre `mateos_dev`. No se modificó la base de producción. Las bases de
pruebas fueron desechables y se eliminaron al terminar.

Capturas revisadas en `.cache/onboarding-verification/`:

- `46-inventory-initial-stock-mobile.png`
- `47-inventory-entry-correction-mobile.png`
- `48-inventory-remove-mobile.png`

Formularios a 320 px con cuerpo desplazable y acciones visibles. Las pruebas
anteriores de topbar/cierre mantienen márgenes y botones táctiles de 44 px.
