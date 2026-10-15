# Empleados operativos por WhatsApp — Etapa 5: esquema físico

Fecha: **2026-10-15**, Colombia. **Estado: Etapa 5 aprobada; implementación y validación local completadas en 2.48.0.** [Evidencia y límites](../history/ENTREGABLE_EMPLEADOS_OPERATIVOS_WHATSAPP_COMPLETION_REPORT.md).

El responsable aprobó «Aprobar Etapa 5 e implementar localmente». Las Etapas [1](operational-employees-whatsapp-functional-definition.md), [2](operational-employees-whatsapp-use-cases.md), [3](operational-employees-whatsapp-technical-design.md) y [4](operational-employees-whatsapp-persistence-model.md), junto con el [ADR 022](../decisions/022-empleados-operativos-canal-whatsapp.md), están aprobadas. Se aplica la [regla de ejecución](../PHASE_2_EXECUTION_RULE.md). La autorización permite integrar y probar el esquema y el código localmente; no permite commit/push, despliegue, migraciones productivas ni envíos reales.

## 1. Artefactos y versión objetivo

- [Borrador Prisma aprobado](operational-employees-whatsapp-schema-draft.prisma): referencia del diseño de 16 tablas nuevas y proyecciones mínimas de nueve modelos existentes. La implementación está integrada en el [esquema activo](../../prisma/schema.prisma).
- [DDL de guardas del diseño](operational-employees-whatsapp-guards-draft.sql): referencia de checks, seis índices únicos parciales y dos FKs diferidas. Las migraciones completas de [almacenamiento](../../prisma/migrations/20261015120000_operator_whatsapp_storage/migration.sql) y [guardas](../../prisma/migrations/20261015121000_operator_whatsapp_guards/migration.sql) incorporan también las funciones y triggers; se prueban únicamente en PostgreSQL desechable.

Se mantiene Prisma **7.10.0**, instalado y usado para validar el DSL. PostgreSQL objetivo: **18**, acorde con la imagen declarada en Compose. No se adopta sintaxis de Prisma 8, otro SDK, una nueva cola o extensión de cifrado. Las claves HMAC permanecen fuera de PostgreSQL. Validar el DSL no demuestra los checks, triggers o carreras del SQL.

El emisor conserva **dos contadores distintos**: `epoch` cerca la instancia que responde y `credentialEpoch` avanza al cambiar la huella de credencial. La huella identifica contenido, no es el contador: A→B→A produce otra generación aunque vuelva la misma contraseña/correo. Un reinicio con credencial igual solo cambia la época de instancia. Desafío/vínculo/ventana/sesión de administrador comparan su credentialEpoch con la autoridad global; para Staff lo comparan con `OperatorSubject`. El campo homónimo del Subject administrativo permanece como valor reservado 1 y no se utiliza como fuente de credencial. Las pruebas administrativas firman también ambos contadores.

## 2. Tablas, tipos y compatibilidad

| Tabla nueva | Responsabilidad física |
| --- | --- |
| `OperatorAuthority` | Un emisor administrativo, instancia/época activa y generación de credencial; no contiene permisos de negocio globales |
| `OperatorProof` | Pruebas recientes, respuestas vivas y nonces/operaciones de registro; vencimiento, consumo y tombstone idempotente |
| `OperatorSubject` | Referencia de identidad por Tenant/principal y generaciones de credencial/permisos; sobrevive a eliminación de la fuente |
| `OperatorChannelRoute` | Tenant, canal, receptor y versión/huella de configuración saliente verificada |
| `OperatorLinkChallenge` | Prueba de ambos extremos, número esperado, digest, intentos y plazo de cinco minutos |
| `OperatorLink` | Asociación verificada, revocable e inmutable de dueño/número/ruta; puntero a autorización actual |
| `OperatorAuthorization` | Ventana inmutable de ocho horas derivada de activación o renovación reciente |
| `OperatorParticipant` | Modo por receptor/remitente, sesión actual, versión y secuencia de admisión/resolución |
| `OperatorThread` | Hilo privado del vínculo y selección de tarea/propuesta; no es una conversación de cliente |
| `OperatorSession` | Ventana actual, contexto de modo/ruta y vencimiento por quince minutos de inactividad |
| `OperatorMessage` | Contenido privado inmutable, atribución, proyección y base de acceso; no guarda códigos |
| `OperatorInboundWork` | Paso estable de un job y reserva de UUID de solicitud o referencia a acción existente |
| `OperatorReview` | Base de permisos de la revisión y evidencia de vista completa, sin alterar el comando canónico |
| `OperatorInteraction` | Acción nativa ofrecida, digest/objetivo/revisión y consumo ligado al recibo existente |
| `OperatorDelivery` | Una salida privada o control fijo, lease, intentos y evidencia de aceptación/incertidumbre |
| `OperatorAudit` | Evidencia append-only de acceso/entrega; incluye eventos de intento sin otra cola/tabla de intentos |

