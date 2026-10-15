# Empleados operativos por WhatsApp — Etapa 2: casos de uso

Fecha: **2026-10-15**, Colombia. **Estado: Etapa 2 aprobada explícitamente por el responsable.**

Aprobación recibida: «Aprobar Etapa 2 y pasar a arquitectura». Autoriza preparar la [Etapa 3](operational-employees-whatsapp-technical-design.md), sin implementar todavía.

La [Etapa 1](operational-employees-whatsapp-functional-definition.md) fue aprobada con «Aprobar Etapa 1 y pasar a casos de uso». Este documento concreta el acceso del propietario y del personal a Financiero y Administración/Inventario. No autoriza programar ni selecciona tablas, rutas o protocolos entre servicios. La [regla de ejecución](../PHASE_2_EXECUTION_RULE.md) exige aprobar esta etapa antes de diseñar arquitectura.

## 1. Contrato y actores

El canal incorpora los mismos ocho [casos operativos F1–F3 y A1–A5](digital-employees-use-cases.md), con sus validaciones vigentes. Vincular un teléfono no concede permisos ni crea otro empleado. El [modelo de dominio](domain-model-v1.md) registra la ampliación conceptual aceptada en Etapa 1; los plazos, límites y flujos de este documento fueron aprobados en Etapa 2.

| Actor | Responsabilidad y autoridad |
| --- | --- |
| Operador propietario/administrador global | Usa su identidad administrativa real del dashboard; cada vínculo selecciona un solo Tenant. No adquiere consultas globales por WhatsApp. |
| Operador del personal | Usa su propia cuenta activa de Staff y credencial vigente; conserva rol, áreas y permisos actuales. |
| Administrador del establecimiento | Puede revocar los vínculos de su establecimiento. No vincula un teléfono haciéndose pasar por otra persona ni lee por ello sus solicitudes privadas. |
| Autoridad de autenticación | Comprueba que la cuenta original sigue habilitada y que su autorización no fue revocada. Para el administrador global no se sustituye por un Staff ficticio. |
| Aplicación y empleados digitales | Resuelven una tarea autorizada, piden aclaraciones y preparan propuestas. La IA no autentica, asigna permisos ni confirma operaciones. |
| Comunicación | Recibe y entrega mensajes bajo el Tenant y destinatario autorizados, con historial interno separado del de clientes. |

La identidad conserva el mismo dueño usado en el dashboard: `staff:<id>` para personal o `admin:<correo canónico>` para la cuenta administrativa real. Es una regla de correspondencia, no un identificador que el remitente pueda elegir. Una persona con dos cuentas distintas no fusiona sus atenciones por compartir nombre, correo de contacto o teléfono.

### Autoridad administrativa y revocación

El administrador global actual se autentica en el dashboard y no tiene `StaffCredential`. Su vinculación, activación y renovación requieren una comprobación reciente de sus credenciales actuales por la autoridad real de ese acceso. Una sesión antigua del navegador por sí sola no acredita esa comprobación. No se envían esas credenciales por WhatsApp.

Al consultar, preparar, corregir, confirmar, recuperar y entregar datos privados se debe comprobar que sigue vigente la autoridad que habilitó el vínculo. Cambiar credenciales/correo administrativo o revocar el acceso invalida las autorizaciones anteriores de WhatsApp. Si la autoridad no responde, se deniega temporalmente la operación interna. Una marca guardada de «es admin» no cumple este contrato. La Etapa 3 deberá demostrar el mecanismo concreto con la autenticación actual antes de aprobarse; no podrá omitir el acceso del propietario ni inventar un `staffId` para resolverlo.

Para Staff se comprueban cuenta, credencial, versión de sesión, Tenant, rol y módulos actuales. Desactivar cuenta/credencial o invalidar su versión revoca el acceso vinculado; reactivar la cuenta requiere una nueva vinculación. Una reducción de permisos invalida las propuestas y respuestas afectadas; no se conserva autoridad por estar dentro de una sesión aún no vencida.

## 2. Reglas comunes aprobadas

