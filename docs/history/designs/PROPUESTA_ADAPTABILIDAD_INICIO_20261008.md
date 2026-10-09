# Tres ajustes de adaptabilidad para Inicio

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../ADAPTABILIDAD_INICIO_20261008.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Fecha: 2026-10-08. Estado: aprobada, implementada y comprobada localmente.

Resultado y evidencia: [Adaptabilidad de Inicio](../ADAPTABILIDAD_INICIO_20261008.md). Publicación pendiente.

## Qué ya está resuelto

Inicio ya adapta contenidos y permisos al perfil y a los módulos activos. Separa resultados administrativos de tareas operativas, concentra pendientes, distingue errores de lecturas vacías y conserva el establecimiento en la navegación. En celular muestra tres tipos de pendientes y permite desplegar los demás. La búsqueda general móvil ya está implementada.

La revisión del código actual identifica tres mejoras concretas. Son ajustes de presentación y navegación sobre operaciones existentes; no requieren otro módulo ni una fase nueva.

## 1. Ordenar el espacio según perfil y pantalla

**Situación actual:** en pantallas inferiores a 1280 px, «Necesita atención» aparece completo antes de la agenda. El orden de pendientes dentro de esa sección ya cambia según perfil; el orden de las secciones principales todavía es compartido.

**Propuesta:**

- Recepción: agenda y recepción de pacientes primero, seguida de pendientes de cobro y conversaciones autorizadas.
- Veterinario: pacientes de su área y documentación clínica pendiente a mano.
- Peluquero: trabajo y entregas de su área a mano.
- Administrador: prioridades del establecimiento y agenda, conservando resultados del negocio en su sección propia.

En tablet y celular, reducir el desplazamiento necesario para llegar a la operación principal. En escritorio, aprovechar dos columnas cuando exista espacio suficiente. Ajustar el orden del documento, no solo la posición visual, para mantener coherencia con teclado y lectura asistida.

Los permisos y módulos continúan determinando qué se muestra. El orden no concede capacidades nuevas ni duplica acciones ya presentes.

## 2. Convertir el resumen de jornada en un filtro útil

**Situación actual:** «Por llegar», «En espera», «En atención» y «Terminadas» muestran cifras, pero no tienen una acción.

**Propuesta:** al pulsar una tarjeta, filtrar la agenda de Inicio por ese grupo, señalar la selección y llevar al listado. Incorporar «Todas las citas» para volver al conjunto del día. Conservar la ficha y las acciones de cita existentes.

En celular, permitir llegar desde «En espera» directamente a esos pacientes. Las cifras siguen calculándose sobre la misma agenda autorizada y no cambian al filtrar. Una lectura fallida no debe presentar un cero ni una tarjeta activa con datos inexistentes.

## 3. Mostrar la antigüedad de los datos y actualizar al regresar

**Situación actual:** Inicio indica la hora consultada y ofrece actualización manual. No incorpora actualización al regresar a la pestaña ni al recuperar conexión.

**Propuesta:** indicar «Actualizado hace X minutos» y consultar nuevamente al volver a una pestaña con datos antiguos o al recuperar conexión. Mantener el botón manual y el estado de actualización parcial.

Evitar solicitudes repetidas al alternar pestañas rápidamente. Posponer la actualización mientras se edita una ficha o formulario, para conservar el trabajo abierto. Si falla una nueva lectura, señalarlo claramente y distinguir los datos anteriores de los recién confirmados. Recuperar conexión por sí solo no significa que el servidor esté disponible.

Este ajuste actualiza lecturas; no ejecuta cobros, cambios de estado ni envíos de mensajes.

## Orden recomendado y comprobación

Aplicar los tres como una única revisión de Inicio, empezando por el orden y las tarjetas. Comprobar:

- Administrador, recepción, veterinario y peluquero; combinaciones de módulos y permisos adicionales.
- Celular a 320 y 390 px, tablet y escritorio; navegación con teclado y ausencia de desbordamiento.
- Cada filtro de jornada, grupo vacío, lectura fallida y vuelta a todas las citas.
- Regreso a la pestaña, conexión recuperada, error del servidor y formulario abierto sin pérdida de texto.
- Lint, compilación y regresiones de Inicio.

Con estos ajustes y esas comprobaciones, Inicio puede darse por cerrado para el alcance actual. No hace falta seguir añadiendo métricas o tarjetas sin una necesidad concreta de trabajo.

La publicación del conjunto anterior continúa pendiente y no se considera realizada por esta revisión.
