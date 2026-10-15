# Empleados digitales operativos — Etapa 2: Casos de uso

Fecha: 2026-10-14. Estado: Etapa 2 aprobada explícitamente por el responsable. Arquitectura, persistencia, esquema e implementación todavía requieren sus propias aprobaciones.

Aprobación recibida: «Aprobar Etapa 2 y pasar a arquitectura». Autoriza preparar [la Etapa 3](digital-employees-technical-design.md), sin implementar todavía.

## Base y primera entrega

La [definición funcional aprobada](digital-employees-functional-definition.md) comprende Financiero, Administrativo y Recuperación. Esta primera entrega define ocho casos para `asistente_financiero` y `asistente_administrativo`: consultas financieras, registrar un gasto mediante confirmación, consultas de inventario y registrar una entrada mediante confirmación.

Es una selección de trabajo manual con contratos actuales comprobables. No modifica la definición funcional general. Recuperación, ejecución de cierres, ventas/cobros, ajustes/consumos/devoluciones, administración del catálogo y consultas de staff/servicios no se implementan en esta primera entrega. Conservan los flujos humanos existentes; requieren sus propios casos de uso antes de incorporarse al agente. No se añade canal WhatsApp interno ni ejecución programada.

## Actores y reglas comunes

- **Operador**: personal con sesión vigente en el dashboard y establecimiento activo. Finanzas exige la capacidad financiera administrativa actual; lectura de inventario conserva los permisos por módulo y área; entrada e historial completo requieren `inventory_manage`.
- **Empleado digital**: especialización correcta, activa y perteneciente al mismo Tenant. Un identificador o nombre de especialización enviado por el navegador no prueba ninguna de esas condiciones.
- **Administrador humano**: confirma comandos que ya está autorizado a ejecutar. El agente nunca obtiene permisos superiores a los del operador.
- **Contextos de negocio**: Finanzas e Inventario conservan validaciones, cálculos y efectos de sus operaciones. Empleados Digitales conserva tareas, decisiones y escalaciones.

Identidad, Tenant, permisos y estado del empleado se verifican al iniciar y al ejecutar. Nunca provienen del texto libre ni de `body/query` del cliente. No se acepta la ausencia de identidad como administrador. La elección de un recurso incluye resolución por Tenant y, si corresponde, área autorizada.

Las respuestas exponen solo los datos necesarios y autorizados. Los importes y saldos son los de la fuente; el modelo no recalcula contabilidad, convierte monedas ni completa cantidades faltantes. Las fechas se interpretan con la semántica civil ya usada por el negocio, sin introducir otra política de zona horaria. Una fecha ambigua se aclara antes de consultar o preparar una operación.

Los términos «recopilando», «propuesta», «pendiente de confirmación», «completado», «rechazado» y «resultado incierto» describen resultados funcionales. No agregan estados a `AgentTask`, a la sesión de WhatsApp ni a otro enum persistido. Su representación se resuelve en las etapas siguientes.

## Inventario de casos

| Código | Empleado | Trabajo | Efecto de negocio | Permiso |
| --- | --- | --- | --- | --- |
| F1 | Financiero | Consultar y explicar historial o cierres existentes | Lectura | Finanzas |
| F2 | Financiero | Preparar el registro de un gasto | Propuesta sin escritura financiera | Finanzas |
| F3 | Financiero | Confirmar y registrar el gasto preparado | Crea gasto | Finanzas + confirmación concreta |
| A1 | Administrativo | Buscar productos y existencias autorizados | Lectura | `inventory_read` |
| A2 | Administrativo | Consultar detalle, lotes y alertas existentes | Lectura | `inventory_read`, con proyección por rol |
| A3 | Administrativo | Consultar movimientos de un producto | Lectura | `inventory_manage` |
| A4 | Administrativo | Preparar una entrada de inventario | Propuesta sin movimiento físico | `inventory_manage` |
| A5 | Administrativo | Confirmar la entrada y recuperar su resultado | Registra entrada una sola vez | `inventory_manage` + confirmación concreta |

Todas las invocaciones requieren trazabilidad del trabajo del empleado. Una consulta de negocio es de lectura aunque su atención registre auditoría en Empleados Digitales.

