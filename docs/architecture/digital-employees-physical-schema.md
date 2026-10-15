# Empleados digitales operativos — Etapa 5: esquema físico

Fecha: 2026-10-14. **Estado: aprobado explícitamente para implementación local** mediante «Aprobar Etapa 5 e implementar». Las Etapas [1](digital-employees-functional-definition.md), [2](digital-employees-use-cases.md), [3](digital-employees-technical-design.md) y [4](digital-employees-persistence-model.md) también están aprobadas. Publicación y producción requieren su autorización correspondiente.

Este documento conserva el diseño aprobado y su evidencia de preparación previa a implementar. La implementación local se completó el 2026-10-15 conforme a la [regla del proyecto](../PHASE_2_EXECUTION_RULE.md). El [informe de cierre local](../history/ENTREGABLE_EMPLEADOS_OPERATIVOS_COMPLETION_REPORT.md) registra migraciones, verificaciones y límites; no certifica una publicación en producción.

## 1. Artefacto y límites

El [borrador Prisma](digital-employees-schema-draft.prisma) concreta columnas, tipos, unicidad, relaciones e índices de cinco tablas nuevas. Contiene proyecciones mínimas de siete modelos existentes para validar sus fronteras; **no reemplaza el esquema vigente**. Al integrar se conservan todos los campos, relaciones, defaults, índices y extensión `vector` actuales.

Los checks, los triggers y el carácter diferido de algunas restricciones se especifican en este documento. Prisma 7.10.0 sigue siendo la versión instalada: no se toma sintaxis de versiones posteriores como garantía del cliente actual. Las funciones SQL aquí definidas por contrato son obligaciones de la migración, no objetos ya instalados. Su ejecución y las pruebas de PostgreSQL quedan como puerta obligatoria de implementación; `prisma validate` comprueba el DSL, no esas garantías SQL.

## 2. Tipos y columnas

| Tabla nueva | Columnas y representación |
| --- | --- |
| `OperationalRequest` | ID interno TEXT; Tenant/principal; UUID externo `requestId`; empleado/tarea; versiones de contrato/canonicalización; modo, entrada JSONB y SHA-256; ciclo de solicitud; generación/dueño/plazo de reclamación; número de intentos; resultado/código y diagnóstico; creación/actualización |
| `OperationalAction` | ID TEXT; alcance y solicitud/tarea; tipo y estado; número de revisión vigente; UUID interno de ejecución; motivo terminal; apertura/cierre |
| `ActionRevision` | ID TEXT; alcance/acción/número; versiones; validación; payload, faltantes, vista previa y contexto de producto JSONB; SHA-256; creación/caducidad |
| `ExecutionReceipt` | ID TEXT; alcance/acción/tarea/tipo; revisión y huella ejecutadas; UUID/versión de ejecución; decisión; uno de Expense/InventoryOperation; autoría mínima; versión/proyección del resultado; confirmación |
| `PublicationIntent` | ID TEXT; alcance/solicitud/tarea/recibo opcional; causa y ordinal; sobre de evento, huella y versión; certificación/vínculo; generación/plazo y diagnóstico; intento/estado/evidencia de notificación; fechas |

Los IDs nuevos son UUID generados por el servidor, representados como TEXT para convivir con los IDs CUID de los modelos existentes. `@default(uuid())` se resuelve por Prisma; el SQL parametrizado proporciona explícitamente IDs. Los UUID de request, ejecución y reclamaciones usan el tipo nativo UUID y no se aceptan valores arbitrarios como claves válidas.

`principalKey` conserva `VARCHAR(256)`, con `staff:<id>` o `admin:<correo NFC, trim, minúsculas>`, igual al lector actual de Inventario. No hay FK borrable a Staff para la autoría histórica. El lector debe rechazar una identidad que exceda el tamaño sancionado en vez de truncarla y mezclar principales.

Fechas nuevas: `TIMESTAMPTZ(3)`, instantes UTC. Los plazos se calculan con el reloj de servidor/base, nunca con el reloj del navegador. Fechas civiles siguen las utilidades de Bogotá existentes; no se convierte la fecha del navegador en el día de cierre. No se cambian tipos de fechas históricas de Finanzas.

Contadores de revisión/contrato/ordinal: INTEGER positivo o no negativo según su función. Generaciones y contador de certificación: BIGINT no negativo. El adaptador transforma BIGINT a cadena decimal en DTOs cuando lo expone; no hace `JSON.stringify` de BigInt ni lo convierte a Number sin verificar rango. Incrementos usan aritmética SQL con rechazo explícito de desbordamiento, sin reiniciar generaciones.

