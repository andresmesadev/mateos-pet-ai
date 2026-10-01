# WhatsApp — mantenimiento del dashboard (2026-09-30)

## Definición funcional aprobada

Facilitar la atención de conversaciones existentes: buscar propietarios en toda la bandeja, priorizar solicitudes humanas, leer mensajes por fecha, conservar borradores al cambiar de chat y abrir las fichas/citas del propietario verificado. El usuario aprobó estos cuatro ajustes. Se reutilizan los tokens claros del dashboard, con verde para las acciones y ámbar para atención humana; lista y chat en escritorio, navegación entre ambos en celular.

## Casos de uso y arquitectura

La búsqueda y paginación se aplican en el adaptador autenticado de lectura, por establecimiento y sobre el hilo agrupado por propietario. El filtro humano lee `Conversation.status`, fuente vigente desde Comunicación 3.1; no infiere urgencia clínica. El detalle reúne las sesiones del mismo propietario/tenant y presenta la sesión más reciente como destinataria de las acciones existentes. El operador envía texto por Enviar Mensaje y resuelve la solicitud por Resolver Escalación, con confirmación que explica el retorno a estado activo.

El chat muestra fechas de Bogotá y origen registrado, sin inventar confirmaciones de entrega/lectura. Los borradores permanecen en memoria por propietario durante esta visita, con aviso al recargar/cerrar; no se promete persistencia. Las solicitudes de actualización se cancelan al cambiar filtros o establecimiento. Los errores preservan texto y permiten reintentar; cambiar de chat no arrastra su estado. Fichas y reservas usan ClientSheet/NewAppointmentDialog existentes, con userId obtenido del detalle autenticado, nunca deducido del teléfono. Todos los endpoints cliente usan proxyUrl con tenantQuery.

## Persistencia y esquema físico

Se reutilizan User, Conversation, Message, Pet y Appointment. Se exponen identificadores, estado y origen ya persistidos; sin nuevas entidades, migraciones ni cambios del motor conversacional. No se modifica la política de escalamiento ni el caso de uso de envío.

## Decisiones diferidas

Confirmaciones de entrega/lectura y adjuntos requieren contratos que no están disponibles hoy; no se añaden controles ficticios. No se agregan reglas de urgencia, asignación de personal, automatizaciones ni plantillas nuevas.

## Verificación prevista

Lint/build del frontend; pruebas de agrupación, búsqueda/paginación y aislamiento del adaptador; recorrido local con registros temporales y destinatario de prueba sin teléfono (el envío se rechaza antes de invocar el proveedor), incluyendo filtro, borrador, error de envío, resolver solicitud y preselección del propietario. Retirar exclusivamente los registros temporales después de comprobar el recorrido. No enviar mensajes reales ni desplegar en esta revisión.

## Evidencia de verificación (2026-09-30)

- `npm run lint` en frontend: exit 0.
- `npm run build` en frontend: exit 0, TypeScript correcto, 28/28 páginas generadas.
- Suite completa de backend: 150 suites y 1136 pruebas aprobadas, 0 fallos (47.563 s). Incluye búsqueda, estado humano canónico, enlaces a sesiones anteriores, aislamiento entre establecimientos y fallo del proveedor sin mensaje ficticio.
- `node --test scripts/whatsapp-workspace.test.cjs`: 3 aprobadas, 0 fallos. Comprueba mezcla de mensajes ante respuestas tardías, paginación superpuesta y día de Bogotá.
- Navegador local: 28 propietarios temporales, primera página de 25 y carga de los 3 restantes; búsqueda global por nombre y teléfono con formato; filtro de atención humana; tres mensajes de dos sesiones reunidos por propietario y separados por fecha.
- Borrador multilineal conservado al cambiar de propietario y al volver desde su ficha mediante el enlace a la conversación; la ficha se cierra al navegar, respetando su protección de cambios. Envío rechazado por teléfono vacío: texto conservado y error visible. No se envió ningún mensaje real.
- Resolución confirmada de la solicitud: estado `activa` y desaparición del filtro humano, aunque permanezca una bandera legada en sessionData. Ficha con mascota correcta y formulario de cita con propietario preseleccionado; formulario cerrado sin crear una cita.
- Vista de celular a 390 × 844: ancho de contenido 380 y scrollWidth 380, botón de envío de 44 px visible; navegación lista/chat comprobada y tamaño normal restaurado.
- `node scripts/verify-whatsapp-dashboard-local.cjs verify`: correcto. `cleanup`: exclusivamente 28 propietarios, 29 sesiones, 3 mensajes y 1 mascota temporales retirados con validaciones de base local/identidad; datos anteriores conservados. Bandeja real vacía comprobada después de la limpieza.
- `git diff --check`: exit 0. Los componentes nuevos de WhatsApp no usan apiUrl cliente hacia endpoints autenticados.

