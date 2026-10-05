# Inventario — Etapa 5: esquema físico

Fecha: 2026-10-02.

**Estado: aprobado e implementado localmente.** El responsable aprobó esta quinta etapa el 2026-10-02 mediante «Sí, apruebo; empieza la implementación», después de aprobar las cuatro anteriores. Evidencia y límites en el [informe de implementación](../history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md). Publicación y despliegue en VPS pendientes.

Fuentes: [alcance y casos de uso](inventory-workspace.md), [arquitectura aprobada](inventory-technical-design.md), [persistencia aprobada](inventory-persistence-model.md), [dominio](domain-model-v1.md), [ADR 015](../decisions/015-inventario-productos-insumos.md), [ADR 016](../decisions/016-venta-inventario-atomica.md) y [regla de ejecución](../PHASE_2_EXECUTION_RULE.md).

## 1. Artefactos revisables

| Archivo | Contenido y límite |
| --- | --- |
| [inventory-schema-draft.prisma](inventory-schema-draft.prisma) | Cinco modelos nuevos y proyección de sus relaciones con tablas existentes; validado con Prisma 7.10.0 |
| [inventory-migration-draft.sql](inventory-migration-draft.sql) | DDL aditivo generado desde la proyección, seis columnas nuevas en `TransactionItem`, índices, claves, checks y triggers adicionales |
| [validate-inventory-schema-draft.cjs](../../scripts/validate-inventory-schema-draft.cjs) | Comprobaciones SQL en un esquema privado de Docker local dentro de una transacción que siempre se revierte |

La proyección Prisma **no reemplaza** `prisma/schema.prisma`: `Tenant`, `Transaction`, `TransactionItem` y `Appointment` contienen solo los campos necesarios para validar estas relaciones. Los modelos nuevos, campos y relaciones inversas se integraron en el esquema principal conservando los modelos anteriores. Las migraciones `20261002230000_inventory_products_stock` y `20261002231000_inventory_event_types` están aplicadas en Docker local y el cliente Prisma está regenerado. Los borradores conservan el diseño previo a la integración.

## 2. Tablas y tipos

| Tabla | Identidad y persistencia |
| --- | --- |
| `InventoryProduct` | ID opaco de texto (UUID generado por el comando; default Prisma CUID) y Tenant obligatorio; código interno y clave canónica, código de barras opcional, nombre, categoría, presentación, usos, costo/precio, mínimo, política de lotes, activo y tres versiones |
| `InventoryLot` | ID opaco de texto (UUID generado por el comando; default Prisma CUID); identidad compuesta Tenant/producto/ID; agrupador comercial o sin lote, fecha de vencimiento civil, saldo físico y primera recepción |
| `InventoryOperation` | ID opaco de texto (UUID generado por el comando; default Prisma CUID); identidad compuesta Tenant/ID; principal autenticado, tipo, UUID del comando, versión del contrato, SHA-256, autoría y referencias al resultado confirmado |
| `InventoryMovement` | ID opaco de texto (UUID generado por el comando; default Prisma CUID); operación y ordinal; producto/lote, clase, cantidad, delta, saldo previo/posterior, autoría, snapshots y referencias de venta/consumo/compensación |
| `InventoryReturnLine` | ID opaco de texto (UUID generado por el comando; default Prisma CUID); operación, venta, línea, producto, cantidad completa, disposición y motivo; una fila por línea vendida |