Importes de payload/resultado: cadenas decimales exactas y normalizadas a dos decimales; cantidad de entrada entera. El destino Expense conserva `Decimal(10,2)` y los rangos de negocio ya aprobados. No hay columnas nuevas de saldo ni moneda. SQL valida formas y estados; el contrato de dominio sigue validando dinero, lotes, stock, días cerrados y permisos.

## 3. Identidades y claves de aislamiento

Las FK nuevas usan `ON DELETE RESTRICT ON UPDATE RESTRICT`. No se agregan cascadas ni se convierte Tenant nullable histórico en un valor inventado. Las columnas nuevas de alcance son NOT NULL; así no pueden saltarse una FK compuesta mediante nulos.

| Origen → destino | Clave física y garantía |
| --- | --- |
| Request → Tenant | `tenantId → Tenant.id`, no nulo |
| Request → empleado | `(tenantId,employeeId) → DigitalEmployee(tenantId,id)`; exige identidad compuesta nueva `DE_tenant_id_key` |
| Request → tarea | `(employeeId,taskId) → AgentTask(digitalEmployeeId,id)`; índice único nuevo `AT_employee_id_key` |
| Acción → request | `(tenantId,principalKey,requestId,taskId) → OperationalRequest(tenantId,principalKey,id,taskId)` |
| Revisión → acción | `(tenantId,principalKey,actionId) → OperationalAction(tenantId,principalKey,id)` |
| Acción → revisión vigente | `(tenantId,principalKey,id,currentRevision) → ActionRevision(tenantId,principalKey,actionId,number)`; FK diferida |
| Recibo → acción | `(tenantId,principalKey,actionId,taskId,kind) → OperationalAction(tenantId,principalKey,id,taskId,kind)` |
| Recibo → revisión | `(tenantId,principalKey,actionId,revisionNumber) → ActionRevision(tenantId,principalKey,actionId,number)` |
| Recibo → decisión | `(taskId,decisionId) → AgentDecision(agentTaskId,id)`; índice único nuevo `AD_task_id_key` |
| Recibo → gasto | `(tenantId,expenseId) → Expense(tenantId,id)`; índice único nuevo `Expense_tenant_id_key` |
| Recibo → inventario | `(tenantId,principalKey,inventoryOperationId) → InventoryOperation(tenantId,principalKey,id)`; índice único nuevo `IO_principal_id_key` |
| Intención → request | Misma combinación de Tenant/principal/request/tarea que la acción |
| Intención → recibo | `(tenantId,principalKey,receiptId) → ExecutionReceipt(tenantId,principalKey,id)`; trigger comprueba además que sea la misma solicitud |
| Intención → evento | `(tenantId,domainEventId) → DomainEvent(tenantId,id)`; índice único nuevo `Event_tenant_id_key` |

Los seis índices nuevos de frontera incluyen IDs ya únicos globalmente; no requieren deduplicar datos legacy. Sus nombres están fijados en el borrador. Se verifica primero que no haya ya otra restricción equivalente en la base objetivo para evitar crearla dos veces en una migración posterior.

Unicidades de operación:

- `OR_request_key`: `(tenantId,principalKey,requestId)`; la versión/empleado no son otra identidad que permita duplicar un request anterior.
- `OR_task_key`: un request por tarea; `OA_request_key`: como máximo una acción por request.
- `AR_number_key`: `(tenantId,principalKey,actionId,number)`; una sola revisión con ese número dentro del alcance.
- `ER_action_key`, `ER_execution_key`, `ER_decision_key`: un recibo por acción, ejecución y decisión ejecutora.
- `ER_expense_key` / `ER_inventory_key`: el resultado no respalda dos recibos. Los nulos de PostgreSQL permiten muchas filas del otro tipo; un check obliga a elegir exactamente el destino correcto.
- `OA_execution_key`: una clave generada por el servidor no se reasigna a otra acción.
- `PI_emission_key`: `(requestId,causeKey,ordinal)`; aquí requestId es el ID **interno** TEXT, no el UUID de cliente. La causa y el ordinal conservan emisiones legítimas distintas del mismo nombre.
- `PI_event_key` y `PI_notification_key`: un certificado por intención y una identidad de inicio de notificación por intención.

El índice de empleado no introduce unicidad por especialización. Las relaciones inversas del borrador son colecciones ORM cuando se usa una FK compuesta; las restricciones únicas indicadas limitan la cardinalidad real aunque esa colección tenga como máximo una fila.

