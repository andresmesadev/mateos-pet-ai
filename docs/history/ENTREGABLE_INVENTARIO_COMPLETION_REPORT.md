# Inventario de productos e insumos — implementación y publicación

Fecha: 2026-10-02. Versión del backend: **2.42.0**.

Estado: implementación validada y publicada en GitHub y en la VPS el **2026-10-05**, versión **2.42.0**. Las dos migraciones de Inventario se aplicaron correctamente en producción. Evidencia de publicación y comprobaciones: [RELEASE_2_42_0_VPS_20261005.md](RELEASE_2_42_0_VPS_20261005.md). Este informe no declara una nueva fase ni reabre las fases cerradas.

## Alcance y aprobaciones

El responsable del producto solicitó existencias para productos del Pet shop e insumos de Veterinaria y Peluquería. Se recibió aprobación explícita de las cinco etapas antes de implementar: definición funcional, casos de uso, arquitectura, modelo de persistencia y esquema físico. La última autorización fue «Sí, apruebo; empieza la implementación».

Fuentes: [diseño funcional y casos de uso](../architecture/inventory-workspace.md), [arquitectura](../architecture/inventory-technical-design.md), [persistencia](../architecture/inventory-persistence-model.md), [esquema físico](../architecture/inventory-physical-schema.md), [ADR 015](../decisions/015-inventario-productos-insumos.md) y [ADR 016](../decisions/016-venta-inventario-atomica.md). El Contexto 13 del modelo conceptual precedió al código.

## Capacidades disponibles

- Inventario en Gestión: catálogo por establecimiento, códigos internos y de barras, presentación, áreas de uso, precio, costo de referencia, mínimos y desactivación conservando antecedentes.
- Entradas, lotes, vencimientos, conteo físico y retiros justificados. Se distinguen unidades físicas, aptas y vencidas. Un lote que vence en el día de Bogotá deja de estar disponible.
- Movimientos inmutables y saldo por lote; consumo explícito de insumos y corrección acotada de unidades no utilizadas, sin reescribir el original.
- POS con búsqueda de catálogo, disponibilidad, cantidades enteras y precio centralizado con versión. Venta financiera y salida de mercancía se confirman en una misma transacción; un fallo de stock revierte ambas.
- Comprobante con instantánea de producto, código, presentación y precio. Editar el catálogo no cambia ventas anteriores.
- Anulación económica separada de recepción física. El administrador recibe cada línea completa de una venta manual anulada una sola vez, en sus lotes originales; material no apto o vencido no vuelve al saldo disponible. El historial conserva la evidencia de devolución.
- Operaciones con clave UUID y contenido normalizado. Reintentos no duplican movimientos ni ventas. Los resultados inciertos conservan clave y cuerpo enviado en el navegador, aislados por identidad/establecimiento, incluso al cerrar la pestaña; pueden consultarse o reintentarse.

## Autorización y arquitectura

| Perfil | Alcance efectivo |
| --- | --- |
| Administrador | Gestionar catálogo, costos, entradas, ajustes, correcciones, consumo y devoluciones dentro del establecimiento habilitado. |
| Recepción y caja | Consultar disponibilidad y vender con Caja y Pet shop activos; no leer costos ni modificar existencias administrativas. |
| Veterinario / peluquero | Consumir insumos de su área con `inventory_consume`; no necesita Caja para esa operación. Una atención asociada debe pertenecerle y estar iniciada o completada. |
| Profesional con Caja | Puede vender cuando Pet shop está activo; consumir requiere su habilitación independiente. |

La autorización se vuelve a verificar contra Staff y módulos vigentes, también al recuperar operaciones. Tenant sigue siendo la única unidad de aislamiento. Las rutas HTTP adaptan los casos de uso; el repositorio de Inventario concentra las escrituras físicas. El coordinador POS combina Inventario y Finanzas con la unidad de trabajo existente. La selección de lotes usa vencimiento primero y luego antigüedad, con orden estable; locks ordenados, aislamiento serializable y reintentos acotados protegen concurrencia.

Se reutiliza `price-resolver.service.js`. No se cambian comisiones inmutables ni se introduce otro registro financiero. El motor conversacional no tuvo cambios. La publicación de eventos reutiliza el certificador existente después del commit: un fallo del publicador no revierte un movimiento confirmado y no implica una nueva garantía de outbox.

## Migración local y datos

Antes de migrar se creó y verificó el respaldo PostgreSQL `/tmp/mateos-before-inventory-20261002.dump` dentro del contenedor local. Se aplicaron las migraciones aditivas `20261002230000_inventory_products_stock` y `20261002231000_inventory_event_types`; `prisma migrate status` informó **43 migraciones, esquema actualizado**. `prisma validate` y `prisma generate` finalizaron con salida 0. No se modifican las migraciones ya aplicadas.