## F1 — Consultar y explicar historial financiero o cierres existentes

**Entrada funcional:** tipo de consulta (historial de un intervalo, cierre de un día o período oficial existente) y fechas explícitas. El operador elige los recursos dentro de su establecimiento; no suministra otro Tenant.

**Flujo:**
1. Validar identidad, capacidad financiera y empleado activo.
2. Pedir tipo y fechas si faltan; una petición como «¿cómo vamos?» no autoriza consultar todo el histórico.
3. Consultar `getFinancialHistory`, `getDailyClose` o `getFinancialPeriod`, según la petición. La arquitectura define la adaptación de fechas y límites de tamaño sin duplicar reglas de Finanzas.
4. Presentar fecha/período, importes y fuente. Distinguir cada día cerrado de su vista preliminar, según el resultado original. Una página o tramo nunca se presenta como el total de un universo mayor.
5. Explicar diferencias solo si se dispone de las fuentes necesarias. Si faltan datos, indicarlo sin atribuir una causa inventada.

**Salida:** resultado verificable, referencias al reporte/cierre y fecha de consulta. Si el cierre o período oficial no existe, informar «no generado»; no generar otro como efecto de la consulta. Un resultado vacío se informa como tal, sin equipararlo a indisponibilidad de la fuente.

**Reglas y errores:** rechazar rol no autorizado, empleado pausado, fecha inválida o rango invertido. Respetar los significados originales de los campos, especialmente ingreso cobrado, comisión y cierre oficial; no llamar «cierre» a un total vivo. Si la fuente falla, no usar una respuesta anterior como si fuera actual.

**Efectos y eventos:** sin escritura financiera ni eventos financieros nuevos. La atención deja tarea/decisión/resultado auditables.

**Aceptación:** un administrador obtiene las cifras originales; un perfil sin Finanzas es rechazado; un cierre inexistente no se crea; datos de otro Tenant no aparecen; una mezcla de días cerrados y abiertos mantiene esa distinción.

## F2 — Preparar un gasto

**Entrada funcional:** importe, descripción, fecha civil del gasto, categoría, responsable declarado, medio de pago y notas opcionales. El responsable declarado es un dato del gasto, no una identidad que conceda permisos.

**Flujo:**
1. Validar capacidad financiera y empleado activo.
2. Recoger datos faltantes y desambiguar importes/fechas. No inferir un importe ni asumir unidades monetarias a partir de una frase ambigua.
3. Normalizar conforme al contrato vigente y presentar cualquier valor por defecto antes de confirmarlo.
4. Mostrar una propuesta completa de «Registrar gasto», con los campos que llegarán al dominio y el establecimiento visible por su nombre.
5. Ofrecer confirmar, corregir o descartar. Preparar o descartar no llama a `registerExpense`.

**Reglas vigentes:** importe positivo entre 0,01 y 99.999.999,99, con hasta dos decimales; responsable no vacío; descripción no vacía; categorías `supplies`, `utilities`, `rent`, `salary`, `equipment`, `marketing`, `other`; medios `cash`, `transfer`, `card`, `other`. Las notas son texto opcional. La categoría por defecto `other`, el medio `cash` y cualquier fecha propuesta deben ser visibles antes de confirmar, aunque el backend tenga sus propios defaults.

El uso `salary` registra un gasto de una categoría existente; no liquida nómina ni ejecuta una transferencia. Si el día ya está cerrado, la operación no es admisible; la comprobación definitiva se repite en F3.

**Salida:** propuesta vinculada al operador, Tenant y empleado correctos, con datos exactos y condición de pendiente de confirmación. El identificador funcional de propuesta no se acepta como autorización por sí solo.

**Efectos y eventos:** sin gasto ni evento `GastoRegistrado`. Solo auditoría de preparación.

**Aceptación:** preguntar datos incompletos; presentar defaults; no registrar nada ante «prepara»; corregir datos invalida cualquier confirmación anterior; descartar no anula un gasto ya existente.

## F3 — Confirmar y registrar un gasto