## 4. Checks de fila

La migración debe nombrar cada check con prefijo de tabla, para interpretar violaciones sin convertir cualquier `P2002` o error SQL en «operación ya ejecutada».

| Tabla | Checks obligatorios |
| --- | --- |
| Request | `inputMode IN ('texto','estructurado')`; estado cerrado; versiones ≥1; generación ≥0; intentos entre 0 y 3; `procesando` implica dueño/plazo presentes y generación/intentos ≥1; otros estados tienen dueño/plazo nulos; resuelta exige resultCode y resultado objeto; huella hexadecimal minúscula de 64 caracteres |
| Acción | Tipo en `registrar_gasto/entrada_inventario`; estado cerrado; revisión ≥1; estados terminales equivalen a closedAt no nulo; motivo no vacío en descarte/vencimiento/rechazo |
| Revisión | Número/versiones ≥1; validación `borrador/lista`; payload/preview objetos, missingFields array; lista exige array vacío y `expiresAt = createdAt + interval '15 minutes'`; borrador exige faltantes no vacíos y expiresAt nulo; huella válida |
| Recibo | Versión/revisión ≥1; tipo/destino exactos; nombres/rol admitidos y no vacíos; resultado objeto; huella válida |
| Intención | Ordinal ≥0; versiones ≥1; causa/nombre/origen no vacíos; sobre objeto; estados cerrados; generaciones/contadores no negativos; coherencia de reclamación/certificado e inicio/final de notificación |

No se usa `CHECK(expiresAt > now())`: un hecho válido no se vuelve una fila inválida por pasar el tiempo. El comando usa la hora actual tras obtener locks; el worker cierra propuestas mediante actualización condicional. Se rechaza SQL NULL y JSON `null` donde se exige un objeto; todos los checks sobre campos opcionales cierran explícitamente los casos de nulos.

Ejemplos vinculantes del SQL adicional a generar en la migración, usando nombres físicos del borrador:

```sql
ALTER TABLE "OperationalAction"
  ALTER CONSTRAINT "OA_current_revision_fk" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "ExecutionReceipt" ADD CONSTRAINT "ER_result_kind_ck" CHECK (
  (kind = 'registrar_gasto' AND "expenseId" IS NOT NULL AND "inventoryOperationId" IS NULL)
  OR
  (kind = 'entrada_inventario' AND "expenseId" IS NULL AND "inventoryOperationId" IS NOT NULL)
);

ALTER TABLE "ActionRevision" ADD CONSTRAINT "AR_readiness_ck" CHECK (
  jsonb_typeof("missingFields") = 'array'
  AND (
    ("validationState" = 'lista' AND jsonb_array_length("missingFields") = 0
      AND "expiresAt" IS NOT NULL
      AND "expiresAt" = "createdAt" + interval '15 minutes')
    OR
    ("validationState" = 'borrador' AND jsonb_array_length("missingFields") > 0
      AND "expiresAt" IS NULL)
  )
);
```

La condición de notificación exige: `no_iniciada` sin ID/inicio/fin; `iniciada` con ID/inicio y sin fin; `verificada` o `requiere_revision` con ID/inicio/fin. Cualquier estado distinto de no_iniciada exige certificación `certificada`, domainEventId/certifiedAt presentes y reclamación de certificación liberada. La certificación `certificada` exige `domainEventId = id`; en los otros estados domainEventId/certifiedAt son nulos. Esta igualdad materializa la identidad estable reservada por la intención.

Una reclamación de certificación solo existe en estado `pendiente`, con dueño/plazo ambos presentes y generación ≥1. Pendiente también permite ambos nulos mientras espera próximo intento; no hay pares incompletos. `certificationState = requiere_revision` y `notificationState = no_iniciada` describen fallo anterior a cualquier intento externo, no un permiso de envío.

## 5. Inmutabilidad y coherencia entre filas

Prisma no representa por sí solo estas garantías. Se crearán triggers SQL con funciones versionadas `op_assistant_*`, sin llamadas externas. Cada función deriva tablas/nombres desde código fijo; no ejecuta SQL proporcionado por JSON o por el cliente.

### 5.1 Guardas inmediatas