Los nuevos IDs son UUID generados por servidor representados como TEXT, compatibles con referencias a IDs CUID existentes. `operationId`, `bootId`, `requestKey` y dueños de lease usan UUID nativo. Tenant/IDs existentes no cambian de tipo. Los IDs no son autoridad, aunque tengan formato válido.

`principalKey` usa `VARCHAR(256)` y el mismo formato canónico existente `staff:<id>` / `admin:<correo trim/NFC/minúsculas>`, sin truncamiento. Teléfonos: `VARCHAR(16)` con 7–15 dígitos, sin `+`, extensiones ni país inferido; la UI recoge la dirección internacional y el remitente normalizado debe coincidir. Receptor de negocio: identificador de línea de Meta, no ese teléfono de contacto.

Instantes nuevos: `TIMESTAMPTZ(3)` y transporte UTC, usando la configuración UTC del pool ya existente. Fechas civiles del gasto/lote conservan su semántica. Contadores/generaciones: BIGINT positivos/no negativos según campo, incrementados en SQL; se serializan como cadenas decimales y nunca se reinician. Revisiones/ordinal de respuesta/intentos: INTEGER con rangos explícitos. HMAC/SHA-256: hexadecimal minúscula de 64 caracteres; versiones de clave separadas. No se guardan claves ni contraseñas.

JSONB tiene forma cerrada según propósito y límite: contexto/buffer o evidencia 16 KiB, mensaje 64 KiB, proyección 4 KiB. Son techos de almacenamiento, no permiso para enviar 64 KiB a Meta. El adaptador aplica el límite real del canal; una propuesta que no pueda mostrarse íntegra usa dashboard sin botón de confirmar. Dinero sigue como decimal canónico exacto del dominio; no se crean columnas de balance.

### Cambios aditivos a modelos existentes

| Modelo | Cambio |
| --- | --- |
| `Tenant` | `operatorAccessEpoch BIGINT NOT NULL DEFAULT 1`, con incremento controlado por cambios de habilitación/módulos/canal; no altera `active` como fuente de verdad |
| `InboundJob` | `envelopeVersion` con default 1; referencias opcionales de Tenant/ruta/participante, ordinal/hash/versiones, resultado y sesión resueltos; generación/dueño de claim del sobre nuevo |
| Channel/empleados/solicitudes/acciones/revisiones/recibos/productos | Solo relaciones inversas ORM a los registros nuevos, conservando todas sus columnas, restricciones y semántica |

Los campos de claim actuales y nuevos no compiten: un job v2 incrementa `channelClaimGeneration` y asigna `channelClaimOwner` dentro de la misma reclamación existente. Ambos identifican la misma posesión y se verifican con lease actual. Un job v1 conserva el camino anterior, con fence de modo antes del envío. No se crean dos workers reclamando el mismo trabajo.

## 3. Claves y relaciones

Todas las relaciones ORM del borrador son `Restrict` para borrado/actualización de referencias históricas. El código activo debe conservar también sus relaciones previas; integrar este borrador no elimina campos ajenos. `OperatorSubject.staffSourceId` es la excepción deliberada sin FK borrable a Staff: el trigger de fuente comprueba creación/asignación y conserva tombstone al eliminarlo.

Las referencias privadas usan FKs compuestas Tenant/principal; ruta/participante usan Tenant/ruta; la revisión referencia la clave existente de `ActionRevision` por Tenant/principal/acción/número. Una FK simple a un UUID válido no sustituye el alcance.

Referencias simples que necesitan además un guard de alcance: pruebas/desafíos, job entrante, `OperatorInboundWork.operationalRequestId`, auditoría de entrega y la autoridad técnica global. Sus predicados obligatorios están en §5; no se da por suficiente el `prisma validate`.