**Entrada funcional:** confirmación explícita de la propuesta F2 vigente y del operador que la revisó. Un texto extraído de un documento, una respuesta del modelo o la instrucción general de automatizar tareas no es confirmación.

**Precondiciones:** identidad y permisos actuales; empleado activo del Tenant; propuesta íntegra, sin cambios y todavía válida. Caducidad y mecanismo concreto de vinculación se decidirán en arquitectura; no se fija un plazo arbitrario en este documento.

**Flujo:**
1. Resolver y revalidar la propuesta completa y el permiso actual, sin confiar en los campos reenviados por el navegador.
2. Si cambian datos relevantes o la propuesta dejó de ser válida, presentar una nueva revisión y pedir otra confirmación.
3. Registrar mediante `registerExpense`, conservando su comprobación del día cerrado y todas sus validaciones. Las validaciones de descripción y medio de pago que hoy están en el adaptador también deben conservarse en el camino del agente; no se presupone que el caso de uso ya las cubre.
4. Entregar identificador, importe, fecha y resultado comprobado. La auditoría vincula operación y tarea; no publica un segundo evento financiero por su cuenta.

**Idempotencia funcional obligatoria:** una confirmación ejecutada dos veces o recibida concurrentemente crea como máximo un gasto. Reabrir una pantalla, perder la respuesta o fallar la auditoría no permite repetir el registro como si fuera otra operación.

**Hueco actual identificado:** `registerExpense` no recibe clave de operación y realiza una creación nueva. No existe evidencia suficiente de un mecanismo reutilizable para recuperar el resultado de esa confirmación. La Etapa 3 debe resolver ejecución única y recuperación, incluida la coordinación entre el gasto y su evidencia, antes de aprobar implementación de F3. No se declara resuelto por un bloqueo del botón, una consulta previa o una instrucción al modelo.

**Errores:** día cerrado, atributos inválidos, permiso revocado o empleado pausado rechazan la ejecución. Ante resultado incierto se informa la incertidumbre y se consulta/reconcilia evidencia autorizada antes de cualquier reintento. Si falta una garantía demostrable, F3 no puede habilitarse ni reducirse silenciosamente a una promesa de ejecución segura.

**Evento de negocio:** `GastoRegistrado`, producido por Finanzas según su contrato actual. No se emite si no se confirmó el registro. La auditoría del empleado usa los eventos existentes que correspondan al ciclo real de su tarea.

**Aceptación:** un doble clic y dos confirmaciones concurrentes generan un único gasto; revocar el rol o cerrar el día tras F2 impide registrarlo; un cambio de importe requiere nueva confirmación; una respuesta perdida no duplica el gasto.

## A1 — Buscar productos y consultar existencias

**Entrada funcional:** búsqueda por información reconocida por el catálogo y filtros admitidos, como área de uso o alertas; cursor si el operador pide continuar.

**Flujo:** validar `inventory_read`, especialización activa y área autorizada; reutilizar `inventory.reads.list`; ofrecer selección cuando existan coincidencias ambiguas; continuar solo con el cursor y contexto de esa misma consulta.

**Salida:** lista autorizada con identidad del producto, presentación y existencias disponibles/físicas según la fuente. Conservar alertas existentes y proyección de costos/precios por rol. Indicar si hay otra página. El contrato actual limita búsqueda a 160 caracteres y lista entre 1 y 100 resultados, con 30 por defecto; no se promete un total global a partir de una página.

**Errores:** filtro de un área no autorizada, módulo deshabilitado, cursor inválido o fuente inaccesible; solicitar nueva búsqueda o rechazar según el contrato vigente. «No encontrado» no autoriza crear un producto.

**Efectos y eventos:** lectura de Inventario; auditoría de la atención.

**Aceptación:** un operador ve solo productos de sus áreas; no aparecen costos ocultos; dos productos de nombre parecido requieren selección; paginar no cambia silenciosamente filtros ni Tenant.

## A2 — Consultar producto, lotes y alertas

**Entrada funcional:** producto seleccionado de forma inequívoca dentro del Tenant y del área autorizada.

**Flujo:** reutilizar `inventory.reads.detail`; presentar existencias físicas, disponibles y vencidas según su DTO; identificar lotes y vencimientos autorizados. Explicar `lowStock` y `expiresSoon` a partir de las señales devueltas, sin recalcular umbrales ni períodos por cuenta del modelo.