| Trigger | Alcance y conducta |
| --- | --- |
| `op_assistant_immutable` | Rechaza UPDATE/DELETE de ActionRevision y ExecutionReceipt. Una nueva revisión es INSERT; una corrección del negocio es otro hecho. |
| `op_assistant_request_guard` | Request: impide DELETE/cambio de alcance, UUID, empleado, tarea, contrato, entrada y huella; protege resuelta/requiere_revision de reapertura y regresión de generaciones/intentos. Permite solo transiciones y diagnósticos autorizados. |
| `op_assistant_action_guard` | Acción: impide DELETE/cambio de identidad, request, Tenant/principal/tarea, tipo, executionKey o creación; terminales no se modifican; una corrección aumenta revisión exactamente en uno; confirmar/descarte/expirar no cambian la revisión. |
| `op_assistant_intent_guard` | Intención: impide DELETE o cambio del sobre, causa, ordinal y referencias originales; permite fijar una sola vez el vínculo certificado y un solo inicio de notificación; no admite borrar/reasignar notificationId o regresar a no_iniciada. |
| `op_assistant_audit_guard` | Solo tareas/decisiones vinculadas a OperationalRequest: impide mover la tarea de empleado, mover una decisión a otra tarea, modificar/borrar decisiones o borrar la tarea. El historial de otros agentes conserva su comportamiento. |
| `op_assistant_event_guard` | DomainEvent ya ligado a una intención: impide modificar/borrar Tenant, tipo, origen, fecha y payload; el sobre nuevo no se aplica retroactivamente a otros eventos. |

Los triggers guardan identidad y ciclos; las operaciones condicionales del repositorio siguen siendo necesarias para cercar reclamaciones. Un UPDATE ciego no sustituye las condiciones de generación, dueño y plazo. Se valida siempre el número de filas actualizado.

### 5.2 Verificación diferida al commit

La FK vigente es diferida para insertar la acción antes de su primera revisión. Además habrá un `CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED`, `op_assistant_attention_consistency`, que comprueba el **estado final reconsultado** de la atención. No evalúa solo los valores OLD/NEW capturados en un paso intermedio del UOW.

Se dispara por INSERT/UPDATE de request/acción/recibo y por INSERT de revisión; también por cambios de estado/resultado de AgentTask y cambios de las referencias de decisión implicadas. En modelos compartidos es un no-op si no existe atención operacional relacionada. Al resolver una atención bloquea la fila de request/acción correspondiente en orden estable; no puede quedar una escritura posterior que evada la verificación por haber comprobado antes un estado parcial.

Comprueba al commit:

1. El empleado y tarea son del request; especialización compatible con tipo de acción. La autoridad activa se valida al ejecutar, no como restricción histórica que impida pausar después.
2. Acción y revisión vigente coinciden en alcance/número. En borrador/lista coinciden además los estados de preparación; una terminal conserva la última revisión. No puede existir una revisión huérfana ni apuntar a una revisión de otra acción.
3. Acción confirmada tiene exactamente un recibo; una acción en cualquier otro estado no lo tiene. El recibo coincide con revisión vigente, hash, clave, tipo y versión de contrato. Una revisión `borrador` nunca tiene recibo.
4. Confirmación/descarte/vencimiento/rechazo implican tarea completada y resultado versionado con el ID de atención/acción y desenlace correcto. Confirmación exige además ID de recibo. Request pendiente/procesando implica tarea en proceso y ninguna acción; request resuelta con acción abierta implica tarea en proceso; resuelta sin acción implica tarea completada con resultado sin efecto; requiere_revision implica tarea escalada con su escalación existente.
5. La decisión de ejecución pertenece a la tarea y declara actionId, revisión y huella del recibo en su input estructurado. La proyección de `AgentTask.result` no se acepta como sustituto de ese vínculo.
6. Una InventoryOperation referenciada es de tipo `register_entry`, tiene el UUID de ejecución de la acción y el principal ya fijado por la FK. `entry` es la clase del movimiento, no el tipo de operación. Un gasto referenciado está en el mismo Tenant y existía al commit; coherencia de sus valores con el comando la garantiza el caso de uso en el UOW, sin copiar reglas contables a un trigger.
7. Una intención con recibo pertenece al request de la acción de ese recibo. Una intención certificada coincide con el DomainEvent en Tenant, tipo resuelto desde nombre, origen, fecha y payload JSONB. La aplicación valida adicionalmente la huella canónica.

Para los puntos de certificación se añade un constraint trigger sobre PublicationIntent y sobre cambios de DomainEvent si este está ligado al flujo; así una relación insertada después de modificar el evento en la misma transacción no evade el examen final.

Estos triggers no certifican por sí solos que una ejecución manual de SQL haya seguido todas las reglas del negocio. La identidad autenticada, la vigencia temporal, la exclusión Expense/cierre, la comparación de producto y los cálculos existentes siguen siendo obligaciones de la aplicación. No se promete protección frente a un administrador de PostgreSQL que desactive restricciones.

