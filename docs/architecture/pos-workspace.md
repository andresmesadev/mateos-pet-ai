# Caja y ventas: espacio de trabajo POS

## Definición funcional

Mejora del adaptador frontend existente, solicitada el 2026-10-02. Recepción y los usuarios con acceso a Caja necesitan preparar una venta completa, revisar importes, registrar el método de pago y consultar su comprobante sin perder el contexto. El administrador también necesita confirmar los datos de cobro de las citas terminadas.

## Casos de uso

- Venta de mostrador: seleccionar opcionalmente propietario/mascota; ingresar servicios y/o productos según módulos activos; validar cada renglón; registrar el cobro con el comando existente. Un renglón incompleto nunca se descarta silenciosamente.
- Pago: elegir efectivo, transferencia, tarjeta u otro. En efectivo, calcular cambio a partir del importe recibido. Este cálculo pertenece a la interfaz y no agrega saldo, deuda ni movimientos de dinero al modelo. El operador confirma que recibió el pago; la aplicación no procesa tarjetas o transferencias.
- Comprobante: mostrar la respuesta persistida del servidor, fecha, identificador, artículos, total, medio de pago y operador cuando esté disponible. Permitir imprimir y empezar otra venta. Es un comprobante interno, no una factura electrónica.
- Caja operativa: consultar movimientos de hoy, buscar por propietario/mascota/descripción, filtrar los cobros de citas cuyos datos necesitan revisión y confirmar su método de pago. Estos cobros ya cuentan como ingreso bajo ADR 007: no se describen como deuda o saldo pendiente.
- Administración: conservar egresos, historial y reportes restringidos. Mostrar la revisión operativa de hoy también al administrador, separada del resumen financiero por fecha.

## Arquitectura técnica

Componentes cliente usan exclusivamente `proxyUrl`, conservando `tenantId` de selección administrativa con `useTenant`. La identidad y los permisos siguen verificados en backend. `SaleForm` reutiliza POST `/transactions`; `OperationalCash` reutiliza GET `/cash/operational` y POST `/transactions/:id/settle`. El recibo usa la transacción devuelta, sin reconstruir un éxito antes de persistir. Búsqueda con debounce y cancelación de peticiones para evitar resultados obsoletos. Bloqueo inmediato de doble envío y estado de resultado incierto ante fallo de red.

Dirección visual: blanco #ffffff, fondo #f5f8f8, texto #1b353b, verde #137568, borde #dce8e5 y ámbar para revisión. Tipografía existente Geist. Una superficie para cliente y carrito, un panel lateral fijo para total y pago; en móvil se apilan con controles etiquetados. El importe y la acción de cobrar tienen prioridad sobre adornos o métricas.

## Persistencia

Reutiliza `Transaction` y `TransactionItem`, incluidas sus instantáneas de autor y `itemKind`. Conserva el aislamiento por Establecimiento y los módulos activos. No cambia la resolución de precios, las comisiones ni los cobros de sistema. Efectivo recibido y cambio se muestran únicamente en la sesión de cobro; no se atribuyen a comprobantes históricos.

## Esquema físico

Sin cambios de Prisma ni migraciones. El backend mantiene sus límites: importes de hasta 99.999.999,99, dos decimales y cantidades enteras positivas. El frontend valida esos mismos límites antes de enviar.

## Ampliación aceptada: catálogo, borrador e historial