No se convirtieron productos manuales anteriores ni se sembraron productos de ejemplo en `mateos_dev`. Para empezar: registrar producto y luego ingresar unidades. Las opciones dependen de los módulos activos del establecimiento; no se activó Pet shop automáticamente.

## Evidencia real de validación

| Comprobación | Resultado observado |
| --- | --- |
| Frontend `npm run lint` | Salida 0, `eslint` sin diagnósticos. |
| Frontend `npm run build` | Salida 0; `Compiled successfully`, TypeScript completado y 29 páginas generadas. |
| Sintaxis backend con Node `--check` | 31 archivos modificados/nuevos, 0 fallos. |
| Jest, totalidad de archivos dividida en cuatro bloques disjuntos | 158 suites, 1.222 pruebas aprobadas: 40/358, 40/347, 40/349 y 38/168 suites/pruebas. |
| `node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs` | `tests 15`, `pass 15`, `fail 0`, salida 0. |
| `node scripts/verify-inventory-local.cjs` | 34 comprobaciones aprobadas en PostgreSQL real; base desechable eliminada. |
| Revisión de fronteras | Barrido completo de 1.043 archivos: única llamada `apiUrl` desde componentes cliente en onboarding público (excepción sancionada); escrituras de Inventario solo en su repositorio y en la fixture PostgreSQL; sin cambios en motor conversacional/comisiones. |
| Documentación y salud | Siete documentos de Inventario sin enlaces locales rotos; `git diff --check` salida 0; `/api/health` informó `ok`, versión `2.42.0`. |

La suite PostgreSQL verificó carreras por la última unidad, rollback financiero y físico, repetición/concurrencia de la misma clave, referencias ajenas, permisos revocados, lotes vencidos, conteos obsoletos, precios/versiones, devoluciones repetidas, correcciones acumulativas, evidencia inmutable y límites de persistencia. Las pruebas del navegador almacenado comprobaron supervivencia de ventas inciertas al cierre de pestaña/logout y aislamiento entre cuentas. No se afirma una prueba visual de desconexión deliberada después del commit.

En Windows, dos ejecuciones de todas las suites en un único proceso terminaron con código nativo `-1073740791`, sin fallo de aserción reportado. Para obtener el resultado completo se ejecutaron todos los archivos en cuatro bloques, conservando `--runInBand --runTestsByPath`: ningún bloque falló. El driver pg 8 emitió una advertencia de deprecación de consulta concurrente; no produjo fallos. No se actualizó esa dependencia fuera de alcance.

La primera compilación final en sandbox falló al descargar Geist desde Google Fonts. La misma compilación con acceso permitido a ese recurso terminó correctamente; no se alteró el diseño para ocultar el fallo de red.

### Recorrido visible en navegador

Se levantaron backend y frontend privados en puertos 3002/3010, con una base temporal que copia únicamente el esquema. Se creó «Champú de prueba», código `QA-001`, barras `00123456789`, presentación Frasco 250 ml, lote `QA-LOTE` con vencimiento futuro.

1. Entrada de 5 unidades: saldo físico/disponible 5.
2. Venta de 2 a $12.000: comprobante interno de $24.000 y saldo 3.
3. Anulación manual: aparece la acción separada de recibir devolución.
4. Recepción de 2 unidades aptas: saldo 5 en el lote original.
5. Consumo de 1 unidad: saldo 4, razón y autor en el historial.
6. Corrección de la unidad no utilizada: confirmación guardada y saldo 5, sin borrar los movimientos anteriores.

La prueba móvil a 390×844 mostró el formulario centrado sin desbordamiento horizontal y controles de cierre/guardado visibles. Se restableció el viewport y se eliminó la base temporal al cerrar el servidor privado. La primera fixture, al copiar solo esquema, no tenía catálogo global de eventos: sus fallos de certificación quedaron como avisos no bloqueantes, sin afectar stock/finanzas. El script de prueba ahora copia también ese catálogo global; no copia datos de clientes o ventas. La certificación de eventos no se presenta como verificada por ese recorrido inicial.

El recorrido detectó que el diálogo de devolución desaparecía al terminar la última línea y borraba su mensaje local. Se corrigió con confirmación persistente en el historial y marcadores de recepción por línea, también en el comprobante. Esta corrección final pasó lint y build; no se repitió el recorrido temporal completo después de ella.

## Decisiones diferidas y publicación

Permanecen fuera del alcance aprobado: fracciones/conversiones de envases, compras y proveedores completos, valoración contable, reservas de stock, depósitos, traslados entre establecimientos, devoluciones parciales de ventas activas con reembolso y restricciones formales por receta. El comprobante es interno, no factura electrónica; anular/recibir mercancía no ejecuta reembolsos bancarios.

La versión está disponible en `/dashboard/inventory`, tanto localmente como en producción. El despliegue del 2026-10-05 certificó la sincronización del código publicado y la aplicación de las migraciones; las comprobaciones en la VPS fueron de lectura y no crearon ventas ni movimientos de prueba en la base real.