## 6. Canonicalización y huellas

Contrato `canonicalVersion = 1`, SHA-256 hexadecimal minúscula calculado en servidor sobre UTF-8:

- Objetos con claves ordenadas recursivamente por el comparador determinista de cadenas de JavaScript; arrays conservan orden; sin undefined, NaN, Infinity ni objetos Date sin serializar.
- Importes como cadenas decimales de dos posiciones; cantidades/contadores representables como enteros seguros; fecha civil `YYYY-MM-DD` e instante UTC ISO con milisegundos.
- Solo campos admitidos y defaults ya resueltos. IDs exactos; no se convierte un nombre en identidad ni se modifica una cadena arbitraria con normalización de catálogo no sancionada.
- Request incluye contrato/canonicalización, empleado, modo y entrada. El texto validado se conserva; otra entrada con espacios diferentes puede ser un contenido distinto y no se descarta silenciosamente.
- Revisión incluye Tenant/principal/empleado/acción/tipo/revisión, versión y payload ejecutable más contexto relevante de producto. La vista previa decorativa y diagnósticos no autorizan ni alteran el efecto.
- Sobre de evento incluye Tenant, nombre/tipo, origen, fecha y payload, con versión. La comparación de replay exige tanto esa identidad como coincidencia de valores; un hash coincidente por sí solo no autoriza cambiar referencias.

Ejemplos de contrato: un monto de entrada `10` se normaliza a `"10.00"` antes de la revisión; una cantidad `2` sigue siendo entero. La revisión mostrada y confirmada usa esa misma forma. Una corrección a `"11.00"` cambia revisión y huella; volver a enviar el request original con ese cambio produce conflicto. Campo extra, tipo desconocido o identidad externa en body se rechazan, no se excluyen de la huella para aceptarlos.

## 7. Transacciones, autoridad y barrera del día

### 7.1 Orden de bloqueo y vigencia

El nuevo camino usa `SERIALIZABLE`, con tres intentos máximos y snapshot nuevo en conflicto recuperable. Orden: Tenant (`FOR SHARE`), Staff si existe, StaffCredential, empleado (`FOR SHARE`); request/acción (`FOR UPDATE`); barrera del día; recurso de dominio. Dentro de una clase, IDs en orden estable. Un administrador por correo conserva la identidad de su sesión autenticada actual; no se inventa una tabla de usuarios administradores para bloquearla.

`FOR SHARE`, no solo `FOR KEY SHARE`, bloquea actualizaciones concurrentes de estado/permisos que no alteran la clave. Tras obtener los locks se relee active, módulos, rol, permisos, versión/estado de credencial y empleado; nunca se conserva como vigente el resultado anterior a esperar. Una pausa ya confirmada impide efecto nuevo; puede recuperarse recibo con lectura autorizada sin exigir estado activo del empleado.

Se fijan por transacción `lock_timeout = 2s`, `statement_timeout = 5s`; opciones UOW `maxWait = 2s`, `timeout = 10s`. Presupuesto total del intento HTTP: 12 segundos antes de empezar otro retry; si no cabe un nuevo intento, se devuelve ocupado/resultado incierto y se conserva la identidad. La espera/ejecución del backend puede superar el timeout del proxy: esa respuesta no garantiza rollback. No se anidan transacciones ni se reintenta un efecto externo.

### 7.2 Exclusión Expense/cierre sin fila de cierre

Se elige advisory lock **transaccional** de PostgreSQL, no tabla nueva ni lock de sesión. La entrada es la representación JSON canónica de `["expense-close-v1", tenantId, civilDateKey]`, pasada como parámetro:

```sql
SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0));
```

Todos los caminos de registrar/anular gasto y generar cierre usan el mismo adaptador. La colisión improbable de hash solo serializa dos días adicionales; no mezcla sus consultas, que siguen filtrando Tenant/día. El lock se libera por commit/rollback. No se usa CURRENT_DATE ni se bloquea solo un DailyClose existente.

Adquirir un advisory lock no renueva un snapshot Serializable: las lecturas se repiten en el intento y una anomalía/conflicto de snapshot exige reintentar toda la transacción. Las pruebas deben forzar ambos órdenes de commit y un cierre que ya estaba esperando. No se afirma resolver carreras de ventas/comisiones fuera del alcance aprobado.

### 7.3 Secuencia de escritura