| Aspecto | Regla funcional |
| --- | --- |
| Establecimiento | Lo identifica el canal receptor verificado y coincide con el vínculo. Nunca lo elige el modelo o un ID escrito en el chat. El Tenant debe estar activo. |
| Número | Dirección individual normalizada; un vínculo activo por operador y canal receptor del Tenant, y un único operador por número en ese alcance. No se admiten grupos. |
| Vinculación | Se inicia en el dashboard, se prueba desde el número esperado y se activa en el dashboard con la misma identidad. Un código aislado no activa acceso. |
| Vigencia del desafío | Cinco minutos desde su creación, incluida la activación final. Un desafío nuevo invalida el anterior; la vinculación anterior sigue vigente hasta completar el reemplazo. |
| Intentos | Máximo cinco intentos fallidos desde el número esperado por desafío; nueva solicitud tras al menos 60 segundos y máximo tres inicios por cuenta/Tenant en una hora. Se limita también el abuso por remitente. Mensajes de otro número no consumen los intentos de la persona esperada ni revelan a quién pertenece el desafío. |
| Modo negocio | Entrada explícita con `/negocio`; salida a atención de clientes con `/clientes`. Identidad y alcance se muestran únicamente después de autorizar la entrada. |
| Sesión interna | Quince minutos de inactividad y máximo absoluto de ocho horas desde activación o renovación verificada en dashboard. Solo actividad interna autorizada renueva la inactividad; no amplía las ocho horas. |
| Reentrada | Tras inactividad o salida voluntaria puede abrirse otra sesión con `/negocio` dentro de las ocho horas, si vínculo y autoridad siguen vigentes. Después se requiere reafirmar el acceso desde el dashboard. El mensaje que encontró la sesión vencida no se ejecuta automáticamente al reabrirla. |
| Propuestas | Conservan la vigencia actual de quince minutos desde su preparación/revisión. Consultar o reabrir sesión no la extiende. Una propuesta vencida exige nueva revisión y confirmación. |
| Confirmación | Acción interactiva nativa, separada y asociada a la propuesta completa mostrada. Queda vinculada a Tenant, operador, vínculo, sesión, acción, revisión y vigencia. Texto libre, mensajes reenviados y respuestas del modelo nunca confirman. |
| Entrega | Se revalida el destinatario, vínculo, autoridad, permisos y sesión inmediatamente antes de cada envío privado pendiente. Si expiraron, se bloquea; reabrir sesión no reproduce una respuesta antigua automáticamente. |

Los plazos usan el reloj del servidor. Los nombres «vínculo pendiente/activo/revocado», «modo negocio», «propuesta» o «resultado incierto» describen el contrato; no seleccionan enums ni estructuras persistidas. La actividad de clientes no renueva una sesión interna.

La entrada debe proceder de un evento auténtico del proveedor, con remitente y receptor comprobados e identificador estable para deduplicación. El fallback actual para mensajes sin identificador no es suficiente para vincular o confirmar; esos mensajes no pueden producir efectos internos. Las comprobaciones y cambios de permisos se coordinan con la ejecución para impedir una escritura que use una autorización ya revocada. Una respuesta que el proveedor ya aceptó antes de revocar no puede retirarse retroactivamente.

## 3. Inventario de casos

| Caso | Trabajo | Efecto de negocio |
| --- | --- | --- |
| W1 | Solicitar vinculación desde dashboard | Ninguno |
| W2 | Probar control del número desde WhatsApp | Ninguno |
| W3 | Activar o reemplazar vínculo en dashboard | Ninguno |
| W4 | Abrir, renovar y cerrar modo negocio | Ninguno |
| W5 | Revocar acceso | Ninguno |
| W6 | Consultar Finanzas — F1 | Lectura |
| W7 | Buscar y consultar Inventario — A1–A3 | Lectura |
| W8 | Preparar gasto o entrada — F2/A4 | Propuesta |
| W9 | Corregir o descartar propuesta | Propuesta, sin gasto ni movimiento |
| W10 | Confirmar gasto o entrada — F3/A5 | Un gasto o una entrada |
| W11 | Recuperar atención o recibo entre canales | Lectura del resultado propio |
| W12 | Entregar resultado y convivir con atención de clientes | Comunicación separada |