- Importes: `Decimal(10,2)`, mismo límite que Finanzas (`99.999.999,99`). Costo no negativo; precio de venta positivo cuando corresponda. Cálculos monetarios en centavos enteros o decimal, nunca sumando floats del navegador. No se añade una moneda diferente ni una entidad contable nueva.
- Cantidades, saldos por lote, ordinal y versiones: `INTEGER`. Comandos aceptan unidades enteras, cantidades `1..2.147.483.647` y rechazan desbordamientos antes de escribir. PostgreSQL suma saldos con `BIGINT`; los lectores no convierten un agregado a `Number` sin verificar su rango seguro. Las versiones tampoco se reinician al llegar al límite: el comando debe rechazar el incremento que desborde.
- Fechas físicas: `TIMESTAMPTZ(3)`; instante UTC proporcionado por el reloj del servidor. Fechas comerciales de la venta conservan el modelo actual de Finanzas. Vencimiento: `DATE`, leído/escrito como `YYYY-MM-DD`, sin desplazamiento por convertir medianoche a la zona del navegador.
- Disponibilidad: excluir fechas `expiresOn <= día civil actual de Bogotá`; no usar `CURRENT_DATE` de una sesión SQL cuya zona podría ser distinta. El caso de uso pasa explícitamente el día obtenido del reloj y utilidades de negocio existentes. No hay check temporal ni job que borre automáticamente el saldo vencido.
- Código de barras: texto, no número; conserva ceros iniciales, se recorta y se valida antes de persistir. Códigos internos/comerciales: claves canónicas producidas por un único normalizador del servidor (`NFC`, trim y minúsculas), con límites de longitud. El cliente no decide estas claves. Su unicidad se aplica a las claves persistidas; SQL no pretende certificar por sí solo la normalización Unicode.
- `uses`: array de valores `retail`, `veterinary`, `grooming`; SQL limita el vocabulario, y el comando elimina duplicados. `category` es una etiqueta de producto, no `ServiceCategory`.
- `resultEvidence`: objeto JSON pequeño definido por cada contrato, máximo 4 KiB validado por aplicación; solo evidencia como versiones confirmadas o conteo sin diferencia. No copia costos de una respuesta administrativa completa, credenciales, historia clínica o datos bancarios.

## 3. Identidad, aislamiento y relaciones

Todos los modelos nuevos exigen `tenantId`. Relaciones entre Inventario y Finanzas llevan Tenant en la clave; no basta comprobar el ID de destino.

1. Producto: `UNIQUE(tenantId,id)`, `UNIQUE(tenantId,internalCodeKey)` y `UNIQUE(tenantId,barcode)`. PostgreSQL permite múltiples códigos de barras nulos; un código presente es único por establecimiento, incluso si el producto fue desactivado.
2. Lote: `UNIQUE(tenantId,productId,id)` y `UNIQUE(tenantId,productId,commercialKey)`. Un índice único parcial permite un solo agrupador `untracked` por producto. La política exige agrupador sin fecha/código, lote comercial sin vencimiento o lote comercial con fecha obligatoria, respectivamente.
3. Operación: `UNIQUE(tenantId,principalKey,kind,requestKey)`. La versión de contrato participa en la huella, no en una segunda identidad que permita repetir el mismo comando al actualizar el software. `principalKey` procede de Staff o identidad administrativa normalizada; no tiene FK borrable a Staff. Autoría histórica se conserva aunque cambie el perfil.
4. Movimiento: lote referenciado mediante `(tenantId,productId,lotId)`; operación mediante `(tenantId,operationId)`; origen de compensación mediante `(tenantId,sourceMovementId,productId,lotId)`. Esto impide cambiar producto, lote o establecimiento al compensar un movimiento; coincidencia con consumo original y atención se valida en el comando. Inventario no almacena contenido médico.
5. Finanzas: `Transaction` recibe un índice único `(tenantId,id)`; `TransactionItem`, una identidad `(tenantId,transactionId,id,productId)`. Las seis columnas nuevas son nulas en líneas históricas. Una línea catalogada exige Tenant, producto, clasificación `product`, snapshots completos y precio resuelto; su FK compuesta verifica el Tenant de la venta y del producto. Los checks explícitos evitan que un `NULL` burle esa relación.
6. Venta/retorno: un movimiento financiero referencia **la combinación completa** Tenant/venta/línea/producto. Un movimiento de retorno también referencia esa combinación en su marcador. `InventoryReturnLine.transactionItemId` es único globalmente, porque el ID de la línea ya lo es; la identidad compuesta adicional permite expresar la relación 1:1 en Prisma.
7. Referencia de atención: FK `(tenantId,appointmentId)` con índice único nuevo sobre `Appointment(tenantId,id)`. No se cambia la nulabilidad histórica de Appointment/Transaction ni se inventa Tenant para antecedentes sin establecimiento.

