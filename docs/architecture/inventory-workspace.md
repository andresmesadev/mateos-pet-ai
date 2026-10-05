# Inventario de productos e insumos

Fecha: 2026-10-02.

## Estado y aprobaciones

- **Etapa 1 — Definición funcional:** alcance base aprobado por el responsable del producto en esta conversación: catálogo, existencias, lotes/vencimientos, conexión con POS y permisos por perfil.
- **Etapa 2 — Casos de uso:** aprobada explícitamente el 2026-10-02 mediante «acepto empieza», en respuesta a la solicitud de aprobación de las reglas documentadas.
- **Etapa 3 — Arquitectura técnica:** [aprobada explícitamente](inventory-technical-design.md) el 2026-10-02 mediante «acepto», en respuesta a su solicitud de aprobación.
- **Etapa 4 — Modelo de persistencia:** [aprobado explícitamente](inventory-persistence-model.md) el 2026-10-02 mediante «Sí, apruebo el modelo de datos».
- **Etapa 5 — Esquema físico:** [aprobado explícitamente](inventory-physical-schema.md) el 2026-10-02 mediante «Sí, apruebo; empieza la implementación».
- **Implementación:** integrada y migrada en PostgreSQL local, versión 2.42.0. Ver [informe y evidencia](../history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md). Publicación en GitHub y despliegue en VPS pendientes.

Se sigue la secuencia de diseño de `docs/PHASE_2_EXECUTION_RULE.md`, usada aquí explícitamente para esta capacidad operativa solicitada. No se crea una fase ni se reabre una fase cerrada. La aceptación del alcance base no sustituye la aprobación de las etapas posteriores.

## 1. Definición funcional — alcance base aprobado

### Problema y objetivo

El negocio registra productos vendidos por descripción, cantidad y precio, pero no tiene catálogo de productos ni existencias verificables. Esto obliga a llevar cuentas externas, dificulta conocer qué se puede vender y permite perder trazabilidad de medicamentos, alimentos, accesorios y productos de baño.

Inventario será una capacidad del Dominio Operativo por Establecimiento. Debe poder gestionar mercancía para venta e insumos usados al prestar servicios. No necesita una historia clínica para funcionar.

### Trabajo que simplifica

- Buscar productos y precios sin escribir cada venta desde cero.
- Conocer cantidades disponibles antes de confirmar una venta o consumo.
- Registrar entradas, salidas y correcciones con responsable y motivo.
- Encontrar productos con pocas unidades o próximos a vencer.
- Mantener enlazados el comprobante de venta y sus salidas de mercancía.

### Capacidades aceptadas

1. **Catálogo:** nombre, código interno, código de barras opcional, categoría, presentación/unidad, costo y precio de venta.
2. **Existencias:** entradas de mercancía, ajustes justificados, consulta de disponibilidad y stock mínimo.
3. **Lotes y vencimientos:** trazabilidad para productos que la necesiten, incluidos medicamentos.
4. **POS:** selección o escaneo de productos y descuento de existencias al confirmar una venta. La anulación económica distingue la devolución física.
5. **Acceso:** administración mantiene catálogo/costos/ajustes; recepción vende y consulta disponibilidad; el consumo profesional requiere autorización explícita.

### Límites conservados

Tenant sigue siendo la única unidad de aislamiento. El catálogo de servicios continúa describiendo consultas, baños y cortes; un servicio no es mercancía en stock. La resolución de precios conserva su autoridad única y las comisiones siguen siendo hechos inmutables.

La decisión anterior de ofrecer Pet shop con ventas manuales sin inventario fue el alcance de Perfiles y módulos, no una incapacidad permanente del producto. Esta petición aporta un consumidor real para el inventario diferido. El ADR 015 registra la evolución antes de incorporar entidades a código.

## 2. Casos de uso — aprobados

Las siguientes reglas concretan el alcance aceptado y fueron aprobadas explícitamente el 2026-10-02. Una modificación posterior requiere registrar el cambio y su aprobación; la arquitectura no puede ampliar estas reglas silenciosamente.

### 2.1 Actores, módulos y permisos

| Operación | Administrador | Recepción y caja | Veterinario / peluquero |
| --- | --- | --- | --- |
| Consultar catálogo de venta y disponibilidad | Sí | Sí, con Pet shop activo | Con permiso de Caja y Pet shop activo |
| Crear/editar/desactivar producto; cambiar costo y precio | Sí | No | No |
| Registrar entrada, conteo, ajuste o devolución | Sí | No | No |
| Vender productos | Sí, con Pet shop activo | Sí, con Pet shop activo | Con permiso de Caja y Pet shop activo |
| Consultar insumos de su área | Sí | Solo información operativa autorizada | Con habilitación explícita de consumo y módulo profesional activo |
| Registrar consumo de insumos | Sí, para áreas activas | No | Con habilitación explícita, en su área activa |
| Consultar costos y movimientos completos | Sí | No | No |
| Anular venta y confirmar devolución | Sí, respetando reglas financieras | No | No |