### W1 — Solicitar vinculación

**Actor y entrada:** operador en su propia sesión autenticada del dashboard, Tenant concreto y número que controla. El propietario global elige un Tenant permitido por su acceso; el personal utiliza su Tenant autenticado.

**Flujo:** comprobar cuenta y habilitación actual, pedir comprobación reciente de identidad, validar número y ausencia de conflicto, crear desafío temporal y mostrar instrucciones para enviar `/vincular <código>` al WhatsApp del establecimiento. El dashboard muestra el destinatario del negocio y su nombre. No se envía un mensaje proactivo al teléfono ni se solicita una contraseña en el chat.

**Resultado:** solicitud pendiente y plazo visible; todavía no hay acceso interno. Solo puede haber un desafío vigente para ese operador y canal. Un fallo no revoca un vínculo activo anterior.

**Rechazos y aceptación:** sesión ajena, número inválido, Tenant no permitido, canal receptor no identificable, cuenta inactiva o límites excedidos impiden iniciar. Tener `Staff.phone` igual al número no evita este caso. La respuesta sobre un conflicto no revela la identidad privada del otro operador.

### W2 — Probar control del número

**Actor y entrada:** número esperado envía el comando de vinculación al receptor esperado. Este comando es reservado: nunca llega al modelo, RAG ni motor de clientes.

**Flujo:** comprobar autenticidad e identidad del evento, Tenant, número, desafío actual y plazo; registrar la prueba y mostrar en el dashboard que falta la activación final. Se puede responder una instrucción genérica sin datos del negocio. El mismo evento repetido conserva el resultado de prueba, sin crear otro vínculo.

**Resultado:** prueba del teléfono pendiente de aceptación en dashboard. El desafío no es una sesión de negocio y no permite consultar datos.

**Rechazos y aceptación:** código erróneo, expirado, de otro número/Tenant, evento no verificable o intentos agotados no acreditan control. Los códigos no se guardan en claro en la cola general de entrada, historial de mensajes, logs, tareas o memoria del modelo: antes de almacenamiento general solo puede permanecer una representación que no permita reutilizarlos. La arquitectura debe resolver este requisito también ante reintentos y reinicios; no basta con ocultarlos en pantalla.

### W3 — Activar o reemplazar vínculo

**Actor y entrada:** la misma identidad autenticada que inició W1, prueba W2 vigente y aceptación explícita en dashboard.

**Flujo:** volver a comprobar autoridad y permisos, mostrar Tenant, teléfono probado y alcance. Informar que las respuestas internas circularán por WhatsApp. El operador activa el vínculo antes de vencer el desafío. Se consume una sola vez y se habilita la ventana máxima de ocho horas, sin abrir automáticamente un chat interno.

**Reemplazo:** verificar primero el número nuevo y activar de forma indivisible el reemplazo; solo entonces revocar el vínculo previo y sus sesiones/confirmaciones pendientes. Un teléfono ya vinculado a otro principal en ese Tenant/canal no se toma ni se sobrescribe. Se resuelve desde el dashboard sin atribuir la identidad ajena al solicitante.

**Aceptación:** dos activaciones concurrentes producen un solo vínculo, desafío consumido y ninguna ambigüedad. Prueba por WhatsApp sin aceptación final, aceptación por otra cuenta o desafío vencido nunca activan. Cambiar de número requiere repetir W1–W3; cambiar `Staff.phone` no mueve el vínculo.

### W4 — Abrir, renovar y cerrar modo negocio

**Entrada:** `/negocio` desde un vínculo activo y dentro de su ventana de autorización. La aplicación verifica autoridad vigente y presenta el establecimiento y las tareas permitidas. Si solo existe un empleado activo elegible de la especialización, se utiliza; si hay varios, se pide selección explícita, siempre dentro del Tenant.