1. **Función:** seleccionar servicios activos, recuperar la venta al navegar entre pestañas, consultar operaciones por fecha/cliente/mascota/método y anular ventas manuales desde administración.
2. **Casos de uso:** catálogo con tarifa sugerida para la mascota seleccionada, editable antes del cobro; borrador que nunca representa una venta registrada; historial con comprobante persistido y motivo de anulación obligatorio. Una cita completada se revisa en Caja y no se registra otra vez desde el catálogo.
3. **Arquitectura:** GET `/cash/context` deriva una clave opaca del actor autenticado, su versión de credencial y el establecimiento efectivo del backend. GET `/cash/catalog` filtra módulos activos y delega toda sugerencia de precio a `price-resolver.service.js`. El historial usa GET `/transactions` y el comando existente POST `/transactions/:id/void`, restringido a administración. No se modifica su frontera de cierre diario ni se permite anular cobros de sistema.
4. **Persistencia:** borrador en `sessionStorage` por contexto autenticado, disponible en la misma pestaña durante 12 horas; no se envía al servidor hasta confirmar el cobro. Antes de enviar se marca como resultado pendiente de verificar: una recarga o fallo de red no habilita repetirlo automáticamente. El éxito elimina el borrador. Un rechazo explícito 4xx lo devuelve a preparación. Los resultados inciertos requieren revisar Caja y descartar explícitamente antes de preparar otra venta. Cerrar sesión desde el dashboard limpia los borradores para proteger un equipo compartido; cerrar la pestaña también termina su almacenamiento. Sin tarjeta ni contraseñas almacenadas.
5. **Esquema:** sin nuevas tablas ni migraciones. Se reutilizan Service, PriceRule, Pet, Transaction y TransactionItem. La anulación conserva los importes y artículos originales junto con `status`, `voidedAt` y `voidReason`. La lista está limitada a 200 registros por consulta; se informa el límite y se ofrece acotar fechas. No se presenta su suma como total contable del período.

## Decisiones arquitectónicas diferidas

La exclusión histórica de Inventario y de idempotencia durable que figura abajo se amplió posteriormente mediante el ADR 015/016 y las cinco etapas de Inventario aprobadas. Catálogo y venta atómica con stock ya están integrados; ver [informe de implementación](../history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md).

Inventario y catálogo de productos continúan fuera del alcance documentado. Facturación fiscal, pagos mixtos, terminal bancaria, apertura de turno y conciliación física de efectivo requieren un diseño de dominio propio; esta mejora no los representa como capacidades disponibles. La idempotencia durable de ventas requiere un contrato de servidor propio; este adaptador evita dobles envíos concurrentes y pide revisar Caja si no puede confirmar el resultado de un envío.

## Nueva venta con Inventario — ajustes de interfaz aceptados (2026-10-02)

El responsable aprobó conjuntamente cuatro mejoras de la operación existente: catálogo visible al abrir, carrito compacto con cantidades rápidas, avisos por producto y pago más ágil. No añaden una entidad ni una regla financiera; reutilizan los casos de uso y el esquema de Inventario ya aprobados.

- **Función y casos de uso:** buscar productos/servicios desde arriba, escanear un código, sumar una unidad del mismo SKU sin crear otra fila, variar cantidad con −/+, ver saldo consultado y corregir solo la fila afectada. Las descripciones/precios del catálogo de productos permanecen controlados; los servicios mantienen su precio editable. Los artículos manuales quedan en una opción secundaria explícita.
- **Arquitectura:** consultas autenticadas por `proxyUrl` a los lectores existentes. La disponibilidad mostrada es una consulta, no reserva de stock. Antes del primer envío se revisan los productos actuales; el servidor conserva la validación final atómica. Un escaneo con precio/versiones diferentes pide revisión y nunca reemplaza el precio silenciosamente. Reintentar un resultado incierto omite esa revisión previa y utiliza el cuerpo/clave ya congelados, para recuperar una venta que pudo haber descontado stock.
- **Pago y teclado:** importes rápidos sustituyen el efectivo recibido y recalculan cambio/faltante. F2 lleva al buscador, F4 al pago y F8 enfoca Confirmar cobro; solo Enter en ese botón o su clic confirma. Enter en campos de cantidades, cliente o efectivo no cobra accidentalmente. Los atajos se limitan al formulario de venta.
- **Persistencia y esquema:** sin migraciones adicionales. Se conserva el borrador por identidad/establecimiento y la recuperación durable existente. La cantidad fusionada mantiene la identidad de la fila y su instantánea de precio; las cantidades de SKU repetidos en borradores anteriores también se verifican agregadas.