Los índices compuestos adicionales en tablas existentes contienen IDs globalmente únicos; no requieren depurar ventas antiguas ni fusionar datos para crearse. Las nuevas claves usan `RESTRICT`, sin borrado o actualización en cascada de hechos auditables. La relación histórica `TransactionItem.transactionId` conserva su `Cascade`; el trigger y las referencias nuevas impiden que ese cascade borre una línea catalogada. Anular una venta actualiza la cabecera financiera, no sus renglones ni los movimientos.

## 4. Operaciones confirmadas y grafo de inserción

Se concreta la decisión aprobada de almacenar **solo resultados terminales confirmados**. No hay filas durables `pending`/`failed` ni reserva persistida de stock.

1. El comando autentica y valida, calcula huella e IDs de los resultados, abre la transacción `SERIALIZABLE` y comprueba repetición.
2. Bloquea productos en orden estable y vuelve a leer permisos, módulos, precio/versiones y balances. Las devoluciones bloquean además la venta/líneas de origen; los consumidores financieros que concurran con una devolución deben usar el mismo orden de locks. Orden global: venta existente cuando corresponda → productos por ID; nunca productos → venta existente. Se reintenta `P2034` hasta tres veces con la misma identidad.
3. Inserta la operación terminal con referencia al resultado que va a crear. Las FK de `resultProductId` y `resultSaleId` son **DEFERRABLE INITIALLY DEFERRED**: el destino debe existir en el mismo Tenant antes del commit, aunque se inserte después. Prisma representa las relaciones; la migración conserva el detalle de deferral que su DSL no expresa.
4. Crea producto o venta/líneas, marcadores de retorno y movimientos en ese orden, con la operación como padre inmediato. Actualiza balances condicionados y revisión del producto en la misma transacción.
5. Commit publica simultáneamente resultado y efectos. Cualquier error revierte también la operación; nunca queda una operación confirmada sin haber confirmado sus efectos por la aplicación. La FK diferida impide confirmar referencias de resultado inexistentes.

La fila terminal insertada mientras la transacción está abierta **no es una confirmación visible ni un trabajo pendiente durable**. Lectores de otra conexión no la ven antes del commit. Una disputa sobre su identidad espera la transacción competidora; el perdedor revierte su trabajo y recupera el resultado solo si Tenant/principal/tipo/clave y huella coinciden. Únicamente la violación identificada de `InventoryOperation_request_key` activa esta recuperación; otro `P2002` conserva su significado de conflicto real.

`GET` sin resultado todavía no demuestra que un POST en curso haya fallado. Navegador conserva clave e intención congelada, consulta recuperación y reintenta el mismo comando; no emite una venta nueva. La respuesta recuperada pasa autorización actual y alcance de lectura financiera; distingue evidencia de la operación de estado/saldo actual. Eventos se certifican después del commit con la infraestructura ya aprobada, sin prometer nueva entrega durable entre commit y publicación.

## 5. Restricciones: base de datos y aplicación

| Garantía | Base de datos propuesta | Validación obligatoria del comando |
| --- | --- | --- |
| Cantidad y saldo | Cantidad positiva; saldos no negativos; `after = before + delta`, aritmética ampliada; signo compatible con clase | Movimiento, balance y revisión cambian juntos; cadena de saldos bajo lock; stock suficiente y límites numéricos |
| Aislamiento | FK compuestas, columnas obligatorias, checks que cierran el bypass por nulos | Identidad y Tenant autenticados; permisos/módulos actuales, incluidas recuperación y referencias de atención |
| Unidades y lotes | Forma/política del lote; presentación/política bloqueadas tras primer movimiento; identidad y vencimiento del lote inmutables | Nunca guardar un lote vacío como resultado confirmado de una entrada fallida; primera recepción estable; FEFO/FIFO y vencimiento civil |
| Repetición | Unicidad de identidad de operación y de retorno por línea | Hash canónico, repetición con la misma intención; rechazo de misma clave y contenido distinto |
| Venta catalogada | Referencias y snapshots obligatorios; total de línea igual a cantidad × precio; snapshot inmutable | Precio central, versión esperada, autorización de venta, selección completa de lotes y suma por línea igual a cantidad financiera |
| Compensación de consumo | Mismo Tenant/producto/lote y origen existente | Origen de clase consumo, misma operación original, área autorizada; suma de compensaciones no supera cantidad consumida |
| Devolución | Un marcador por línea; origen y marcador en mismo Tenant/venta/línea/producto; delta positivo o cero según clase | Venta manual anulada; línea completa; un movimiento por asignación original con su cantidad; disposición común y coherente; lote apto para reponer |
| Conteo | Pareja cantidad/revisión no negativa; solo clases de ajuste admiten esos datos | Revisión no cambió; calcular diferencia sobre el conjunto contado; cero diferencia produce evidencia en operación, ningún movimiento de cantidad cero |
| Auditoría | Triggers rechazan UPDATE/DELETE de movimientos, operaciones y marcadores; no borrar producto/lote ni snapshots de venta catalogada | Crear compensaciones; snapshots coinciden con producto, lote y actor leídos; no copiar nueva información sensible a registros viejos |

