# Administración: ajustes finales recomendados

Revisión del 7 de octubre de 2026. Los tres ajustes adicionales fueron aceptados, implementados y comprobados localmente. Diseño: ADR 018. Evidencia y alcance de publicación: [informe de verificación](../history/EQUIPO_AJUSTES_FINALES_20261007.md). Los apartados siguientes conservan el diagnóstico que originó la propuesta.

## 1. Corregir o anular una ausencia — prioridad alta

Hoy se puede registrar una ausencia y consultar su efecto, pero no rectificarla desde la pantalla. Si se introduce una fecha incorrecta o se cancela un permiso, ese rango sigue bloqueando nuevas asignaciones.

Propongo permitir **Corregir ausencia** y **Anular ausencia**, con motivo y conservación del antecedente. Al confirmar, volver a evaluar la disponibilidad y las citas afectadas. No se borrarían citas ni se cancelarían reservas automáticamente.

Este ajuste necesita definir primero el ciclo de corrección/anulación: StaffAvailability actualmente no tiene estado de anulación. No basta con añadir un botón que elimine la fila.

## 2. Elegir qué servicios atiende cada profesional — prioridad alta

El sistema ya tiene capacidades por integrante y las comprueba al asignar citas, pero Equipo no ofrece un editor para configurarlas. Su formulario de permisos controla el acceso al software; no determina qué servicios puede prestar.

Propongo añadir **Servicios que atiende**, con los servicios activos de su área y una explicación de la selección. Ejemplo: un veterinario puede atender consultas y vacunas, mientras otro también realiza ecografías.

Debe quedar explícita la diferencia entre usar los servicios compatibles con su perfil y restringirlo a una selección. Guardar los cambios debe mostrar las citas futuras que necesitan revisión. Se reutilizarían StaffCapability y su caso de uso existente.

## 3. Jornada con varias franjas — prioridad normal

Agenda ya respeta varias franjas estructuradas por día, pero el editor semanal solo permite una. Si un integrante trabaja de 8:00 a 12:00 y de 14:00 a 18:00, conviene poder configurar ambas sin abrir disponibilidad durante el almuerzo.

Propongo **Agregar franja** por día, validar cruces y guardar todas las franjas. El editor debe representar las mismas ventanas que utiliza Agenda, conservando las ausencias registradas.

## Administración como conjunto

Ya se revisaron Datos del negocio, Áreas del negocio, Servicios y precios, Horarios y disponibilidad y Equipo y accesos. No recomiendo agregar más secciones o métricas ahora.

Después de estos ajustes, recomiendo una comprobación conjunta de los perfiles administrador, recepción, veterinario y peluquero, contrastando menú, acciones y respuestas del servidor con las áreas habilitadas. Esto es una verificación de los permisos existentes, no una propuesta de nuevos roles.

Los cambios de Administración aún están locales. Antes de publicarlos corresponde revisar el conjunto, evaluar el versionado y aplicar en la VPS las migraciones incluidas, junto con commit, push y despliegue.

**Recomendación:** completar estos tres ajustes y después cerrar Administración con esa comprobación conjunta. No ampliar el alcance con nuevas pantallas en este momento.