**Flujo:** abrir atención interna separada y recibir la tarea. Una petición que mezcla tareas se aclara antes de ejecutar; no se encadena una consulta financiera con una escritura inferida. Dentro de este hilo hay como máximo una propuesta seleccionada para revisión. Una consulta no la modifica; iniciar otra escritura requiere resolver explícitamente si se mantiene o descarta la anterior. No se pierden las otras solicitudes existentes del dashboard.

**Renovación:** tras ocho horas, reafirmar desde el dashboard la misma identidad y vínculo mediante comprobación reciente de credenciales; si cambia el número, repetir W1–W3. La renovación no reactiva propuestas ni confirmaciones anteriores; debe mostrarse otra vez la propuesta vigente y autorizarse una confirmación de la nueva sesión.

**Salida:** `/clientes` cierra la sesión interna, invalida sus acciones de confirmación y permite volver a atención del cliente. No ejecuta ni descarta una operación por inferencia. Los borradores y recibos permanecen recuperables bajo autorización actual.

**Aceptación:** al vencer o fallar acceso se responde solo con una indicación genérica para restablecerlo o salir. No se entrega ese mensaje al Recepcionista. Una conversación de cliente existente, incluida su toma humana, no se modifica por abrir/cerrar modo negocio. Se conserva la obligación de cambiar explícitamente a `/clientes` después de un bloqueo interno.

### W5 — Revocar acceso

**Actor:** el propio operador revoca su vínculo; un administrador autorizado puede revocar vínculos de su Tenant desde dashboard. Revocar no permite leer la conversación privada ni suplantar a su dueño.

**Flujo:** comprobar el alcance del actor, registrar la revocación y cerrar sesiones/confirmaciones afectadas. Una cuenta desactivada, cambio de credenciales o versión de sesión inválida bloquea el uso sin esperar la siguiente apertura. La reducción de permisos bloquea las tareas correspondientes, incluidas respuestas ya preparadas.

**Resultado:** el número sigue existiendo como contacto, pero perdió la autorización interna. Rehabilitar una cuenta no reactiva el vínculo revocado; requiere nueva vinculación. Una operación ya confirmada y registrada conserva su recibo; no se anula por revocar el canal.

**Aceptación:** revocación anterior al punto de ejecución impide el gasto/entrada; revocación anterior al envío impide la entrega privada. Si la ejecución se completó primero, se conserva y se recupera desde un canal actualmente autorizado. El cliente puede recuperar la atención ordinaria solo mediante cambio explícito de modo.

### W6 — Consultar Finanzas (F1)

**Entrada:** operador con permiso financiero, empleado activo y tipo de consulta con fechas claras. Se admiten historial, cierre diario existente y período oficial existente. «Ayer» se convierte en fecha civil del negocio y se muestra; fechas ambiguas se aclaran. Se conserva la semántica vigente de Finanzas y su límite de historial de 31 días, sin una política horaria nueva.

**Flujo y salida:** consultar la fuente oficial con autorización actual; mostrar establecimiento, fecha de consulta y cifras exactas. Distinguir cierre oficial de vista preliminar y página de total completo. Un cierre o período no generado se informa, no se crea. Resultados extensos continúan por páginas o por dashboard autenticado.

**Aceptación:** personal de recepción sin Finanzas no obtiene cifras; no hay vista consolidada de otros Tenant; una fuente caída no se reemplaza por un dato antiguo presentado como actual. El modelo no recalcula saldos ni atribuye causas inventadas.

### W7 — Buscar y consultar Inventario (A1–A3)

**Entrada:** búsqueda, detalle o movimientos bajo los permisos y módulos actuales. `inventory_read` permite A1/A2 según las áreas visibles; A3 exige `inventory_manage`. Vincularse no concede gestión de inventario.

**Flujo:** buscar en catálogo del Tenant y mostrar resultados identificables con presentación/unidad. Pedir selección cuando el producto no sea inequívoco; la selección conserva la búsqueda y se revalida contra fuente/área actual. La aplicación resuelve la identidad del producto; ni un nombre escrito ni un ID propuesto por el modelo prueban acceso.

