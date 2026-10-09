# Administración: grupos y eliminación definitiva — 2026-10-06

## Resultado

Servicios y precios muestra grupos separados de Peluquería y Veterinaria, con cantidades por grupo. Otros servicios se conserva para no ocultar categorías existentes. Búsqueda y filtros siguen funcionando sobre los grupos.

En Retirados aparecen Editar, Reactivar y Eliminar. El diálogo de eliminación exige escribir el nombre actual y explica que no hay recuperación. La eliminación física únicamente se permite a Administración, dentro del establecimiento autenticado, cuando no existen citas, reglas de precio o vínculos con el equipo (incluidos registros inactivos). No se elimina en cascada y se conserva la auditoría existente.

La creación de capacidades del equipo revalida y bloquea la referencia en su transacción, evitando una carrera con la eliminación. No se modificó el esquema ni se aplicaron migraciones para estos dos cambios. Diseño y excepción de conservación documentados en `docs/history/designs/service-catalog-retirement-cleanup-20261006.md` y en el modelo de dominio.

## Evidencia real

- `node --test scripts/service-catalog-postgres.test.cjs`: exit 0; `pass 1`, `fail 0`. PostgreSQL local, establecimientos temporales: CRUD, eliminación física, rechazo de servicio activo/nombre incorrecto, permisos de recepción, aislamiento, referencias de citas y tarifas, tarifas inactivas, vínculos revocados y carrera entre asignación al equipo/eliminación. Eventos conservados durante la operación.
- Jest `dashboard-services-price-tenant-wiring.test.js` y `dashboard-pet-agreed-price.test.js`: exit 0; `Test Suites: 2 passed, 2 total`; `Tests: 10 passed, 10 total`.
- ESLint frontend completo: exit 0, sin diagnósticos.
- Build frontend aislado con `NEXT_VERIFY_BUILD=1 next build --webpack`: compilación y TypeScript correctos; 29/29 páginas generadas.
- Navegador, establecimiento temporal: grupos visibles, buscar «consulta» oculta Peluquería y muestra Veterinaria; en Retirados se abre el diálogo, el botón permanece deshabilitado con nombre vacío y se habilita con el nombre exacto. Se canceló; no se confirmó eliminación desde el navegador.
- Navegador del aplicativo real en `http://localhost:3001/dashboard/settings`: 13 activos agrupados (6 Peluquería, 5 Veterinaria, 2 Otros); 2 retirados con las tres acciones. Comprobación móvil a 375 px: documento 365 px, sin desbordamiento horizontal. No se eliminaron servicios reales.
- El ayudante temporal eliminó su establecimiento al cerrarse: `PASS: disposable tenant removed; existing business data unchanged.` Comprobación posterior: `PASS: no queda ningún establecimiento temporal de esta comprobación.`
- `git diff --check`: exit 0; únicamente advertencias de conversión LF/CRLF.

Cambios locales. Commit, push, versión de cierre y despliegue pertenecen al cierre posterior de la tanda de Administración.