Validación de estos ajustes: [Nueva venta con Inventario](../history/POS_INVENTORY_UX_VERIFICATION.md).

### Corrección de presentación solicitada (2026-10-02)

El responsable reemplazó la apertura automática del listado por una presentación bajo demanda: el buscador permanece disponible; los resultados aparecen al escribir o pulsar **Ver servicios** / **Ver catálogo de productos**. Borrar la búsqueda, ocultar el catálogo o agregar un artículo despeja la lista. Se mantienen los módulos y permisos existentes. La apertura automática del selector de insumos en otros flujos no cambia. Sin cambios de dominio, contratos de API, persistencia ni esquema.

### Caja del día: operación y resumen administrativo (2026-10-03)

La lista de cobros de hoy permite combinar búsqueda y filtros de revisión/medio. Los medios confirmados excluyen los IDs `toReview` de la lectura existente: una cita completada con método predeterminado permanece en **Por revisar**, conservando su ingreso bajo ADR 007. La revisión invoca únicamente el comando `settle` existente y actualiza la lista y el resumen, sin registrar otro cobro.

Con permiso `finance`, el resumen administrativo queda visible con selector de fechas reales hasta hoy, ingresos, egresos y diferencia. Usa las filas completas de la lectura existente para conservar centavos, evitando sus cabeceras redondeadas. El día actual no repite la lista de ingresos ni el desglose de medios del panel operativo. En fechas anteriores se muestra la lista histórica y se advierte que sus métodos guardados pueden incluir valores predeterminados. Los egresos incluyen categoría, medio, nota y hora.

No representa apertura, cierre de turno, arqueo de efectivo ni cálculo de utilidad. Sin entidades, casos de uso, rutas, contratos o migraciones adicionales. El límite de 200 filas pertenece a la lectura operativa; las cifras administrativas usan la colección completa. Evidencia: [Caja del día](../history/POS_CASHBOX_UI_VERIFICATION_20261003.md).

La revisión final unifica el estado vacío de egresos en una sola superficie con **Registrar egreso**. **Diferencia del día** conserva la fórmula ingresos menos egresos, con explicación desplegable. `CashboxExpenses` recibe únicamente las filas administrativas autorizadas y aplica filtros locales de categoría/medio y notas desplegables, sin cambiar los totales ni crear movimientos. El cambio de fecha reinicia sus filtros. Sin persistencia ni esquema adicionales.

### Egresos: ampliación aprobada (2026-10-03)

1. **Función:** formulario claro, monto exacto, confirmación del registro persistido y correcciones por anulación desde Caja. Permiso financiero existente; no se amplía el acceso de recepción.
2. **Casos de uso:** registrar gasto de hoy con responsable, categoría, descripción, medio y notas; comprobar un resultado incierto; anular con motivo conservando el original. Días cerrados siguen bloqueados por los casos de uso existentes.
3. **Arquitectura:** `proxyUrl` y selección administrativa de establecimiento para todos los comandos/lecturas. Se reutilizan Registrar/Anular Gasto. Lectura individual administrativa por ID para comprobar una anulación incierta; no acepta identidad del body. El formulario bloquea doble envío antes del primer await. La validación del importe se alinea con Decimal(10,2), sin redondear valores inválidos. Un error de transporte/5xx no habilita reenvío automático.
4. **Persistencia:** sin tablas nuevas. Solo el intento enviado se conserva localmente por la clave opaca del actor/establecimiento de `/cash/context`, sin expirarlo automáticamente. Una lectura que coincide en todos sus datos ofrece revisión y selección explícita del registro; no certifica idempotencia. Descartar el aviso exige confirmar que se revisó Caja. No se reintenta POST para recuperar. La anulación usa el comando existente y una lectura por ID para verificar su estado; no modifica importes.
5. **Esquema físico:** Expense existente, monto Decimal(10,2), responsable, estado y motivo de anulación. Sin migración. Metadatos de responsable añadidos a la lectura administrativa de Caja. La lista activa excluye anulados como antes; el diálogo conserva la confirmación y el registro original sigue disponible por ID/lista.