**Salida:** stock físico/disponible/vencido, lotes, alertas o movimientos según la proyección permitida. Los costos ocultos siguen ocultos. Paginar mantiene filtros, producto y Tenant; no se suman páginas como si fueran un total global. Un resultado vacío no crea un producto.

**Aceptación:** producto ajeno o no visible no revela su existencia; una búsqueda ambigua se aclara antes de usarla en entrada. No hay compra, consumo ni cambio de precio por consultar una alerta.

### W8 — Preparar gasto o entrada (F2/A4)

**Precondiciones:** sesión, permiso y empleado activos. Si existe otra propuesta seleccionada, resolverla primero según W4.

**Gasto:** recopilar importe, descripción, día civil, categoría, responsable declarado, medio de pago y notas opcionales. Conservar límites, categorías, decimales y comprobación de día cerrado de F2. Mostrar todos los defaults; el responsable declarado no sustituye al autor autenticado. «Prepara un gasto de 25.000 por insumos» todavía requiere los datos faltantes o defaults visibles.

**Entrada:** resolver producto existente y activo con W7; pedir cantidad, costo y lote/vencimiento según su política. Conservar cantidades enteras, límites de saldo/costo, fechas y reglas de lote de A4. No convertir cajas en unidades ni deducir precio de venta. Registrar stock no registra simultáneamente un gasto financiero.

**Resultado:** propuesta completa del comando exacto, nombre de establecimiento, referencia y revisión, vencimiento y opciones de corregir/descartar/confirmar. Preparar no crea gasto ni movimiento. Si no puede mostrarse de forma íntegra y asociada a la acción de confirmación, se exige revisión en dashboard y no se habilita confirmar esa vista parcial por WhatsApp.

**Aceptación:** texto malicioso de nombres/notas no altera permisos ni confirma. No se inventa producto, cantidad o costo. Una propuesta incompleta solo pide datos; una llamada adicional del modelo no se convierte en aprobación humana.

### W9 — Corregir o descartar

**Entrada:** acción seleccionada, revisión observada y corrección o descarte explícito del dueño autorizado. Si hay ambigüedad, se pide elegir.

**Flujo:** corregir genera revisión inmutable y nueva vista completa; cualquier cambio invalida la confirmación anterior. Se comprueban permisos y reglas actuales. Cambiar producto vuelve a comprobar política de lote y campos aplicables. Una edición simultánea desde dashboard no se pisa: se informa el conflicto y se presenta la revisión vigente antes de continuar.

**Descarte:** cierra solo la propuesta elegida. No elimina auditoría ni anula un gasto/movimiento ya registrado. Ante ejecución incierta se consulta evidencia antes de afirmar que se descartó sin efectos.

**Aceptación:** corrección, descarte y confirmación concurrentes tienen un único resultado coherente. Una confirmación de la revisión anterior no se aplica a datos nuevos. Repetir descarte no tiene efecto financiero.

### W10 — Confirmar gasto o entrada (F3/A5)

**Entrada:** acción interactiva nativa emitida por el sistema para la propuesta completa revisada. La aplicación comprueba que procede del remitente, canal, Tenant y sesión esperados, que corresponde a ese mensaje/propuesta/revisión y que no es texto libre o reenvío. La referencia no contiene datos privados ni concede autoridad por conocerla.

**Flujo:**
1. Revalidar cuenta, vínculo, sesión, permisos y propiedad de la acción. No se usa el contenido reenviado por el teléfono como fuente del comando.
2. Resolver primero si la misma acción ya tiene recibo. Bajo autorización actual, devolverlo como recuperado; no ejecutar otra vez aunque la propuesta original haya vencido o el empleado esté ahora pausado. Esto no permite usar una confirmación ajena o de otra sesión como acceso al recibo: en esos casos se utiliza W11 desde la sesión actual.
3. Si no tiene recibo, exigir empleado activo y revisión íntegra y vigente. Si algún dato relevante cambió, presentar otra revisión y pedir nueva confirmación. Confirmar y ejecutar por el contrato operativo existente: Finanzas controla el gasto y el día cerrado; Inventario controla producto, lote, movimiento y saldo. La autorización anterior no sirve para saltar una revocación concurrente.
4. Vincular resultado, operador y revisión a un solo recibo recuperable. Certificar los eventos del negocio mediante el mecanismo existente; no publicarlos otra vez desde el canal.
5. Entregar el resultado real con W12. Si falla el envío, recuperar con W11; no reiniciar la operación.

