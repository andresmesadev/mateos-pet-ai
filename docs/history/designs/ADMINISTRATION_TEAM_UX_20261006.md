# Equipo y accesos: mejora del adaptador existente

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../ADMINISTRACION_EQUIPO_ACCESOS_20261006.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Solicitud: continuar la revisión de Administración, con perfiles, permisos y disponibilidad claros.

## Alcance funcional aprobado por el responsable

Ordenar el equipo con búsqueda por nombre/correo/teléfono y filtros de perfil/estado. Mostrar separadamente la ficha, el acceso individual, los permisos adicionales y el horario semanal. Validar los formularios y conservar borradores ante errores o navegación. Usar los mismos botones y hoja centrada del dashboard.

## Contratos y persistencia

Se reutilizan Staff, StaffCredential y las rutas existentes de registro, edición, activación, credenciales y permisos. No se cambian los cuatro perfiles ni su autorización. Recepción conserva Caja incluida; el administrador puede atender con su cuenta actual. Los permisos se explican según las áreas habilitadas, conservando los valores ya guardados.

El horario individual conserva el JSON Staff.availability, fuente vigente del adaptador según ADR 003. Null significa sin restricción individual. Abrir el editor no asigna silenciosamente un horario 08:00–18:00. La personalización empieza con el horario vigente del área; guardar exige HH:mm y apertura anterior al cierre. Quitar la restricción vuelve a null de forma explícita. No hay schema ni migración.

## Arquitectura

StaffManager gestiona la lista y una única hoja de edición. Formularios separados reportan cambios/guardado a SettingsTabs y protegen cierre/cambio de sección. Todos los requests usan proxyUrl + tenantQuery. Los errores de carga son recuperables y distintos de un equipo vacío. El adaptador valida el JSON antes de escribirlo.

## Diseño visual

Conservar paleta verde del dashboard (primary), fondo claro, tipografía existente y etiquetas visibles. Lista con acciones agrupadas y estado de acceso explícito; edición centrada con contenido desplazable. Sin desplegar permisos en cada tarjeta. Adaptación móvil mediante filas y botones que se envuelven, campos a ancho completo y foco visible.

## Decisiones arquitectónicas diferidas

La revisión confirma que las ausencias del dominio viven en StaffAvailability y el horario del dashboard en Staff.availability. ADR 003 prohíbe sincronizarlos implícitamente: antes de ofrecer un editor de ausencias como bloqueo de Agenda se necesita diseñar y documentar esa integración y revisar los puntos de asignación. Este lote no afirma que el horario individual reserve capacidad ni que cancele citas existentes. El caso de uso público conserva su funcionamiento.

## Validación

Pruebas de rutas reales sobre PostgreSQL local temporal: crear/editar, validar horarios y permisos, aislamiento, activación y campos de credenciales mínimos. Lint completo, build aislado y recorrido UI de errores, borradores, búsqueda, permisos y horario con minutos. La comprobación UI de credenciales se limita a leer controles; introducir o cambiar contraseñas corresponde al usuario.