**Salida:** detalle con fecha de consulta, presentación/unidad existente, lotes y alertas. Las alertas son información del sistema, no una orden de compra o permiso de consumo. No convertir unidades ni inferir demanda.

**Errores:** producto ajeno, inexistente o no visible según el rol; no revelar su existencia fuera del alcance autorizado. Las restricciones de producto inactivo siguen el contrato del dominio.

**Efectos y eventos:** lectura y auditoría; no pedido de compra, ajuste ni consumo.

**Aceptación:** stock físico y disponible se distinguen; el saldo vencido no se ofrece como disponible; los valores de alerta coinciden con la fuente; permisos reducidos siguen ocultando costos.

## A3 — Consultar movimientos de un producto

**Entrada funcional:** producto resuelto, cursor opcional del mismo historial y contexto.

**Flujo:** exigir `inventory_manage`; consultar `inventory.reads.movements`; presentar tipo de movimiento, cantidades, fecha, motivo y evidencia disponible, conservando orden y paginación actuales. Cualquier resumen se etiqueta como relativo a la página consultada.

**Salida:** historial trazable del producto autorizado y cursor para continuar. No atribuir responsables o causas que la evidencia no incluya.

**Errores:** permiso de lectura sin administración, cursor de otro producto/Tenant, permiso revocado o fuente fallida. El agente no obtiene historial administrativo por haber podido consultar A2.

**Efectos y eventos:** lectura y auditoría; no corrección de movimientos.

**Aceptación:** `inventory_read` por sí solo no permite A3; un cursor ajeno es rechazado; un movimiento no se presenta como una operación financiera; no se modifican saldos.

## A4 — Preparar una entrada de inventario

**Entrada funcional:** producto existente y activo, cantidad, costo unitario, nota opcional y datos de lote/vencimiento exigidos por su política.

**Flujo:**
1. Validar `inventory_manage` y empleado activo; resolver el producto y su política vigente.
2. Recoger cantidad y costo; no deducir compras a partir de fotografías o mensajes sin que el operador revise sus datos.
3. Solicitar `lotCode` si corresponde y `expiresOn` cuando la política sea `lot_expiry`; si es `untracked`, no añadir lote ni vencimiento.
4. Mostrar producto, presentación, cantidad de entrada, costo unitario, lote/vencimiento y nota exactos. Identificar que registrar stock no registra a la vez un gasto financiero ni modifica el precio de venta.
5. Ofrecer corregir, descartar o confirmar mediante A5. No llamar a `entry` para preparar la vista previa.

**Reglas vigentes:** cantidad entera entre 1 y 2.147.483.647, sin exceder el límite de saldo resultante del dominio; costo unitario entre cero y 99.999.999,99, con hasta dos decimales y sin separadores de miles en el contrato normalizado. No se convierten presentaciones. La entrada ordinaria de un lote vencido se rechaza; si el mismo lote ya existe con otro vencimiento, se conserva la regla `LOT_DATE_CHANGED`. La fecha de ocurrencia real del movimiento la determina el dominio al ejecutar; no se promete una entrada retroactiva por recibir una fecha libre.

**Salida:** propuesta exacta vinculada a producto, Tenant, operador y empleado. Los datos/versiones relevantes observados se usan para detectar cambios, sin prometer que el comando actual ya acepte una versión de stock o metadatos para entradas.

**Efectos y eventos:** sin movimiento de inventario, gasto, cambio de catálogo ni evento de entrada; solo auditoría de preparación.

**Aceptación:** pide los campos necesarios según la política de lote; no inventa costo; un cambio de producto/cantidad invalida la confirmación anterior; preparar y descartar no cambian stock.

## A5 — Confirmar una entrada y recuperar su resultado

**Entrada funcional:** confirmación explícita de la propuesta A4 vigente. La misma acción lógica conserva su clave de operación en reintentos y recuperación.