1. Crear request y tarea con sus intenciones en un UOW. Reclamar interpretación por UPDATE condicional de estado/generación/reclamación; LLM fuera del UOW. Guardar resultado solo si siguen vigentes generación, dueño y plazo, revalidando autoridad.
2. Al preparar, insertar acción con revisión 1 pendiente por FK diferida; insertar revisión; dejar request resuelta y tarea en proceso. Corregir bloquea acción, verifica expectedRevision, inserta revisión siguiente y actualiza el puntero. La FK se satisface antes del commit.
3. Al confirmar, comprobar permisos y buscar recibo; si existe se recupera. Sin recibo: bloquear acción, comprobar revisión/TTL con `clock_timestamp()` actual, estabilizar recursos y ejecutar dominio. Inventario usa su UOW propietario con los hooks aprobados, sin uno exterior anidado.
4. Crear resultado del dominio, decisión, recibo, intenciones y cierre de tarea; marcar acción confirmada. Las FK normales de resultado/decisión son inmediatas: se insertan sus destinos antes del recibo. El constraint trigger examina la coherencia final.
5. Commit; solo entonces publicar una respuesta. Un conflicto sobre `ER_action_key` obliga a revertir el intento completo y recuperar con lectura nueva/autoridad actual, no a continuar dentro de una transacción abortada. Otros errores conservan su significado.

Los comandos humanos que adoptan UOW/barrera recopilan eventos por intento y publican mediante el publicador legacy después del commit ganador. No utilizan las nuevas tablas salvo que sean del camino de empleado y no se les atribuye una entrega durable que antes no tenían.

## 8. Índices, reclamaciones y workers

Los índices del borrador cubren la recuperación exacta, páginas de operador por creación/ID, reclamaciones de request, revisiones listas por vencimiento, intenciones por próximo intento/lease y notificaciones no iniciadas. El catálogo de empleados conserva el índice existente por Tenant/especialización y filtra solo las dos especializaciones permitidas; usa límite 30/máximo 100, orden ID, cursor ligado al Tenant/principal y capacidades vigentes.

El mantenimiento de vencimientos identifica candidatos sin tomar primero locks de acción. Por candidato, en una UOW corta, bloquea **request y después acción**, con `FOR UPDATE SKIP LOCKED` en ese orden. Si cualquiera está ocupado, termina ese intento sin cambios y libera los locks; no retiene un request mientras busca otro candidato. Relee la revisión vigente, estado y hora después de obtener ambos locks. No cierra una revisión vieja solo porque aparezca en el índice. No bloquea luego Tenant/empleado: el mantenimiento no ejecuta negocio ni adquiere esos locks de autoridad. Los workers trabajan en tandas de 25, con un máximo de 100 registros por tick, sin bloquear toda la tabla.

Cadencias propuestas: mantenimiento de propuestas cada minuto; certificación/notificación cada minuto, con exclusión de solapamiento por reclamación en BD. Request se reclama al crear o reenviar el mismo request autenticado, no mediante un job que interprete instrucciones de negocio sin operador.

Reclamación de request: 30 segundos y máximo tres generaciones reclamadas; certificación: 60 segundos y backoff 1/5/15 minutos conforme a Etapa 4. Adquirir o recuperar exige estado elegible, generación esperada y ausencia de dueño o vencimiento del plazo anterior; asigna dueño nuevo, incrementa generación e instala el nuevo plazo en el mismo UPDATE condicional. Renovar o finalizar exige, en cambio, estado esperado, dueño/generación propios y plazo todavía vigente. Una nueva generación invalida resultados tardíos. Los contadores y el estado terminal impiden adquirir otra reclamación de request después del tercer intento; el cierre auditado usa request y luego acción, si existe, en el orden sancionado. No se deduce propiedad del resultado a partir de un timestamp en memoria.

Después de certificar, se vincula DomainEvent con `id = PublicationIntent.id` en la misma UOW corta. Antes de iniciar la primera notificación, el retry genérico debe filtrar `NOT EXISTS` una intención vinculada a ese DomainEvent. Ese filtro es independiente de notificationState y no se desactiva por un fallo.

Solo la transición condicional `no_iniciada → iniciada` crea notificationId y su fecha; el commit ocurre antes de llamar al reactor. No se reclama de nuevo. El mantenimiento marca como requiere_revision un inicio sin conclusión después de 5 minutos; **no reenvía**. Una respuesta tardía solo puede adjuntar evidencia al mismo notificationId, sin cambiarlo, borrar el inicio ni iniciar otra entrega. La tarea financiera/física sigue confirmada.

