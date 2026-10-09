# Seguimiento de clientes: siguientes ajustes propuestos

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../SEGUIMIENTO_CLIENTES_AJUSTES_FINALES_20261005.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Fecha: 5 de octubre de 2026. Estado: aceptada, implementada y verificada localmente.

Evidencia de cierre: [SEGUIMIENTO_CLIENTES_AJUSTES_FINALES_20261005.md](../SEGUIMIENTO_CLIENTES_AJUSTES_FINALES_20261005.md).

La revisión parte del código actual de Pendientes, Clientes por contactar y Resultados, y del informe `docs/history/SEGUIMIENTO_CLIENTES_20261005.md`. La pantalla ya integra búsqueda, expediente, conversación, creación de cita, resolución de pendientes y revisión del envío.

## 1. Prioridades por fecha más claras

Añadir accesos rápidos **Fechas pasadas**, **Hoy** y **Próximos 7 días**, con las cantidades correspondientes al filtro consultado. En cada fila, mostrar una indicación como **Vence hoy**, **Dentro de 3 días** o **Fecha pasada hace 2 días** junto a la fecha exacta.

Beneficio: el administrador identifica qué revisar primero sin interpretar toda la lista. Las fechas vienen del seguimiento registrado por el profesional; no se introduce una frecuencia clínica automática. El filtrado y sus cantidades deben aplicarse sobre el conjunto completo del establecimiento, antes de paginar.

## 2. Contacto reciente más visible

Destacar **Último contacto registrado** y permitir filtrar por su fecha en Clientes por contactar. Mantener esa información también en la confirmación de destinatarios, para que el administrador identifique a quienes ya contactó.

Beneficio: facilita revisar la selección y evita repetir contactos por descuido. Usa la marca existente `lastReminderSentAt`; un contacto registrado no acredita que el destinatario leyó el mensaje. La elección de destinatarios sigue siendo explícita y el filtro no establece una prohibición nueva de envío.

## 3. Paginación real de clientes

Sustituir el recorte actual de los primeros 500 propietarios por búsqueda y paginación en el servidor para Clientes por contactar. Conservar el máximo de 500 destinatarios de cada solicitud de envío y su revisión explícita. Ordenar por fecha de última visita y un identificador estable, para presentar primero los clientes con más tiempo sin volver.

Beneficio: un establecimiento con más registros puede encontrar a todos los clientes que cumplen el criterio. La búsqueda actual trabaja únicamente sobre la lista recibida. Este ajuste requiere modificar el contrato de lectura y verificar aislamiento, cantidades, navegación y selección entre páginas; no cambia el criterio vigente de inactividad de peluquería.

## Prioridad y cierre

La paginación tiene la mayor prioridad funcional porque corrige una limitación real. Los otros dos ajustes mejoran el trabajo diario con los datos existentes.

Tras aplicar los ajustes aceptados y verificar el recorrido, corresponde cerrar esta revisión del módulo. La comprobación de envío real queda condicionada al canal y la plantilla aprobada/configurada, con destinatarios de prueba expresamente autorizados. Hasta ahora se comprobó el comportamiento del proveedor mediante simulación, sin mensajes a clientes.

Estas propuestas conservan el acceso administrativo y los criterios específicos de cada módulo. No implican una nueva entidad, migración o entregable de una fase futura.