Los checks SQL no sustituyen las reglas de dominio ni verifican sumas entre varias filas. En particular, crear manualmente una operación o marcador con SQL no certifica un recorrido de venta/devolución válido: esos recorridos se comprueban por los casos de uso dentro de la unidad de trabajo. No hay promesa de aislamiento frente a un administrador de PostgreSQL que altere tablas o desactive triggers. Ninguna ruta HTTP ni repositorio alternativo puede modificar balance sin el comando correspondiente.

Clases de movimiento: `entry`, `sale`, `consumption`, `adjustment_in`, `adjustment_out`, `consumption_correction`, `return_restock`, `return_discard`. La última recibe mercancía no apta y registra delta cero, sin incorporarla a disponible. Ajustes/correcciones/retornos requieren motivo; consumo requiere atención o motivo. Entrada exige costo unitario. Autoría usa los roles existentes `admin`, `receptionist`, `vet`, `groomer`; el área operativa usa `veterinary`/`grooming`.

## 6. Índices y lectores

- Catálogo: `(tenantId,active,name)` y lookup exacto por código/código de barras. Búsqueda textual contiene/acento continúa en adaptador lector con parámetros y paginación máxima 100, sin ampliar el alcance a un motor de búsqueda.
- Selección por producto: `(tenantId,productId,expiresOn,firstReceivedAt,id)`; el query especifica vencimiento ascendente `NULLS LAST`, primera recepción e ID. El orden no depende del orden implícito del índice.
- Vencimientos del establecimiento: índice parcial `(tenantId,expiresOn,productId)` para lotes con saldo y fecha. Próximos: mañana a los siguientes 30 días; saldo vencido se muestra separado hasta retirarlo por ajuste.
- Historial: `(tenantId,productId,occurredAt,id)`, ordinal único por operación, índices de origen de compensación, línea vendida y retorno. Cursor estable por fecha/ID; no reconstruir precios históricos desde producto actual.
- Recuperación: lookup único de operación; índice Tenant/confirmación/ID para lectura administrativa. Venta de confirmación tiene referencia única por Tenant. La autorización de costos no depende de esconder columnas en el navegador: lectores producen DTO permitidos.

## 7. Migración e integración aprobables

La migración propuesta crea cinco tablas, añade seis columnas opcionales a TransactionItem y tres identidades compuestas sobre tablas existentes. No modifica cantidades, precios, categorías, Tenants, comisiones o cobros de sistema existentes; no convierte productos escritos a mano en catálogo y no genera stock inicial.

Después de aprobar esta etapa:

1. Integrar el borrador en `prisma/schema.prisma`, conservar esquema/extension `vector` y revisar diff completo. Preparar una migración con timestamp posterior a las actuales; combinar DDL Prisma con los checks/índices/triggers de este borrador, verificando que no se pierdan las FK diferidas.
2. Ejecutar `prisma validate`, `prisma generate` y `prisma migrate deploy` en Docker **local**, sin `db push`. Primero respaldar el estado local y verificar migraciones aplicadas. No poblar el catálogo desde ventas anteriores; productos empiezan con cero y su primera existencia nace de una entrada explícita.
3. Implementar contratos/casos de uso, resolución de precios, nuevas capacidades de acceso y proxy; añadir `inventory_consume` a las listas de permisos vigentes sin crear un quinto rol. Staff ya conserva permisos en su estructura actual; esta adición no requiere otra tabla de credenciales.
4. Integrar Inventario y el selector de productos del POS; conservar líneas manuales claramente identificadas sin control de stock. Notas clínicas/peluquería no producen salidas por sí mismas.
5. Ejecutar pruebas de aplicación contra PostgreSQL real: venta concurrente de última unidad, carrito mixto con fallo/rollback, reintentos, recuperación tras timeout, alteración de precio/stock, permisos, expiración Bogotá, retorno completo y consumo/corrección. Probar recorrido UI con los perfiles habilitados y datos de prueba locales.
6. Evaluar versión y documentar evidencia real. Commit/push/despliegue se realizan según la autorización vigente para publicación; esta aprobación de diseño no ejecuta ni anuncia un despliegue en VPS.