Unicidades principales del DSL:

- `OS_principal_key`: un sujeto por Tenant/principal; `OS_staff_source_key` impide duplicar una identidad Staff en ese Tenant.
- `OPF_operation_key` y `OPF_nonce_key`: idempotencia por emisor/tipo/operación y replay de nonce mientras se conserva el digest; borrarlo después no elimina la operación terminal.
- `OL_challenge_key`, `OAZ_proof_key`: un vínculo producido por desafío y una ventana por prueba. La prueba de activación puede referenciarse también desde su desafío como evidencia del mismo efecto atómico.
- `OPT_address_key`: un estado de modo por Tenant/ruta/teléfono; `IJ_operator_ordinal_key`: un ordinal único por participante. Se conserva la deduplicación global proveedor/ID de `InboundJob`.
- `OTH_link_key`: un hilo por vínculo; `OM_incoming_key`: un mensaje privado por job. Selecciones de empleado/acción siempre conservan Tenant/principal.
- `OIW_step_key` y `OIW_request_key`: cada paso mantiene su UUID; una colisión de hash no crea otra solicitud.
- `OD_reply_key`: una salida por job/ordinal; `OD_message_key`: una intención por mensaje privado. `OD_provider_key` evita atribuir el mismo mensaje del proveedor a dos salidas de la ruta.
- `OI_token_key`: digest de interacción único. `receiptId` no es único aquí: varias recuperaciones pueden señalar el mismo recibo. La unicidad de ejecución continúa en `ExecutionReceipt`/`OperationalAction` existentes.

Los seis índices parciales del DDL obligan a una ruta receptora habilitada, un vínculo activo por operador/ruta y por teléfono/ruta, un desafío pendiente por dueño/ruta, una sesión activa por participante y una base de revisión por acción/número. Son independientes de la hora: antes de reemplazar se cierra/materializa lo vencido bajo bloqueo. Nunca se usa `now()` en el predicado de un índice.

Las FKs `OL_current_auth_fk` y `OPT_current_session_fk` serán `DEFERRABLE INITIALLY DEFERRED`. Se preasignan IDs para crear vínculo/autorización e iniciar sesión/modo en el mismo commit sin admitir una fila activa sin referencia final. El resto de las FKs permanece inmediato salvo necesidad demostrada y documentada. Los índices parciales se satisfacen cerrando el anterior antes de insertar el nuevo.

## 4. Checks y nulabilidad