- Inventario puede utilizarse en Veterinaria o Peluquería sin activar Pet shop, para controlar insumos. Vender productos mantiene el requisito vigente de Pet shop; cobrar consultas o baños no lo requiere.
- Se conservan los cuatro perfiles existentes y una sola cuenta para el administrador que también atiende. No se agrega otro perfil obligatorio.
- La nueva habilitación para consumo será concedida/revocada por administración; nombre técnico y contrato se decidirán en la Etapa 3. Tener acceso a Caja no concede ajustes de stock ni consumo profesional automáticamente.
- Un producto podrá estar destinado a venta, a consumo de una o ambas áreas profesionales, o a ambos usos. Cada operación valida su destino, módulo y autorización actuales.
- Desactivar un módulo conserva antecedentes. Bloquea nuevas ventas/consumos propios de ese módulo; permite a administración consultar y corregir existencias conservadas.
- Todas las operaciones validan establecimiento, identidad vigente y permisos en el servidor. Ningún costo se entrega a un perfil no autorizado, aunque la pantalla lo oculte.

### 2.2 Registrar y mantener un producto

**Actor:** administrador.

**Flujo:** registrar nombre, categoría, código interno, código de barras opcional, presentación, usos, costo, precio de venta si corresponde, stock mínimo y si requiere lote/vencimiento. El producto comienza con cero existencias; la mercancía inicial se registra como entrada identificada.

**Reglas aprobadas:**

- Código interno y código de barras no vacíos identifican un único producto dentro del establecimiento; se pueden repetir en otro Tenant.
- Un producto destinado a venta necesita un precio positivo. El costo admite cero; las existencias y cantidades usan unidades enteras de la presentación registrada.
- La primera entrega vende/consume presentaciones completas: por ejemplo, una caja, un frasco o una bolsa definidos como una unidad. No convierte automáticamente cajas a tabletas ni frascos a mililitros.
- Cambiar nombre/precio/costo no reescribe ventas ni movimientos anteriores. Cambiar presentación o política de lotes/vencimiento después de movimientos requiere un producto nuevo; no reinterpreta unidades históricas.
- Desactivar conserva todos los antecedentes. Bloquea nuevas ventas, consumos y entradas ordinarias; admite devolución física y corrección administrativa justificada. No hay borrado físico de productos con movimientos.

**Hechos de negocio candidatos:** `ProductoRegistrado`, `ProductoActualizado`, `ProductoDesactivado`.

### 2.3 Registrar entrada y stock inicial

**Actor:** administrador.

**Flujo:** seleccionar producto, ingresar cantidad, costo de esta entrada, referencia opcional de proveedor/documento y motivo. Para productos controlados, identificar lote y fecha de vencimiento. Confirmar y mostrar nuevas existencias junto con el movimiento persistido.

**Reglas aprobadas:**

- Cantidad positiva entera. Cada entrada registra costo y autor propios; no modifica costos históricos.
- Stock inicial es una entrada con motivo «Existencias iniciales»; no se escribe directamente un saldo.
- Si el producto exige vencimiento, se exige lote y fecha; si exige solo lote, se exige lote. La fecha es un día civil del establecimiento. Se conserva el mismo lote comercial y no se acepta reutilizarlo con otra fecha de vencimiento.
- No admitir entradas ordinarias vencidas; la corrección de mercancía física vencida va por ajuste administrativo y nunca habilita su venta.
- Una entrada no genera automáticamente un egreso, deuda de proveedor ni pago. Registrar mercancía y registrar dinero son hechos diferentes.

**Hecho candidato:** `EntradaDeInventarioRegistrada`.

### 2.4 Consultar inventario y alertas

**Actores:** según matriz de permisos.

**Flujo:** buscar por nombre, código o escaneo; filtrar categoría, uso y estado. Mostrar presentación, cantidades físicas, cantidades disponibles y precio de venta cuando proceda. Administración puede ver lotes, costos, movimientos y responsable.

**Reglas aprobadas:**