**Decisión diferida:** idempotencia durable de egresos en servidor requiere un diseño propio. El aviso local y la revisión explícita reducen repeticiones, pero no constituyen garantía transaccional entre varios operadores o dispositivos.

### Egresos: dos ajustes finales aceptados (2026-10-03)

El responsable aprobó consultar antecedentes y avisar antes de descartar un formulario. Es una ampliación del adaptador de los casos de uso existentes, sin reglas de negocio adicionales.

1. **Función:** consultar gastos activos y anulados por período, descripción/responsable, categoría y estado; proteger datos preparados y todavía no enviados.
2. **Casos de uso:** administrador consulta antecedentes con motivo/fecha de anulación, importe original, responsable y notas. Cambiar de vista o seguir enlaces del dashboard con datos sin guardar exige decidir entre seguir editando y salir sin guardar. El responsable prellenado no activa el aviso. Recargar/cerrar usa el aviso nativo del navegador.
3. **Arquitectura:** lector GET `/expenses` existente, autenticado mediante `proxyUrl`, selección administrativa de Tenant y permisos financieros existentes. Consulta cancelable con rango explícito hasta hoy; búsqueda/filtros locales sobre la respuesta. Se advierte el límite de 500 y la suma se denomina únicamente gastos activos mostrados. El aviso intercepta enlaces del documento en la misma pestaña antes de la navegación; no intercepta nuevas pestañas, descargas ni enlaces a la misma URL. Un guardado pendiente ya tiene recuperación local y no se presenta como datos sin enviar.
4. **Persistencia:** `Expense` existente y metadatos de anulación conservados. Los registros heredados sin responsable son legibles. Los datos sin enviar no se persisten; solo el intento enviado conserva la recuperación anterior.
5. **Esquema físico:** sin cambios de Prisma ni migraciones. Sin edición ni eliminación del gasto original; consulta histórica de solo lectura.

El aviso de enlaces no bloquea el historial Atrás/Adelante del navegador ni navegaciones programáticas de terceros; Next no ofrece un bloqueo universal de esas acciones. La recarga/cierre usa `beforeunload`, sujeto al comportamiento del navegador. No se introduce una manipulación de su pila de historial.

### Historial: cuatro ajustes aceptados (2026-10-03)

1. **Definición funcional:** consulta ágil de operaciones con fechas rápidas, origen, estado y medio; listado compacto paginado, resumen coherente con la consulta y correcciones claras. El responsable aprobó los cuatro ajustes conjuntamente y la comprobación del recorrido.
2. **Casos de uso:** administrador consulta ventas/cobros existentes; abre el comprobante; anula únicamente venta manual activa con motivo y conserva su importe; ante resultado incierto comprueba por ID antes de repetir. La recepción de productos continúa como comando independiente del inventario, por líneas completas y sus permisos existentes; no representa reembolso bancario. Sin reglas nuevas de devolución o contabilidad.
3. **Arquitectura técnica:** lectores GET `/transactions` y `/transactions/:id`, comandos de anulación y devolución existentes; todo cliente usa `proxyUrl` y la selección de Tenant autorizada. Fechas de Bogotá hasta hoy; consultas cancelables y validación de respuesta. Filtros locales y páginas de diez operaciones sobre las hasta 200 filas existentes, con límite visible. Resumen de activos/anulados e importe activo mostrado del resultado filtrado; no se declara total contable global. Se retira del Historial el resumen mensual independiente de sus fechas; Reportes sigue ofreciendo análisis financiero.
4. **Persistencia:** reutiliza Transaction/TransactionItem y las instantáneas de precio, autor, origen y devolución. El motivo/fecha de anulación se conservan. Un resultado incierto del comando se comprueba mediante lectura; no se introduce reintento automático ni nueva entidad. No se atribuye un método confirmado a un cobro de sistema sin evidencia de revisión.
5. **Esquema físico:** sin cambios de Prisma ni migración. Sin alteraciones al cierre diario, ADR 007 ni a la recepción de Inventario aprobada. Nuevas políticas de reembolsos, edición de importes o devoluciones parciales permanecen fuera de estos ajustes.