El DDL adjunto concreta checks con prefijos por tabla. Verifica vocabularios cerrados, rangos, formas JSON, estados/plazos y grupos opcionales. Los campos condicionales usan `IS NOT NULL`: un `CHECK` cuyo resultado sea NULL no sirve como prueba de presencia. Un check no consulta otras tablas ni evalúa vigencia según reloj; esa separación sigue las [restricciones de PostgreSQL 18](https://www.postgresql.org/docs/18/ddl-constraints.html).

El estado persistido puede seguir diciendo activo/ofrecido tras vencer por reloj. Las funciones de efecto comparan la hora después de los bloqueos y deniegan su uso. Desafío: cinco minutos exactos; prueba reciente: hasta 60 segundos; respuesta viva/registro de emisor: hasta 30; autorización: ocho horas exactas; idle: última actividad autorizada + quince minutos. El vencimiento efectivo de sesión es el menor de idle y absoluto.

`OperatorProof` solo admite ámbito nulo para registro técnico de emisor. Reciente/viva requieren Tenant/principal y propósito correcto. `OperatorDelivery.kind=control` exige principal/sesión/mensaje privado nulos y código fijo de catálogo; `private` exige todos ellos y bases de acceso. Ningún JSON arbitrario del modelo se vuelve control genérico.

Los sobres v1 no llevan identidad interna. V2 exige admisión con ruta/participante/hash/ordinal; únicamente el resultado `operator` puede tener principal/sesión y los exige juntos. El payload sanitizado y su origen firmado son comprobados por el adaptador, no por un booleano público que se llame trusted. SQL protege integridad de almacenamiento; no sustituye la verificación criptográfica HTTP ni pretende proteger de un administrador de BD malicioso.

## 5. Funciones/triggers obligatorios en la migración de guardas

Estos contratos están decididos; las funciones PL/pgSQL completas se implementarán tras aprobación. No se presentan como instaladas ni probadas por el DDL adjunto. Cada constraint trigger diferido relee la fila vigente por PK al ejecutarse; no valida una versión intermedia de `NEW`. Comprobaciones de pertenencia/consumo permanentes se aplican también desde la entidad referenciada cuando un campo referenciado puede cambiar.

| Familia de funciones | Predicado/efecto obligatorio |
| --- | --- |
| `operator_subject_source_guard` | Staff existe en el Tenant y principal coincide al crear sujeto; para admin coincide autoridad real activa. Identificadores/kind/fuente no mutan. Fuente ausente nunca pasa a activa por recrear una fila histórica. |
| `operator_bump_staff_access` | Triggers de INSERT/UPDATE/DELETE de Staff y StaffCredential. Cambio de active, correo autenticable, passwordHash, sessionVersion o Tenant avanza credencial y cierra autoridad del vínculo previo; cambio de role/accessPermissions avanza permisos. Tombstone de identidad eliminada permanece. No aumenta por nombre/contacto sin autoridad. |
| `operator_bump_tenant_access` | BEFORE UPDATE de Tenant: active/activeModules/phone cambian generación. Reordenar módulos sin cambiar el conjunto no añade capacidad; comparación canónica de conjuntos. Cambio de phone deshabilita/avanza rutas anteriores. Se rechaza editar la generación a mano, retroceder o desbordarla. |
| `operator_authority_state_guard` | Época nueva exige registro de arranque autenticado y monotonía; repetir operación no crea otra. Si cambia fingerprint de credencial incrementa credentialEpoch, incluso A→B→A; si no cambia mantiene ese contador. Generación nueva invalida vínculos previos; misma generación permite continuidad tras comprobar nuevo emisor. No habilita ninguna operación sin prueba viva. |
| `operator_route_scope_guard` | Channel de WhatsApp activo y de ese Tenant o global explícitamente resuelto; receptor igual a Tenant.phone al habilitar; versión/configuración no retroceden. Cambio de estado/type/Tenant en Channel invalida rutas en el mismo commit. Configuración real del proveedor se verifica además en aplicación antes de enviar. |
| `operator_challenge_scope_guard` | Pruebas inicial/final del mismo Tenant/principal/número/ruta, propósito/consumo/tiempo correctos; job de prueba de teléfono con remitente/receptor auténticos y digest admitido; desafío consumido tiene exactamente un vínculo y un hilo/ventana coherentes al commit. Número/alcance/digest no se sustituyen por otra solicitud. |
| `operator_link_window_guard` | Vínculo, desafío, sujeto y ruta coinciden en alcance, número y generaciones; autorización actual pertenece al mismo vínculo; ventana primera usa prueba de activar y siguientes de renovar. Ocho horas no se amplían por actividad. Reemplazo cierra el anterior; no toma automáticamente el número de otro dueño. |
| `operator_mode_session_guard` | Sesión/hilo/vínculo/participante pertenecen al mismo dueño y teléfono/ruta; autorización es la actual. Modo negocio selecciona exactamente la sesión vigente y su versión. Cerrar/cambiar modo avanza versión e invalida los contextos anteriores. Admisión/resolución de ordinales no retrocede ni salta un predecesor sin disposición terminal. Actualizar idle exige nuevo ordinal autorizado mayor que lastActivityOrdinal; duplicados no renuevan. |
| `operator_work_scope_guard` | Job v2 de operador, sesión y sujeto coinciden. Si se asigna request interno, su Tenant/principal/requestId corresponden al UUID reservado; acción y revisión son propias. Solo NULL→referencia coherente una vez; hash/UUID/paso/propietario no cambian después. |
| `operator_review_scope_guard` | Revisión existente, hash canónico exacto, sujeto/generaciones y preview de origen. Base única e inmutable. Display refiere base de esa misma acción/revisión, mensaje/sesión propios y vista completa; no extiende expiración. Proyección/huella de presentación se obtiene de campos admitidos, no de texto del LLM. |
| `operator_message_scope_guard` | Mensaje/hilo/sesión/job del mismo Tenant/principal. Clasificación de gasto exige Finanzas; entrada exige gestión; lectura conserva área/costos del DTO. `private_generic` solo admite contenido fijo sin datos operativos. Contenido/autoría quedan inmutables. |
| `operator_interaction_guard` | Mensaje y display/objetivo/acción/revisión propios; al ofrecer, existe entrega aceptada con mismo providerMessageId. Al consumir confirmación, existe recibo de esa acción/revisión/hash/clave en el mismo commit; si ya existía se referencia, sin ejecutar. Selecciones/correcciones conservan resultado y versión esperada. |
| `operator_delivery_scope_guard` | Fuente, participante, destinatario, ruta y modo coinciden; mensaje privado de salida y sesión son del dueño. Control usa texto fijo y origen firmado. Aceptación es evidencia del proveedor, no existencia del registro. Intentos se correlacionan a auditoría con generación/dueño actuales. |
| `operator_immutable_guard` | Prohíbe DELETE y cambios de identidad/contenido en mensajes, revisiones de acceso, autorizaciones y auditoría; actualizaciones de ciclos solo según §6. Pruebas/desafíos solo borran digests bajo regla de expiración/consumo, reteniendo IDs/tombstones. No se modifican recibos del negocio. |

Las guardas de consistencia final son `CONSTRAINT TRIGGER ... AFTER ROW DEFERRABLE INITIALLY DEFERRED` donde hay creación circular/consumo con recibo. Las transiciones/immutabilidad y generaciones usan triggers inmediatos. Se sigue el mecanismo oficial de [constraint triggers de PostgreSQL 18](https://www.postgresql.org/docs/18/sql-createtrigger.html). No se implementan guardas entre filas mediante un CHECK que llama una función que consulta tablas.

El registro de pruebas verificadas y su consumo pertenecen al servicio autenticado de aplicación; una fila de prueba por sí sola no autentica. El servidor verifica HMAC SHA-256, método/ruta/body/timestamp/nonce, igualdad de propósito y época; los hashes de contexto usan JSON canónico con versión y separación de propósito. Tolerancia máxima de reloj: cinco segundos para emisión futura, **sin extender expiresAt**. Al esperar bloqueos se vuelve a consultar `clock_timestamp()`, porque el tiempo de inicio de transacción no avanza con la espera ([funciones de tiempo de PostgreSQL](https://www.postgresql.org/docs/18/functions-datetime.html)).

Canonicalización v1: claves de objetos ordenadas, arrays en orden admitido, campos permitidos explícitos, strings/escapes JSON, dinero como cadenas decimales, generaciones como cadenas decimales e instantes ISO UTC con milisegundos. Los conjuntos de áreas/permisos se ordenan antes de codificar; no se normaliza silenciosamente una descripción para ejecutar otra. La firma incluye versión y propósito. Claves se cargan por versión fuera de BD; una rotación invalida contextos mediante generaciones/ruta y no reinterpreta digests antiguos con una clave nueva.

W1 muestra el código generado en memoria una sola vez; si se pierde esa respuesta se conserva el desafío y su estado, sin recuperar el código en claro desde BD. Solicitar otro respeta cooldown/cupo. No se colocan códigos/tokens de acceso en URLs. Para jobs v2, `lastError` y telemetría guardan códigos admitidos, nunca `error.message` con cuerpo o secreto del remitente; se prueba también este camino de fallo.

## 6. Transiciones y actualización permitida

| Registro | Actualización admitida |
| --- | --- |
| Prueba | No cambia binding/nonce/operación/objetivo; consumo una vez junto con efecto y resultado. Se borra digest tras consumo o vencimiento cuando el replay ya queda impedido por operación/tiempo. |
| Desafío | pending→proved→consumed; pending/proved→expired/exhausted/cancelled/replaced. Intentos solo crecen desde número esperado; terminal no reabre. |
| Vínculo | active→revoked/replaced; avanzar autorización actual/versiones sin cambiar dueño/número/ruta. Generación inválida se materializa como revocado antes de revincular al mismo principal. |
| Sesión/modo | Solo actividad interna nueva autorizada extiende idle dentro de ventana absoluta; cierre es terminal. Nueva apertura tiene nueva ID/modo y no recicla botones. |
| Hilo | Selección/buffer permitido avanza versión; cierre terminal. No se convierte un hilo de un operador en otro. |
| Review | Append-only: basis o display. Otra revisión crea otras filas; no actualiza fechas/huellas de las anteriores. |
| Interacción | prepared→offered→consumed; prepared/offered→invalidated. Consumo de confirmar requiere recibo. Consumido no se invalida/borra para intentar otra vez. |
| Work | reserved→resolved/review; correlación y resultado mínimos, sin otra fuente de cifras ni UUID nuevo en un retry. |
| Entrega | prepared→sending→accepted/rejected/blocked/uncertain. Solo rechazo comprobado permite volver a prepared, hasta cuatro intentos. Crash en sending→uncertain; nunca replay automático. |

Una revisión de negocio lista vencida solo se renueva si la acción sigue abierta y sin recibo: otra `ActionRevision` y basis, misma acción/clave. El trigger existente de revisión inmutable permanece. Si la acción fue cerrada terminalmente se conserva y el operador inicia explícitamente otro trabajo. Para dos canales se compara la revisión vigente dentro del mismo UOW; corregir y confirmar no pueden ganar ambos sobre el mismo número.

## 7. Bloqueos y concurrencia

Operaciones de aplicación conservan `Serializable`, reintentos acotados ante serialización/deadlock, sin regenerar IDs/huellas/operationKey. Orden de acceso a recursos: Tenant → Staff/credencial si corresponde → autoridad/sujeto → ruta → participante → vínculo/autorización/sesión/hilo → job/work → request/acción/revisión/interacción → recursos de Inventario o Finanzas. Dentro de cada grupo, IDs en orden estable. Se comprobó que `inventory.commands.run` ejecuta el hook `before` antes de buscar o crear su operación y antes de bloquear productos; ese es el punto de guard y consumo coordinado, sin invertir el orden con los recursos del dominio.

Los triggers de fuente toman las filas necesarias para invalidar generaciones en su mismo commit. Un deadlock aborta/reintenta el UOW íntegro; nunca devuelve éxito parcial ni pierde un incremento. No se reintenta automáticamente una llamada remota incierta. La función de lectura de permiso bloquea la fuente y compara generaciones después de esperar, no solo antes de entrar al servicio.

- **Activación:** bloquear sujeto/ruta/vínculos relevantes; verificar cupo/pruebas actuales; cerrar anterior, consumir pruebas, insertar vínculo/ventana/hilo y seleccionar autorización; un solo commit.
- **Entrada:** bloquear participante, reservar ordinal y job sanitizado juntos. Resolver bajo lease/generación; no adelantar otro ordinal del mismo flujo. Se mantienen lease de entrada de 120 segundos, heartbeat de 20 segundos y máximo cinco reclamaciones del servicio existente. La posesión nueva se asigna en ese mismo claim; al cerrar un paso se comprueban generación, token, intentos y lease con reloj actual. Un predecesor en needs_review requiere disposición explícita antes de avanzar su flujo; no paraliza otros remitentes.
- **Confirmación:** prueba viva fuera de la transacción; dentro, lock de autoridad/fuentes y referencias, revisión vigente, recibo previo, grant y reloj; efecto+recibo+consumo+auditoría/publicación en el mismo UOW de negocio.
- **Salida:** se reserva primero en una transacción corta `sending`, token/generación y lease de 30 segundos, junto con auditoría de intento reservado, **antes de poder llamar al proveedor**. Ese checkpoint es una barrera conservadora de incertidumbre, no una autorización para enviar. Después, prueba viva fuera de transacción y un segundo UOW revalida fuente/permiso/ruta/poseedor bajo bloqueo, inicia la llamada y guarda aceptación/rechazo. Timeout de proveedor cinco segundos, segundo UOW de diez segundos y lock_timeout de dos segundos. Si falla el guard se marca blocked sin enviar; un crash entre reserva y llamada también se trata conservadoramente como incierto. Si el segundo UOW aborta después de iniciar transporte, el sending ya persistido impide reenviar; otro UOW registra uncertain si el proceso sigue vivo. Se conserva evidencia recibida del proveedor cuando existe.

Las funciones SQL preservan integridad; la aplicación revalida módulos/permisos actuales, proyección y autenticidad del callback. No se consulta al LLM o al emisor mientras se tienen bloqueos de negocio. Una prueba puede consumirse dentro de un UOW idempotente; si ese UOW hace rollback, no queda falsamente consumida. Lectura y entrega usan pruebas distintas de propósito y operación.

## 8. Plan de migraciones y activación

Se proponen dos migraciones SQL, cuyos timestamps se asignarán al implementar, después de las migraciones locales existentes de los empleados operativos:

1. **Almacenamiento:** integrar las 16 tablas nuevas, el epoch de Tenant y campos opcionales de InboundJob, FKs/índices normales y dos FKs diferidas. Conservar `vector`, modelos completos, índices y defaults actuales. No sembrar teléfonos, pruebas, sesiones o permisos.
2. **Guardas:** instalar checks e índices parciales del DDL y funciones/triggers de §5, incluyendo escritores Staff/credencial/Tenant/Channel. Validar datos ya presentes y fallar ante incompatibilidad; no borrarlos para que migre. Mantener inmutabilidad y barreras del esquema operativo existente.
La aplicación añade origen de confianza en la auditoría de tarea existente y su correlación a Work; no requiere otra columna de negocio. Revisiones de atenciones adoptadas por el canal interno registran su basis dentro del mismo UOW; una acción que ya tiene basis exige su generación actual aunque se confirme desde dashboard. No se crean eventos de negocio nuevos, backfill de consentimientos ni recibos artificiales. Si la integración demuestra una necesidad física distinta, se actualiza este diseño antes de aceptar ese cambio; no se deja una migración de columnas por decidir al programar.

El dashboard conserva su autenticación y operaciones actuales cuando el modo WhatsApp esté deshabilitado o no exista sujeto/vínculo de canal. No necesita registrar un emisor ni fabricar un Subject para preparar una acción por el camino anterior. Adoptar una propuesta de ese camino en WhatsApp exige revisión explícita y revalidación antes de crear evidencia del canal, sin afirmar que ya se mostró anteriormente. Recuperar un recibo no fabrica basis ni fuerza renovación de su revisión histórica. La dependencia del RPC vivo se aplica a la operación por WhatsApp del propietario, no se añade a todas las rutas de negocio del dashboard.

Despliegue será gradual: migrar con modo interno deshabilitado, arrancar aplicación compatible, registrar emisor y ruta, comprobar Tenant/credenciales de salida sin enviarlas, probar vinculación con fixtures y después habilitar solo el establecimiento verificado. Cambiar secretos/configuración exige el registro de generaciones; no habilita la función por existir tablas vacías. No se ejecuta este plan en producción sin autorización.

Los jobs v1 se conservan y validan antes de enviarse contra modo actual; los v2 no pueden entrar al parser legado por un fallback. No se transforma `Staff.phone` en vínculo ni se adjudican mensajes históricos a operadores. Bases de revisión históricas no se inventan: una propuesta antigua requiere revisión/revalidación explícita antes de confirmar por el nuevo canal. Recibos existentes permanecen recuperables con su permiso actual.

Rollback operativo: apagar el modo interno y detener nuevos envíos sin borrar filas ni recibos; mantener una aplicación compatible con los campos nuevos. Si un trigger de fuente falla se corrige hacia adelante con migración y pruebas, no desactivando la revocación en producción. No se hace DROP masivo ni rollback destructivo de operaciones confirmadas.

## 9. Pruebas SQL y de concurrencia obligatorias al implementar

Estas pruebas no están ejecutadas con el diseño. Se correrán contra PostgreSQL 18 descartable y protegido para pruebas, con las migraciones integradas reales, sin credenciales ni datos productivos:

| Grupo | Casos mínimos y resultado exigido |
| --- | --- |
| Instalación | Migraciones desde cero y upgrade desde baseline local; Prisma generate, inspección de FKs/checks/índices/triggers y rollback ante un fallo de DDL. |
| NULL/alcance | Probar FK compuesta y guard simple con Tenant/principal ajenos; NULL en campos condicionales; flags control/private mezclados; forzar constraints al commit para verificar rechazo. |
| Vinculación | Dos activaciones concurrentes, dos operadores reclamando número, mismo operador dos números, desafío vencido y cinco fallos; solo un ganador y vínculo anterior intacto si falla el reemplazo. |
| Autoridad | Registro repetido y emisor de época anterior; caída de emisor; credencial A→B→A; reinicio con misma generación; delete/desactivar/reactivar fuente y rol/permisos restaurados no resucitan autoridad. |
| Triggers de fuente | Actualizaciones por repositorio, rutas existentes y SQL directo de campos vigilados; mismo commit actualiza generación, no pierde incremento en carrera y no cambia reglas de comisiones/precios. |
| Modo/cola | Wamid duplicado, payload incompatible, dos jobs del mismo flujo, abrir/cerrar/expirar sesión, claim vencido y job v1 listo mientras cambia modo; sin caída al cliente ni UUID de tarea nuevo por retry. |
| Revisión/confirmación | Corregir vs confirmar y doble confirmación entre canales; base antigua, expiración tras esperar lock, grant sin entrega aceptada o de otra revisión/sesión; un recibo/efecto, sin consume falso ante rollback. |
| Salida | Revocar antes de admitir y durante una llamada; rechazado comprobado vs timeout/crash en sending; sin datos después de revocación confirmada, sin reejecutar negocio por pérdida de envío. |
| Inmutabilidad | UPDATE/DELETE de mensajes, review, autorización, auditoría y recibo; borrado de digest permitido solo sin reabrir un desafío/prueba; recuperar un recibo no crea otra emisión. |
| Regresión | Casos dashboard existentes, clientes/recepción, toma humana, reservas y recordatorios; grep de repositorio completo para envíos directos y cruces de historiales. |

Los fixtures deben intentar violar constraints directamente, no solo mostrar que el camino feliz produce datos válidos. Después se ejecutan lint, suites backend/frontend, build y comprobaciones de seguridad/aislamiento apropiadas. Una prueba de transporte real será posterior, controlada y autorizada; las migraciones y pruebas locales no envían WhatsApp.

## 10. Evidencia de preparación y decisión solicitada

El borrador Prisma fue validado con el CLI local 7.10.0 mediante `prisma validate --schema` y una URL ficticia sin conexión. Además `migrate diff --from-empty --to-schema ... --script` renderizó SQL únicamente en memoria: 25 modelos (16 nuevos y nueve proyecciones), 56 FKs y ninguna referencia diferida ausente. **Ese resultado de proyecciones no es DDL para desplegar.** No se usó `db push`, `generate`, `migrate dev/deploy` ni conexión a una BD.

El DDL/funciones de guardas todavía deben ejecutarse/probarse durante la implementación, por lo que este documento **no declara demostrado su comportamiento SQL o concurrente**. La revisión estática identificó 18 checks (16 tablas nuevas y dos existentes), seis índices parciales y dos referencias diferidas; su ejecución real sigue siendo gate obligatorio.

Evidencia ejecutada el 2026-10-15:

```text
node node_modules/prisma/build/index.js validate --schema docs/architecture/operational-employees-whatsapp-schema-draft.prisma
The schema ... is valid; exit: 0

node node_modules/prisma/build/index.js migrate diff --from-empty --to-schema docs/architecture/operational-employees-whatsapp-schema-draft.prisma --script
exit: 0; 25 modelos, 16 nuevos, 56 FKs; referencias diferidas ausentes: 0
Salida procesada en memoria; sin aplicar SQL ni conectar a BD

node scripts/check-docs.cjs
documents: 324; markdownFiles: 305; checkedLinks: 987
broken: []; missingDocReferences: []; catalogueErrors: []; exactDuplicates: []; exit: 0

node --test scripts/check-docs.test.cjs
tests: 8; pass: 8; fail: 0; exit: 0

node --check scripts/check-docs.cjs
exit: 0

git diff --check
exit: 0; sin errores de formato
```

Se corrigió el verificador documental para que una URL externa con segmento `/docs/` no se interprete como archivo del repositorio, conservando la detección de referencias literales locales. Dos regresiones comprueban ambos casos; es mantenimiento del verificador, sin implementación del canal WhatsApp.

La aprobación de Etapa 5 autorizaría integrar el esquema, preparar/aplicar migraciones en BD local descartable, implementar los casos aprobados y su interfaz, y realizar las pruebas requeridas. No autoriza commit/push, despliegue, migración productiva ni envío real. Se evaluará el versionado al cierre funcional antes del commit/tag según la regla del proyecto; no se cambia versión por aprobar estos borradores.