- Distinguir existencias físicas de unidades disponibles para salida. Los lotes vencidos continúan físicamente registrados, pero no están disponibles para venta/consumo.
- Un lote con vencimiento igual o anterior al día actual de Bogotá se considera vencido para operaciones nuevas. No depende del reloj del navegador.
- Alerta de stock bajo cuando disponibilidad sea igual o inferior al mínimo configurado; umbral cero avisa de agotamiento.
- «Próximos a vencer» muestra lotes con unidades positivas y vencimiento entre mañana y los próximos 30 días. El vencimiento no descuenta mercancía automáticamente.
- Búsqueda y permisos se verifican también en el backend; una respuesta antigua no autoriza vender.

### 2.5 Preparar y confirmar una venta en POS

**Actor:** usuario con Caja y Pet shop activos, según perfil.

**Flujo:** seleccionar/escanear producto, añadir cantidad al carrito existente, revisar precio y total, elegir método de pago y confirmar. El resultado contiene venta persistida y salidas de inventario vinculadas a sus artículos.

**Reglas aprobadas:**

- Preparar un carrito o guardar su borrador no reserva ni descuenta mercancía.
- El servidor vuelve a comprobar producto activo, permisos, precio vigente y stock disponible al confirmar. Si cambió el precio mostrado, solicita revisar el carrito; no cobra silenciosamente otro importe.
- El precio de producto se resuelve mediante la autoridad central de precios. El contrato para productos se diseña en Etapa 3, sin reutilizar indebidamente tarifas por mascota o cambiar la jerarquía de servicios.
- Las líneas de catálogo guardan producto, presentación, descripción, cantidad y precio como evidencia de ese momento. No admiten convertirlas a texto libre para eludir un rechazo de stock.
- Se venden primero las unidades disponibles cuyo lote venza antes; lotes sin vencimiento se consumen por antigüedad de entrada. Se muestran los lotes efectivamente usados en el detalle autorizado.
- Venta y salidas se confirman juntas: o se registran completas o no se registra ninguna. Si dos operadores intentan vender la última unidad, solo una operación puede completarse; no se admite stock negativo.
- Una confirmación repetida de la misma operación devuelve el resultado original, sin otro cobro ni salida. Un resultado de red incierto se puede consultar; no se resuelve únicamente con un bloqueo frontend.
- En una venta con varios productos y servicios, un rechazo de cualquier línea rechaza la operación completa. No descarta renglones silenciosamente.
- Ventas manuales antiguas conservan sus datos y no reciben stock retroactivo. La entrada manual existente se identifica como «Sin control de inventario» y no representa disponibilidad de un producto catalogado.
- Completar una cita mantiene su cobro/comisión existentes; no añade automáticamente otra venta o salida por los insumos utilizados.

**Hechos candidatos:** salida de inventario por venta vinculada al hecho financiero existente. Su certificación y entrega se decidirán en Etapa 3; un evento posterior no sustituye la atomicidad necesaria entre venta y stock.

### 2.6 Registrar consumo de insumos en una atención

**Actor:** administrador o profesional con habilitación explícita, área activa y atención autorizada.

**Flujo:** seleccionar insumo destinado a su área, cantidad y atención cuando exista; confirmar consumo. El profesional ve disponibilidad y el resultado, sin recibir costos administrativos.

**Reglas aprobadas:**

- Cada consumo es una salida identificada con producto, cantidad, lote cuando corresponde, autor, fecha, área y referencia de atención o motivo obligatorio.
- Se aplican las mismas prohibiciones de lotes vencidos y stock negativo.
- El producto no necesita estar destinado a venta ni Pet shop activo para ser consumido.
- Registrar consumo no cobra otra vez el insumo incluido en un servicio ni modifica una historia clínica. La receta o nota médica no descuenta inventario automáticamente.
- Un profesional solo registra consumos para atenciones que pueda operar o para un motivo dentro de su área autorizada. Administración puede corregir mediante un nuevo movimiento compensatorio, sin borrar el anterior.

**Hecho candidato:** `ConsumoDeInventarioRegistrado`.

### 2.7 Contar existencias y registrar ajustes

**Actor:** administrador.

**Flujo:** revisar saldo actual, registrar cantidad física contada y motivo —diferencia de conteo, daño, pérdida o corrección—, revisar diferencia y confirmar el movimiento.

**Reglas aprobadas:**

- No se edita ni elimina un movimiento anterior. Toda corrección deja un nuevo movimiento, responsable y motivo.
- El saldo presentado al contar debe seguir vigente al confirmar; si hubo movimientos intermedios, se solicita revisar la diferencia.
- Lotes controlados se ajustan por lote. Daños o mercancía vencida retirada se registran como salida, sin simular una venta.
- Un ajuste no genera cobro, egreso ni comisión automáticamente.
- Repetir la confirmación no duplica el ajuste.

**Hecho candidato:** `AjusteDeInventarioRegistrado`.