La captura `whatsapp-atencion.jpg` conserva la vista con datos de prueba anterior a su limpieza. Los borradores permanecen únicamente durante la visita: no sobreviven a una recarga. La aceptación de mensajes por WhatsApp se cubre con pruebas del contrato y fallos simulados; no se comprobó entrega a un destinatario real. Es mantenimiento de capacidades existentes, sin cierre oficial de fase ni tag/versionado nuevo en esta revisión.

## Ajustes de interfaz aprobados (2026-10-01)

El usuario aprobó una distribución familiar a WhatsApp Web: bandeja compacta, herramientas de conversación y panel del propietario. El dominio y la persistencia siguen siendo los existentes; se reutilizan los adaptadores autenticados de Comunicación, Clientes, Mascotas y Agenda. No cambia el motor conversacional, la identidad del establecimiento ni las reglas de envío.

Dirección visual: tipografía sans del dashboard, fondo de mensajes `#efeae2`, mensajes recibidos blancos, enviados `#d9fdd3`, acciones `#008069`, encabezados `#f0f2f5` y selección `#e9edef`. El contenedor aprovecha la altura disponible y conserva el scroll dentro de cada panel. A partir de 1536 px, la información del propietario ocupa una tercera columna; por debajo se presenta como panel lateral con foco protegido. En celular se navega entre bandeja y chat. Se eligió 1536 px al comprobar que tres columnas a 1280 px reducían demasiado la conversación.

La búsqueda recorre el historial cargado, tolera tildes/mayúsculas y permite navegar entre coincidencias sin mover la página. Copiar usa el portapapeles y comunica el resultado. Los emojis se insertan en el borrador, respetando selección y límite de 4096 caracteres; el campo crece hasta 128 px. El aviso de mensajes nuevos se basa en nuevos identificadores entrantes durante las actualizaciones existentes de cinco segundos: conserva la lectura y permite volver al final. No representa un conteo persistido de chats no leídos ni añade estados de entrega/lectura.

El panel muestra propietario y mascotas obtenidos por identidad autenticada. Reutiliza ClientSheet para la ficha completa, PetMedicalSheet para el expediente y NewAppointmentDialog con propietario/mascota preseleccionados. Abrir estas acciones conserva el borrador; no se agregan reglas clínicas ni rutas nuevas.

### Evidencia final

- Frontend `npm run lint`: exit 0, sin advertencias. `npm run build`: exit 0, TypeScript correcto y 28/28 páginas generadas.
- `node --test scripts/whatsapp-workspace.test.cjs`: 5 aprobadas, 0 fallos. Las dos comprobaciones nuevas cubren búsqueda y fechas de Bogotá.
- Jest enfocado de backend: 2 suites, 8 pruebas aprobadas, 0 fallos (1.436 s). Se mantiene el aislamiento y el rechazo ante error del proveedor.
- Navegador: búsqueda «HORARIOS» con 41 coincidencias y navegación a «2 de 41», copia de texto comprobada, emoji 🐾 insertado, campo de cinco líneas expandido, error de envío conservando texto y borradores separados entre propietarios.
- Mensaje entrante temporal: aviso «1 mensaje nuevo» visible y posición del historial idéntica antes/después (85.6 px); al pulsarlo se llega al final. La búsqueda final mantuvo scrollY de la página en 0 y movió únicamente el historial.
- Panel: expediente correcto y formulario de cita con `Luna de prueba` seleccionada; formulario cancelado sin crear cita. Ficha completa y regreso al chat comprobados.
- Celular 390 × 844: clientWidth/scrollWidth 390, altura de documento 844; botón de envío de 44 px visible. Panel con foco de diálogo y navegación bandeja/chat comprobados.
- Escritorio 1536 × 864: tres columnas, chat de 564 px y documento sin overflow. Tamaño temporal restaurado. Captura de prueba guardada como `whatsapp-web-2026-10-01.png`.
- Script local `verify`: correcto, sin mensajes externos. `cleanup`: retirados exclusivamente 28 propietarios, 29 sesiones, 44 mensajes y 1 mascota de prueba; datos anteriores conservados. `git diff --check`: exit 0.

Los cambios de esta revisión quedan en local; no hay cierre oficial de fase, tag ni nueva versión. La captura contiene datos temporales que ya se retiraron.