**Aceptación:** doble pulsación, duplicación del webhook o concurrencia con dashboard producen como máximo un gasto/entrada. Un «sí», «confirmo», «hazlo todo», contenido reenviado o instrucción al modelo no confirma. Acción antigua de otra sesión, revisión, persona o Tenant se rechaza sin revelar datos. El reintento conserva la misma operación lógica; una clave nueva nunca se usa para ocultar incertidumbre.

Si la capacidad interactiva no permite acreditar este contrato, la confirmación se completa en dashboard autenticado. No se degrada a una contraseña/código pegado en texto. La viabilidad y representación de esa interacción deberán demostrarse en Etapa 3.

### W11 — Recuperar atención o recibo

**Entrada:** operador actualmente autorizado solicita su atención desde dashboard o desde una sesión interna vigente. Se comprueban el mismo principal, Tenant y permiso de la operación. Conocer la referencia no basta. No se permite recuperar conversaciones de otra identidad por ser administrador.

**Flujo:** consultar la solicitud y evidencia existentes, presentar estado/revisión o el recibo real; no crear otra solicitud para el mismo evento de entrada. Si hay ejecución en curso o resultado incierto, informar y continuar la recuperación existente. La ausencia temporal de recibo no prueba que no hubo efecto.

Una propuesta propia iniciada en dashboard puede revisarse en WhatsApp y viceversa. Cada canal muestra de nuevo la revisión completa y emite su propia acción de confirmación bajo autorización actual; ambos apuntan a la misma operación. El token viejo del otro canal no se reutiliza ni transfiere como permiso.

**Aceptación:** cierre de sesión, proceso reiniciado, pérdida de respuesta HTTP o incertidumbre del proveedor no crean otro gasto/entrada. Recibo comprometido antes de pausar el empleado sigue recuperable con permiso actual; una ejecución nueva requiere empleado activo. Un vínculo revocado impide recuperar por WhatsApp, pero no borra el acceso legítimo del dashboard.

### W12 — Entregar respuesta y separar atención de clientes

**Flujo:** toda salida se solicita a Comunicación con destinatario interno verificado. Antes de enviar contenido privado pendiente, comprobar de nuevo autoridad, permisos, vínculo y sesión actuales. Las respuestas de confirmación usan el recibo; las consultas identifican su fecha y alcance. Una entrega rechazada no se envía al contacto de cliente «equivalente» ni al canal por defecto de otro Tenant.

**Separación:** no se crea `User` ficticio; no se reutiliza la conversación de cliente para guardar gastos, saldos, códigos o permisos del operador. Historial, contexto del modelo, bandeja y búsquedas de clientes no incluyen las atenciones internas. Una misma persona puede ser cliente, pero el cambio explícito de modo conserva memorias y autorizaciones separadas.

**Bloqueo:** una solicitud interna con acceso vencido/revocado o una acción reservada inválida recibe únicamente indicación genérica para restablecer acceso o entrar a `/clientes`. Nunca se entrega silenciosamente al motor de reservas. Un remitente sin historial de modo interno sigue el flujo actual para mensajes ordinarios; pedir acceso interno no le concede información.

**Entrega incierta:** se conserva la evidencia de aceptación/estado del proveedor y no se repite la ejecución del negocio para regenerar una respuesta. Si no se puede determinar si un envío fue aceptado, se informa al recuperar; no se promete entrega exactamente una vez. Una respuesta bloqueada por permiso o sesión no se reproduce automáticamente tras restaurarlos: el operador solicita de nuevo la consulta o recibo autorizado.

