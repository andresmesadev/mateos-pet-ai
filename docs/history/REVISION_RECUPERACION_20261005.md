# Revisión de Recuperación

Fecha: 2026-10-05. Alcance: revisión del módulo existente, su interfaz local, consultas, acciones y permisos. No se modificó código funcional ni se enviaron mensajes.

## Conclusión para el producto

Sí aporta valor: permite dar continuidad a controles, vacunas, tratamientos y próximas visitas, y contactar a clientes de peluquería que tardan en volver. Recomiendo conservarlo y presentarlo como **Seguimiento de clientes**, con acciones concretas y criterios visibles.

Hoy no está suficientemente integrado para darlo por cerrado. La pantalla mezcla seguimiento operativo, campañas y una estimación comercial de frecuencia. Esta última se basa exclusivamente en registros de peluquería; no acredita riesgo clínico, pérdida definitiva de un cliente ni retorno causado por un mensaje.

## Lo revisado

- Documentos oficiales: PLAN_MAESTRO, informe de Fase 1, modelo de dominio y regla de ejecución de Fase 2.
- Interfaz autenticada en localhost:3001/dashboard/recuperacion: Oportunidades, Reactivar y Riesgo de abandono.
- Estado local observado: cero resultados en las tres vistas. Esto permite valorar estados vacíos; no acredita el recorrido de campañas con destinatarios reales.
- Código de páginas, componentes, permisos y servicios que alimentan la sección.
- No se ejecutaron campañas, descartes ni cambios en clientes. No se alteraron los cambios de Inventario pendientes de publicación.

## Hallazgos

| Prioridad | Evidencia en el código | Consecuencia |
|---|---|---|
| Alta | `conversations.routes.js:204` consulta `MedicalRecord.nextControlAt`; el expediente dispone de `PetNextAction` y sus estados en `next-action.service.js`. | Los seguimientos creados directamente en el expediente no entran por esa fuente a Recuperación. Hay que reutilizar los seguimientos existentes y reconciliar los antecedentes sin duplicarlos. |
| Alta | `opportunities-view.tsx:65` descarta sin comprobar `response.ok`. `pets.routes.js:445` marca `reminderSent`, pero `/opportunities` no filtra ese indicador. | Un fallo HTTP puede parecer éxito. Incluso un descarte aceptado puede reaparecer al recargar. No debe confundirse descartar con enviar un recordatorio. |
| Alta | `dashboard-client.service.js:181` usa registros `grooming` con corte de 60 días. `metrics.routes.js:257` calcula frecuencia a partir de registros `grooming`, agrupados por propietario. | Las listas no representan veterinaria ni ventas de Pet shop. Un propietario con varias mascotas puede tener un patrón agregado que no describe el ciclo de cada mascota. Debe explicarse como señal comercial de peluquería, sin convertirla en criterio clínico. |
| Media | La página resume “+60 días”; el estado vacío de `reactivation-campaign.tsx:137` dice “último año”. La vista de riesgo habla de dos citas completadas, pero el cálculo usa registros de peluquería. | Textos contradictorios y una falsa impresión de certeza. Cero candidatos no demuestra que todos los clientes estén activos. |
| Media | `listInactiveClients` consulta hasta 500 propietarios y no recorre otros lotes; el cálculo de riesgo devuelve 50 por defecto. | Los contadores no garantizan el total del establecimiento. Hace falta paginación o información explícita sobre el límite. |
| Media | Contactar en Oportunidades y Riesgo abre `wa.me`; nombres de negocio y país aparecen codificados en componentes. | El contacto sale del espacio de trabajo y puede usar otra cuenta de WhatsApp. Conviene abrir la conversación existente y reutilizar la identidad del establecimiento. |
| Media | Reactivación llama `sendMessage`; el servicio `sendReactivationTemplate` existe, pero no tiene llamadores de producción. | No está conectado el camino preparado para plantillas. Antes de habilitar campañas como recorrido terminado hay que comprobar configuración, destinatarios y errores reales de entrega. |
| Media | La campaña presenta un bloque verde “Campaña enviada” aunque `sent` sea cero y haya fallos. | Debe distinguir envío completo, parcial y fallido, y conservar los destinatarios fallidos para revisión. |
| Media | Las tarjetas no se actualizan con los estados internos de las listas; la página exige que las tres consultas funcionen para mostrar cualquier vista. | Los contadores pueden quedar desactualizados y una consulta fallida bloquea herramientas que podrían seguir disponibles. |

## Propuesta de cuatro mejoras

### 1. Bandeja de pendientes integrada

Usar los seguimientos existentes del expediente como fuente de verdad, conservar el vínculo con mascota y consulta/cita y distinguir pendientes, realizados y descartados. Priorizar vencidos y próximos; añadir búsqueda por mascota o propietario. Actualizar la lista y sus contadores solo tras confirmación del servidor. Reconciliar los recordatorios antiguos con el modelo actual mediante un diseño concreto antes de modificar persistencia o semántica.

### 2. Pantalla y criterios según el módulo

Renombrar el ítem a **Seguimiento de clientes**. Proponer pestañas **Pendientes**, **Clientes por contactar** y **Resultados**, reutilizando las capacidades existentes. Mostrar la reactivación y frecuencia de peluquería solo cuando corresponda al módulo activo. En veterinaria, trabajar con la fecha de seguimiento indicada por el profesional; no considerar inactivo a un paciente solo porque no vuelve en 60 días. Para Pet shop, no inventar predicciones ni campañas de recompra sin un requisito y diseño aprobados.

### 3. Acciones conectadas con el trabajo diario

Por cada pendiente: **Ver expediente**, **Abrir conversación** y **Agendar cita**, reutilizando los componentes y permisos ya implementados. Mostrar fecha, motivo, mascota, propietario y estado de contacto. La navegación a WhatsApp debe preparar el trabajo sin enviar mensajes automáticamente.

### 4. Contacto y resultados claros

Antes del envío: selección explícita, teléfonos válidos, vista previa y comprobación del canal disponible. Después: enviados, fallidos y omitidos, sin anunciar éxito completo cuando hay errores. Mostrar resultados de contacto y regreso con definición visible, límites y alcance temporal real; el retorno posterior al contacto es una asociación, no una prueba de que la campaña lo causó. Reutilizar la infraestructura de Comunicación y evitar crear otro motor de campañas.

## Perfiles

Actualmente la navegación y las acciones de Recuperación son administrativas (`dashboard-access.service.js:37`, `allowVeterinaryDashboard.js`). Conservar este alcance en la primera mejora. Veterinarios ya gestionan seguimientos del paciente en el expediente; no necesitan recibir por defecto campañas comerciales o métricas administrativas. Si se delega seguimiento a recepción, definir y aprobar una capacidad operativa específica antes de ampliar los permisos.

## Límites y siguiente paso

Esta revisión propone corregir e integrar capacidades existentes. No declara un entregable implementado, no requiere bump de versión ni acredita envío real por WhatsApp. Los cambios de fuente de datos, estados o reglas que se acuerden deberán respetar el proceso de diseño del proyecto y reutilizar los servicios existentes. La comprobación del recorrido completo deberá cubrir pendientes del expediente, contacto, creación de cita, resolución y recarga, con datos aislados y sin mensajes a clientes reales.

## Implementación posterior aprobada

Las cuatro mejoras fueron aceptadas e implementadas. El alcance aplicado, las comprobaciones y sus límites se registran en [Seguimiento de clientes — verificación](SEGUIMIENTO_CLIENTES_20261005.md).