### 2.8 Anular una venta y gestionar devolución física

**Actor:** administrador.

**Flujo:** usar la anulación financiera existente con motivo y sus restricciones de cierre. Mostrar separadamente las unidades que salieron y preguntar si fueron devueltas físicamente. Registrar la devolución solo después de confirmarla.

**Reglas aprobadas:**

- Anular dinero no repone stock por sí mismo. Una venta anulada puede seguir sin devolución física.
- La primera entrega admite devolución completa por línea de producto de una venta anulada. Devoluciones comerciales parciales de una venta activa requieren diseño financiero propio y quedan diferidas.
- Se devuelven al mismo producto/lote las unidades efectivamente vendidas, como máximo una vez. Una devolución posterior puede registrarse aunque la anulación fue en otra fecha.
- Solo mercancía íntegra y apta se repone disponible. Mercancía vencida o dañada no se ofrece de nuevo: se deja constancia de la devolución no reintegrable. El flujo no supone que todo producto devuelto pueda revenderse.
- Conservar venta, anulación, salida y devolución como antecedentes distintos. Una devolución física posterior no reabre ni reescribe un cierre financiero.
- El sistema registra hechos; no ejecuta una devolución bancaria ni atribuye reembolso externo automático.

**Hecho candidato:** `DevolucionDeInventarioRegistrada`.

### 2.9 Escenarios de aceptación de esta etapa

1. Pet shop vende un producto del catálogo y la disponibilidad disminuye exactamente una vez por las unidades vendidas.
2. Veterinaria sin Pet shop controla y consume insumos; no obtiene por ello permiso de venta minorista.
3. Peluquería sin Veterinaria registra insumos de su área sin acceder a historia clínica.
4. Recepción vende y consulta disponibilidad; no puede obtener costos, registrar entrada, ajustar stock ni anular ventas.
5. Profesional con Caja puede vender si hay Pet shop; necesita habilitación independiente para consumo. Sin esa habilitación, la operación se rechaza en servidor.
6. Dos ventas concurrentes de la última unidad producen una venta y un rechazo verificables, sin stock negativo.
7. Confirmación repetida o recuperación tras fallo de red conserva una sola venta y salida.
8. Un lote vencido aparece físicamente pero no está disponible; la fecha se interpreta con el día del establecimiento.
9. Un cambio de precio entre selección y confirmación pide revisión y no cobra otro monto silenciosamente.
10. Anulación sin devolución no incrementa disponibilidad. Confirmar la devolución apta una vez sí la incrementa; repetir no la duplica.
11. Editar/desactivar producto preserva comprobantes y movimientos; no reinterpreta cantidades anteriores.
12. Referenciar producto, lote, venta o atención de otro Tenant se rechaza sin filtrar información ajena.

## Verificación de esta preparación documental

Ejecutada el 2026-10-02. Esta preparación modifica documentación; no implementa ni prueba Inventario.

- Desde `frontend/`, `npm run lint`: salida `> frontend@0.1.0 lint` / `> eslint`, código de salida 0.
- Desde la raíz, `node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs`: `tests 12`, `pass 12`, `fail 0`, código de salida 0. Son pruebas existentes del POS, no pruebas de la capacidad nueva.
- `git diff --check`: código de salida 0; avisos de normalización LF/CRLF en los cambios anteriores del POS, sin errores de espacios.
- Enlaces locales entre los tres documentos de Inventario, modelo conceptual y ADR: cero enlaces rotos. Estados de aprobación explícitos; sin declaración de implementación terminada.

## Próximas etapas

Las cinco etapas fueron aprobadas antes de implementar. Catálogo, existencias, movimientos, consumo, devolución y confirmación POS están integrados localmente. La validación de diseño que precede a esta sección es histórica; la evidencia del aplicativo está en el [informe de implementación](../history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md).

## Decisiones arquitectónicas diferidas

- Unidades fraccionarias, fraccionamiento de envases y conversión de presentaciones.
- Compras completas, órdenes de compra, cuentas por pagar y pagos a proveedores.
- Valoración contable, costo promedio/FIFO, margen y costo de ventas contable.
- Reservas de mercancía antes del cobro, múltiples depósitos o transferencias entre establecimientos.
- Devoluciones parciales con reembolso de una venta activa, cambios de mercancía y notas fiscales.
- Restricciones por receta, prescripción o normativa farmacéutica; clasificar un producto como medicamento no crea esas capacidades.
- Campañas, automatizaciones de reposición o mensajes externos ante alertas.

No son capacidades disponibles ni tareas omitidas de esta entrega. Si un consumidor real requiere alguna, se resolverá expresamente con su diseño y ADR correspondiente.