**Aceptación:** mantener cliente y operador con el mismo teléfono no mezcla historiales, escalaciones ni asignaciones humanas. Ningún mensaje saliente nuevo omite Comunicación. Un enlace de continuación usa autenticación del dashboard, sin secretos de acceso en URL.

## 4. Auditoría y eventos

Las operaciones reales conservan `GastoRegistrado` y `EntradaDeInventarioRegistrada`, además de las tareas/decisiones y publicación recuperable del mecanismo existente. Consultar, preparar, corregir, descartar, vincular o abrir sesión no certifica un gasto ni una entrada. Confirmar una entrada no genera un gasto implícito.

Se requiere evidencia de quién inició/probó/activó/revocó un vínculo, abrió/cerró una sesión, revisó/confirmó una propuesta y recibió o no una respuesta. Incluye Tenant, identidad real, origen y correlación con tarea/operación; no contraseñas, códigos reutilizables ni razonamiento privado del modelo. Son requisitos de auditoría de acceso, **no nuevos tipos de evento de negocio ni disparadores de Automatizaciones aprobados aquí**. Su representación y conservación se diseñan después.

## 5. Validación funcional exigida a la implementación futura

| Escenario | Evidencia esperada |
| --- | --- |
| Propietario global y personal | Ambos completan W1–W4 bajo su propia identidad, sin Staff ficticio ni permisos extra. |
| Prueba incompleta o robada | Código desde otro teléfono/Tenant, desafío vencido, activación de otra cuenta y replay no habilitan acceso; no quedan códigos reutilizables en colas/logs. |
| Conflicto y reemplazo | Una sola identidad por número/alcance; el vínculo anterior solo se revoca al activar el reemplazo. |
| Revocación y autoridad caída | No hay lectura, preparación, escritura, recuperación ni entrega privada con acceso inválido, incluida cuenta administrativa. |
| Cambios de permiso/módulo | Finanzas, costos y movimientos quedan protegidos incluso si la respuesta estaba preparada. |
| Sesiones y coexistencia | Inactividad, ocho horas, salida y reentrada no ejecutan mensajes antiguos ni mezclan memorias con clientes. |
| Ocho casos existentes | Mismas validaciones y resultados que dashboard; producto ambiguo, defaults y fechas se aclaran. |
| Confirmación | Solo acción autorizada de la revisión vigente; texto libre, reenvío, botón viejo o revisión concurrente no escriben. |
| Concurrencia/reinicio | Un evento repetido, doble confirmación y pérdida de respuesta recuperan una sola operación y sus eventos. |
| Cambio de canal | Mismo principal/Tenant recupera recibo, sin permitir referencias ajenas ni importar autoridad de otro canal. |
| Comunicación | Sin `User` ficticio ni envíos directos; revocación antes del envío bloquea contenido privado. |
| Regresión de clientes | Reserva, toma humana, recordatorios y deduplicación/recuperación actuales siguen funcionando. |

Primero se probará con datos sintéticos y transporte simulado; una prueba posterior con un número real y envío controlado requerirá su autorización concreta. Este diseño no ejecuta envíos.

## 6. Límite de la siguiente etapa

Tras aprobar estos casos, la Etapa 3 debe resolver la autoridad revocable del administrador actual; la vinculación y sus secretos antes de almacenamiento durable; el enrutamiento sin caída al bot de clientes; la separación de destinatarios/hilos internos; la interacción de confirmación verificable; la coordinación de autorización/revocación con ejecución y entrega; y la recuperación de entrada/salida sobre la infraestructura existente.

También auditará que el receptor y las credenciales de salida identifican el mismo Tenant en el WhatsApp ya conectado. Si algún archivo protegido requiere edición, deberá justificarse con el [ADR 010](../decisions/010-reconciliacion-motor-conversacional-memoria.md) y documentar la reconciliación pertinente. No se resuelven estas dependencias con otro número por defecto, permisos hardcodeados, un cliente ficticio o duplicando el motor. Persistencia y esquema físico siguen siendo etapas posteriores.