**Flujo:**
1. Revalidar identidad, `inventory_manage`, empleado activo, Tenant, producto y datos relevantes de la propuesta. Si una modificación relevante cambia lo que se está confirmando, presentar nueva propuesta.
2. Reutilizar `inventory.commands.entry` con `kind: register_entry`, identidad autenticada, `operationKey` y el comando exacto aprobado (`productId`, `quantity`, `unitCost`, `lotCode`, `expiresOn`, `reason`, según corresponda).
3. Dejar a Inventario la transacción, bloqueo, reglas de lote, movimiento y evidencia de operación existentes.
4. Presentar identificador y evidencia devueltos. Ante pérdida de respuesta, recuperar mediante `inventory.commands.recover` con el mismo actor/Tenant, tipo y clave. No crear otra clave para ocultar el resultado incierto.
5. Si el dominio devuelve un resultado anterior autorizado para la misma operación, informarlo como recuperado sin sumar otra entrada. Una clave reutilizada con contenido diferente se rechaza conforme al mecanismo vigente.

**Reglas:** la clave de operación sola no autoriza ni confirma una propuesta. Actor, Tenant, tipo y contenido siguen vinculados; el replay no elude permisos actuales. Un cambio de saldo por otra operación no es por sí mismo un cambio de la cantidad de esta entrada; la arquitectura debe definir qué cambios requieren reconfirmación y su protección frente a cambios concurrentes de la política del producto. `entry` no comprueba hoy `expectedVersion` como lo hace la edición del catálogo; no se presupone esa garantía.

**Errores:** falta de permiso, producto inactivo o ajeno, lote incompatible, datos inválidos o resultado incierto. El dominio puede indicar que todavía no encuentra evidencia; eso no prueba que nunca se ejecutó. Seguir únicamente la recuperación/reintento idempotente demostrado, sin alterar la propuesta confirmada.

**Evento de negocio:** `EntradaDeInventarioRegistrada`, producido por Inventario según el contrato vigente. Registrar la atención del agente no genera un segundo evento de entrada ni implica registrar un gasto.

**Aceptación:** dos confirmaciones concurrentes producen un movimiento lógico de entrada; una respuesta perdida permite recuperar sin duplicar; cambiar el contenido conservando la clave se rechaza; un actor revocado no obtiene replay; el caso de uso no cambia el precio de venta ni crea un gasto.

## Flujo común de corrección, descarte y recuperación

Antes de ejecutar, el operador puede corregir o descartar una propuesta. Corrección crea una versión funcional que requiere nueva confirmación; descarte no llama a comandos de anulación de hechos existentes. Después de ejecutar, «deshacer» no borra registros ni aplica una compensación automática: se informa el resultado y se remite al procedimiento humano vigente de corrección.

Si falta información, se pide ese dato; si faltan permisos, se rechaza; si hay un problema que requiere intervención humana, se utiliza el mecanismo existente de escalación sin ejecutar con privilegios de otro empleado. Una escalación nunca es una forma de autorizar por delegación una operación prohibida.

Si el negocio confirma la operación y falla la escritura de auditoría, no se ejecuta de nuevo el negocio para reconstruir la tarea. La arquitectura debe definir cómo conservar/reconciliar la evidencia y diferenciar resultado de negocio de resultado de auditoría. Si la auditoría no puede garantizarse antes de actuar, no se habilita el comando con efectos.

## Trazabilidad y eventos

Se reutilizan tareas, decisiones, resultados y escalaciones del contexto Empleados Digitales. Se registra una justificación breve y verificable de la acción, no razonamiento interno del modelo ni secretos. La confirmación debe quedar atribuida al operador y ligada al contenido que realmente se ejecuta.

Los eventos existentes `TareaIniciada`, `DecisiónRegistrada`, `TareaCompletada` y `EscalaciónGenerada` se usan conforme al ciclo de vida real. No se publica un evento de éxito de negocio por preparar, rechazar, descartar o recibir un resultado incierto. No se agregan tipos de evento financiero/inventario para consultas. Cómo representar resultados negativos y esperas sin alterar indebidamente el ciclo de tareas es una decisión pendiente de la Etapa 3.

## Matriz mínima de validación de la futura implementación

