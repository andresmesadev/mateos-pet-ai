# Integración de Seguimiento de clientes

2026-10-05. El responsable aceptó las cuatro correcciones de la revisión de Recuperación. Esta intervención repara e integra capacidades existentes; no abre un entregable de Fase 2, no introduce reglas de frecuencia clínica, estados, tablas o permisos nuevos.

## Definición funcional y casos de uso

La bandeja reúne los pendientes del expediente, permite buscar mascota/propietario, prioriza por fecha y reutiliza resolver/descartar una acción, ver expediente, abrir conversación y crear cita. La estimación de frecuencia e inactividad conserva su criterio de peluquería y solo se presenta con ese módulo activo. Resultados expone las métricas históricas existentes con su definición y sin atribuir causalidad al contacto.

## Arquitectura técnica

`/opportunities` mantiene `byType` y `total`, y añade paginación y procedencia. Un lector de presentación consulta `PetNextAction` pendiente y conserva recordatorios anteriores de `MedicalRecord.nextControlAt` que no tienen seguimiento asociado. Un registro asociado, incluso realizado/descartado, suprime el antecedente para evitar que reaparezca. Se reutilizan PATCH de acciones y retiro de recordatorios anteriores. El último comprueba HTTP y mantiene la semántica histórica de marcar `reminderSent`; la interfaz lo llama ocultar, no realizar una atención.

Las acciones de navegación son lecturas. Abrir conversación usa su identificador existente; sin conversación se informa la ausencia y se ofrece la ficha del cliente. Agendar usa `NewAppointmentDialog` y no resuelve el seguimiento automáticamente. El envío comercial usa exclusivamente la plantilla existente de Comunicación cuando el canal y la plantilla están configurados; se comprueba su disponibilidad antes de seleccionar/enviar. Nunca se presenta texto libre como plantilla aprobada. Resultados distingue fallidos y omitidos y conserva fallidos seleccionados. La interfaz usa el proxy autenticado y mantiene el tenant seleccionado.

## Persistencia y esquema físico

Se reutilizan `PetNextAction`, `MedicalRecord`, `User`, `Conversation` y las marcas existentes de envío. No se hace backfill, migración ni `prisma db push`. La conciliación de antecedentes es una proyección de lectura y no altera historia clínica. No se cambia el modelo de dominio ni las comisiones/precios.

## Decisiones diferidas

No se crea un gestor persistente de campañas, atribución causal, otra política clínica de retorno, capacidad delegada a recepción o segmentación de recompra de Pet shop. No se infiere aprobación de Meta solo por tener variables configuradas: los errores del proveedor permanecen visibles. El recorrido se prueba con base temporal y proveedores simulados, sin contactar clientes reales.

## Dirección visual

Mantener fuente y colores del dashboard: fondo claro #f3f8f7, superficie #ffffff, texto #19383d, acción #007f78, aviso #b45309. Bandeja con filas de mascota, fecha y acción; filtros accesibles y pestañas del sistema. Las cifras describen el resultado consultado, no agregan métricas comerciales al empleado. El espacio vacío explica cómo registrar un seguimiento en el expediente.
## Corrección de integración de permisos

`PATCH /next-actions/:id` estaba agrupado con rutas clínicas y rechazaba a un administrador de un establecimiento solo de peluquería. Se mantiene el mismo permiso administrativo y el mismo caso de uso: se corrige ese gate para módulos de atención activos. Las historias clínicas mantienen su gate veterinario y los demás roles conservan su política.