Preflight de VPS, cuando se publique: respaldo restaurable, migraciones previas, PostgreSQL soportado y permisos de creación de índices/FK/triggers; versión de cliente Prisma acorde; construir backend/frontend y aplicar migración en orden. Con datos nuevos reales, rollback de aplicación conserva estas tablas/columnas y hechos; no se ofrece una migración descendente que borre movimientos. Los triggers no se desactivan para operar la aplicación. Confirmaciones catalogadas no vuelven a la ruta antigua que ignoraba stock.

## 8. Evidencia de preparación

Ejecutada el 2026-10-02:

```text
npx --no-install prisma validate --schema docs/architecture/inventory-schema-draft.prisma
The schema at docs/architecture/inventory-schema-draft.prisma is valid
exit_code: 0

node scripts/validate-inventory-schema-draft.cjs
PASS additive DDL on PostgreSQL 18.6 (Debian 18.6-1.pgdg12+2)
Design checks: 25 passed, 0 failed (not an inventory application test)
ROLLBACK verified: no schema, tables or fixtures persisted
exit_code: 0
```

Los 25 checks comprueban DDL aditivo, conservación de línea histórica, rechazo de precios/costos no finitos, saldo negativo, lote entre establecimientos, agrupador único, vencimiento requerido/inmutable, ceros del barcode/unicidad por Tenant, nulos que intentarían evadir aislamiento, venta extranjera, snapshot inmutable, identidad repetida, operación inmutable/tipo desconocido, movimiento inmutable, presentación usada, aritmética de saldo, retorno único/conservado y resultados diferidos válidos/huérfanos. El test se limita al esquema nuevo y a modelos de frontera mínimos, no es prueba de migración completa sobre una copia de la base ni prueba del producto implementado.

Regresión del estado actual, también ejecutada en esta preparación:

```text
frontend: npm run lint
> frontend@0.1.0 lint
> eslint
exit_code: 0, sin diagnósticos

node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs
tests 12 / pass 12 / fail 0 / exit_code: 0

backend: npm test -- --runInBand src/contexts/finance/__tests__/pos
Test Suites: 3 passed, 3 total
Tests: 18 passed, 18 total
exit_code: 0

git diff --check
exit_code: 0
```

Revisión de siete documentos: 44 enlaces locales, cero rotos; los documentos de diseño cierran con Decisiones arquitectónicas diferidas. Lint y estas 30 pruebas cubren el POS existente; no certifican una interfaz de Inventario todavía no construida.

En esa validación previa a la aprobación no se aplicó DDL a `public`, no se crearon existencias de negocio ni se modificó el cliente Prisma. Después de la aprobación se aplicaron las migraciones locales con respaldo previo; las pruebas del aplicativo escriben únicamente en una base desechable. Ver [evidencia de implementación](../history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md).

## Decisiones arquitectónicas diferidas

Se mantienen las exclusiones aprobadas: unidades fraccionarias/conversión de presentación, varias bodegas, valoración contable, compras/cuentas por pagar, devoluciones parciales de ventas activas, normativa de prescripción, operación offline y nuevo outbox productor. No se crean campos o tablas para prometerlas.

El diseño físico actual resuelve tipos, claves, índices, restricciones, orden de escritura y migración; no difiere una garantía aprobada de stock/aislamiento/idempotencia. Las reglas agregadas asignadas explícitamente al comando en §5 deben implementarse y probarse antes del cierre.