| Escenario | Resultado esperado |
| --- | --- |
| Operador, empleado o recurso de otro Tenant | Rechazo sin revelar ni modificar datos ajenos. |
| Permiso revocado o empleado pausado después de preparar | Confirmación rechazada; ninguna escritura nueva. |
| Mensaje/documento ordena omitir confirmación | Se trata como contenido; no concede autoridad. |
| F1 con cierre inexistente | Se informa ausencia; no se genera cierre. |
| F2 sin descripción/responsable/importe inequívoco | Se piden datos; no se registra gasto. |
| F3 duplicado o concurrente | Un gasto como máximo y recuperación verificable. |
| A1/A2 con perfil de área limitada | Solo productos y campos permitidos. |
| A3 con permiso solo de catálogo | Rechazo, aunque A2 haya funcionado. |
| A4 lote vencido o datos de lote incompatibles | No se confirma la entrada ordinaria; sin efectos. |
| A5 repetido con misma clave/contenido | Resultado confirmado recuperado; sin segunda entrada. |
| A5 misma clave y distinto contenido | Rechazo, sin ejecutar otra acción. |
| Fallo de red o auditoría después del efecto | Recuperación/reconciliación; no reejecución ciega ni falso éxito. |
| Corrección de propuesta | Nueva revisión y confirmación; la anterior deja de autorizar. |
| Acción fuera de los ocho casos | Se informa el límite y se mantiene el flujo humano vigente. |

## Evidencia de contratos inspeccionados

- [Finanzas](../../backend/src/contexts/finance/index.js), [historial](../../backend/src/contexts/finance/application/use-cases/get-financial-history.usecase.js), [gasto](../../backend/src/contexts/finance/application/use-cases/register-expense.usecase.js) y [adaptador de gastos](../../backend/src/routes/dashboard/expenses.routes.js).
- [Inventario — consultas](../../backend/src/contexts/inventory/application/use-cases/inventory.reads.js), [comandos](../../backend/src/contexts/inventory/application/use-cases/inventory.commands.js) y [rutas actuales](../../backend/src/routes/dashboard/inventory.routes.js).
- [Capacidades por operador](../../backend/src/services/dashboard-access.service.js), [tareas y decisiones](../../backend/src/contexts/agents/index.js) y [modelo de dominio](domain-model-v1.md).

Estos archivos prueban qué contratos existen; no demuestran que las garantías nuevas de confirmación, idempotencia de gastos o reconciliación de auditoría ya estén implementadas.

## Puerta de avance a Etapa 3

La aprobación recibida comprende estos ocho casos, sus permisos y la obligación de resolver las brechas identificadas antes de implementar. No aprueba rutas nuevas, modelos de persistencia, migraciones ni una implementación concreta.

La Etapa 3 debe resolver como mínimo: adaptación autorizada de contratos, límites de consultas, confirmación vinculada y vigente, idempotencia y recuperación de gastos, concurrencia de propuestas de entrada, representación del ciclo de tareas y evidencia ante fallos parciales. Cualquier reducción del comportamiento aprobado debe explicarse y reconciliarse, no introducirse silenciosamente como decisión técnica.

Se aplica [la regla de avance secuencial](../PHASE_2_EXECUTION_RULE.md): «Cada etapa se aprueba explícitamente antes de avanzar a la siguiente».

## Evidencia de validación documental

```text
node scripts/check-docs.cjs
"checkedLinks": 866,
"broken": [],
"missingDocReferences": [],
"nonPortableLocalLinks": []
Código de salida: 0

node --test scripts/check-docs.test.cjs
tests 6
pass 6
fail 0
Código de salida: 0

npm --prefix frontend run lint
> frontend@0.1.0 lint
> eslint
Código de salida: 0
```

Esta etapa modifica documentación. La evidencia no demuestra implementación ni funcionamiento de los ocho casos; tampoco certifica la suite completa del backend, cuyo diagnóstico seguía pendiente en la tarea anterior.

Revisión técnica del `phase-2-reviewer`: sin hallazgos accionables. Contrastó los contratos de gasto e inventario, las brechas de idempotencia/concurrencia identificadas, la auditoría y la separación entre propuesta funcional y etapas todavía pendientes. Esta revisión no sustituye la aprobación funcional.