Para una conclusión normal se guardan referencias verificables de entrega/ejecución; ausencia de reglas aplicables exige evidencia explícita. Si el reactor actual no proporciona esa evidencia, se conserva revisión requerida; no se inventa éxito. La UI muestra negocio confirmado y situación de publicación separadas, sin exponer locks o términos de infraestructura como decisiones de usuario.

## 9. Matriz de invariantes de Etapa 4

| Invariante de persistencia | Mecanismo físico / transaccional |
| --- | --- |
| 1–2. Mismo Tenant, principal y atención | NOT NULL, FK compuestas, guardas de identidad y constraint trigger de relaciones de recibo/intención |
| 3. Un requestId no cambia de significado | OR_request_key + entrada/huella inmutables + comparación de replay en aplicación |
| 4. Una acción/revisión vigente/recibo | Claves OR_task/OA_request/AR_number/ER_action y FK diferida vigente |
| 5. Confirmación y resultado conjuntos | UOW único, ER_result_kind_ck, FK a resultado/decisión y trigger diferido de estado final |
| 6. Revisión lista, vigente y un ganador | FOR UPDATE de acción, expectedRevision, reloj actual/TTL, autorización estabilizada y Serializable |
| 7. Destino correcto, sin compartir resultados | FK compuestas, claves ER_expense/ER_inventory y comprobación de tipo/clave InventoryOperation |
| 8. Historia inmutable | Triggers de revisión/recibo/auditoría; terminales protegidas; sin cascadas |
| 9. Fencing y ausencia de reenvío por lease | BIGINT monotónico, UPDATE condicional; inicio de notificación de una sola asignación |
| 10. Emisión y certificación estables | PI_emission_key, PI_event_key, igualdad ID, vínculo+certificado atómicos y replay estricto |
| 11. Un inicio externo independiente del negocio | NotificationId inmutable, ciclo cerrado, filtro del retry genérico, revisión sin reenvío |
| 12. UOW/orden/barrera/publicación segura | Adaptadores ctx, locks parametrizados, recopilador por intento y publicación post-commit; pruebas de integración obligatorias |

## 10. Migraciones y despliegue propuestos

La integración futura tendrá una migración aditiva `operational_assistant_storage`, con timestamp posterior a todas las migraciones actuales. No se crea ahora un directorio activo en `prisma/migrations`.

Orden de la migración: índices únicos de fronteras → cinco tablas/índices → FK → diferir OA_current_revision_fk → checks → funciones/triggers. DDL transaccional, con `lock_timeout` acotado; si no obtiene locks se cancela y reprograma, sin dejar media migración aceptada. En una base grande se evalúa la ventana de índices antes de ejecutar; no se mezcla CREATE INDEX CONCURRENTLY con una transacción como si fuera compatible.

No hay backfill de tareas/gastos, cambio global de nulabilidad, instancias nuevas por defecto, stock inicial, cambios de precio o modificación de Commission. Los modelos frontera del borrador se fusionan con el schema real; **no se ejecuta un diff desde esa proyección reducida contra producción**, que intentaría borrar campos ajenos.

Secuencia después de la aprobación:

1. Integrar el schema completo y producir la migración SQL revisable, con todas las funciones/checks de §4–5 y pruebas asignadas en §9; preservar SQL personalizado al generar el diff.
2. Validar/generar Prisma con versión local instalada; `prisma generate` es obligatorio al cambiar el schema. No utilizar db push para sustituir la migración.
3. Aplicar y probar primero en PostgreSQL desechable restaurado desde estructura equivalente, incluyendo migraciones anteriores. No ejecutar sobre datos de negocio para «ver si pasa».
4. Implementar y verificar los adapters/casos/rutas/UI y modificaciones transaccionales humanas. El filtro de retry genérico se publica **antes** de activar el productor/worker nuevos. Mientras no esté instalado, ningún flujo emite intenciones activas.
5. Validar arranque/reclamaciones/recuperación y cada garantía de §9 con PostgreSQL real y prueba de interfaz autorizada. Evaluar versión al cerrar la implementación y registrar evidencia.
6. Publicar o desplegar en VPS solo con la autorización correspondiente y respaldo restaurable, migraciones previas verificadas y ventana conocida. La aprobación del diseño no ejecuta ni anuncia ese despliegue.