### Reportes: cuatro ajustes aceptados (2026-10-03)

Ampliación aprobada: los tres ajustes finales (Excel/impresión, detalle con fechas y comparación equivalente) se resuelven en ADR 017, `docs/decisions/017-reportes-comparacion-equivalente.md`. Ese ADR sustituye la decisión de mantener exclusivamente la comparación completa; ambas opciones quedan disponibles. Evidencia final: `docs/history/POS_REPORTS_FINAL_UI_VERIFICATION_20261003.md`.

Implementación y recorrido comprobados en `docs/history/POS_REPORTS_UI_VERIFICATION_20261003.md`. Los agregados financieros de cada resumen/desglose usan una instantánea `RepeatableRead`; el adaptador continúa siendo exclusivamente de lectura.

El responsable aprobó corregir las cifras y la presentación de Reportes. Es lectura administrativa del dominio ya construido, sin un entregable nuevo de Fase 2 ni reglas de contabilidad adicionales.

1. **Definición funcional:** mostrar ingresos activos, egresos activos y su diferencia con centavos; selección comprensible de semana/mes/año; desgloses de medios y tipos de artículos; retirar recordatorios y corregir métricas mal denominadas. Cada sección comunica su propia carga, vacío o error, sin cifras antiguas bajo un período nuevo.
2. **Casos de uso:** administrador consulta un período y su anterior, vuelve al actual, revisa ingresos mensuales del año que contiene la selección, medios pendientes de revisión y artículos clasificados. Servicios realizados cuentan únicamente citas completadas. Actividad de clientes muestra clientes nuevos y citas vigentes/atendidas, sin declararlo retención. Comparación conserva el período anterior completo y señala explícitamente cuándo el actual es parcial.
3. **Arquitectura técnica:** se reutilizan los lectores autenticados `/reports/*` y se añade únicamente un desglose de lectura sobre Transaction/TransactionItem. Los períodos de Bogotá, fin exclusivo y comparación se resuelven en un helper compartido del adaptador; validación de parámetros y tenant desde la identidad autenticada. Ingresos y egresos filtran `status: active`. Desglose agregado en BD, sin el límite de filas de Historial. Un cobro de sistema sin operador tiene método Por revisar, pero sigue siendo ingreso según ADR 007. Cliente usa proxyUrl y selección administrativa de Tenant. Gráfico anual y actividad de seis meses tienen contexto explícito; no se presentan como resultados del rango semana/mes seleccionado.
4. **Modelo de persistencia:** Transaction, TransactionItem, Expense, Appointment, Pet y User existentes; importes históricos preservados. Clasificación usa itemKind/productId guardados y origen de cita cuando hay evidencia; registros sin evidencia permanecen como Sin clasificar. No infiere categoría por el nombre del artículo. Retirar recordatorios es solo presentación, conserva su lector para consumidores existentes.
5. **Esquema físico:** sin cambios de Prisma, índices ni migración. No modifica cierre diario, FinancialPeriod, comisiones, inventario, pagos ni motor conversacional. Los contratos existentes conservan sus campos y reciben metadatos aditivos; se mantiene el nombre returningVisits del lector antiguo aunque la UI lo denomina cantidad de citas.

**Decisiones diferidas:** utilidad/margen requieren costos y una definición contable propia; no se deducen de ingresos menos egresos. Medir retención real no forma parte de esta corrección. Exportaciones fiscales, conciliación bancaria, pagos mixtos y políticas nuevas de reembolso quedan fuera del alcance aceptado. No se crea una agrupación superior a Tenant.