Rollback de aplicación: desactivar creación de nuevas solicitudes y workers de notificación; preservar tablas, recibos, intenciones y filtro de exclusión del retry genérico. No volver a un binario antiguo que ignore ese filtro mientras existan eventos de este flujo. No borrar datos para deshacer una versión ni quitar triggers para permitir una operación fallida. La recuperación conserva identidades y exige diagnóstico; un fallo de publicación no repite gastos o stock.

## 11. Validación del diseño y límites de evidencia

Revisión del `phase-2-reviewer` completada. Se corrigieron tres hallazgos: tipo de InventoryOperation (`register_entry`), orden request→acción en mantenimiento y predicados distintos de adquirir/recuperar frente a renovar/finalizar reclamaciones. La segunda revisión confirmó las correcciones sin hallazgos pendientes en ellas. Los demás mecanismos se consideraron suficientemente definidos por contrato para esta etapa, conservando sus límites de evidencia.

Comandos ejecutados el 2026-10-14 y extractos reales de salida:

```text
node -p "require('./node_modules/prisma/package.json').version"
7.10.0

npx --no-install prisma validate --schema docs/architecture/digital-employees-schema-draft.prisma
The schema at docs/architecture/digital-employees-schema-draft.prisma is valid
exit 0

node scripts/check-docs.cjs — exit 0
"documents": 313,
"markdownFiles": 297,
"checkedLinks": 904,
"broken": [],
"missingDocReferences": [],
"nonPortableLocalLinks": [],
"catalogueErrors": [],
"exactDuplicates": []

node --test scripts/check-docs.test.cjs — exit 0
ℹ tests 6
ℹ pass 6
ℹ fail 0

npm --prefix frontend run lint — exit 0
> frontend@0.1.0 lint
> eslint
```

También se ejecutó `prisma migrate diff --from-empty --to-schema docs/architecture/digital-employees-schema-draft.prisma --script` para inspeccionar el DDL de la proyección, sin aplicarlo. Generó las relaciones e índices esperados, incluida la FK nombrada `OA_current_revision_fk`; ese DDL aún necesita los checks/triggers/deferral especificados aquí y la integración en el schema completo. No es un script aprobado para aplicar la proyección reducida a una base existente.

El comprobador documental emitió una advertencia de permisos al consultar el ignore global de Git y terminó con código 0. La comprobación de cambios en schema activo, migraciones, backend, frontend y scripts no mostró diferencias; los artefactos de esta etapa están en documentación.

Las pruebas futuras de SQL deben demostrar como mínimo: FK cruzadas rechazadas, revisión vigente diferida válida/huérfana, recibo duplicado o incoherente, fallo de auditoría con rollback del resultado, escritura directa en historia rechazada, fencing tardío, ambos órdenes de gasto/cierre y notificación iniciada sin reenvío.

Validar el borrador Prisma no prueba la migración completa ni concurrencia, triggers, autoridad o UI. La suite completa del backend seguía sin diagnóstico tras una ejecución previa con código 1; esta etapa documental no la presenta como aprobada.

## 12. Fuentes

Contratos del repositorio: [schema actual](../../prisma/schema.prisma), [UOW](../../backend/src/contexts/shared/persistence/prisma-unit-of-work.js), [día civil](../../backend/src/contexts/shared/business-day.js), [lector de acceso de Inventario](../../backend/src/contexts/inventory/infrastructure/prisma-access.reader.js) y los contratos de Agentes/Finanzas/Eventos enlazados en Etapa 3.

Fuentes primarias consultadas: [personalización de migraciones de Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features) para conservar SQL que el DSL no expresa; [bloqueos de PostgreSQL 18](https://www.postgresql.org/docs/18/explicit-locking%2Ehtml) y [constraint triggers](https://www.postgresql.org/docs/18/sql-createtrigger%2Ehtml) para locks y verificación diferida. La propuesta adapta esas herramientas a los invariantes aprobados del proyecto; no adopta sugerencias de versiones posteriores de Prisma sin validarlas con la instalada. El punto de esas dos URLs se codifica como `%2E` para evitar que el comprobador de referencias literales las confunda con archivos locales; ambas URLs se abrieron y resolvieron a la documentación oficial indicada.

## Decisiones arquitectónicas diferidas

Se mantienen las exclusiones de Etapa 3: más comandos/campañas, WhatsApp interno, autonomía sin confirmación, entrega eventual/exactamente una vez externa, serialización financiera global, motor general y cambio de modelo LLM. No se agregan tablas para prometer esas capacidades. No quedan diferidos los mecanismos de aislamiento, recibo atómico, confirmación vinculada o recuperación: están asignados en §9 y deben implementarse/probarse antes del cierre funcional.
