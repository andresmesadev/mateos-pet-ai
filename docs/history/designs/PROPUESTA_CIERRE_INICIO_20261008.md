# Dos ajustes finales propuestos para Inicio

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../CIERRE_INICIO_CONTINUIDAD_Y_SEGUIMIENTOS_20261008.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Fecha: 2026-10-08. Estado: aprobada, implementada y verificada localmente.

Inicio ya incorpora accesos por perfil, accesos adicionales plegables en móvil y tablet, agenda filtrable, prioridades paginadas y actualización al regresar. Estas dos propuestas completan la continuidad de uso sobre las capacidades existentes.

## 1. Volver al mismo filtro y página

**Problema comprobado:** el filtro de jornada y la página de prioridades viven en el estado del componente. Se conservan durante una actualización, pero se reinician al salir de Inicio y regresar.

**Propuesta:** recordar el filtro elegido y la página de «Necesita atención» durante la sesión de trabajo, reutilizando la infraestructura de continuidad de otros módulos.

**Ejemplo:** recepción filtra «En espera», abre una ficha o entra al punto de venta y vuelve a Inicio. Recupera «En espera» y la página de prioridades en la que estaba trabajando.

Condiciones:

- Separar las preferencias por usuario y establecimiento.
- Respetar los filtros explícitos de un enlace de entrada.
- Validar las preferencias con los permisos, módulos y páginas disponibles al regresar.
- Ajustar una página guardada si la lista de prioridades se redujo.
- Limpiar esas preferencias al cerrar sesión o cambiar de usuario, siguiendo el mecanismo existente.
- Consultar datos actuales; se recuerda la vista seleccionada, sin recuperar una lista anterior como si fuera nueva.

**Comprobación:** salir y regresar, recargar, entrar por un enlace con filtro, cambiar de establecimiento o usuario y reducir la lista mientras una página posterior estaba seleccionada.

## 2. Mostrar la antigüedad de los seguimientos

**Problema comprobado:** Inicio ya recibe la fecha prevista de cada seguimiento y distingue los que corresponden a hoy o a días anteriores. Los ejemplos de «Seguimientos por revisar» muestran el nombre de la mascota, pero omiten esa fecha.

**Propuesta:** acompañar cada ejemplo con una indicación breve:

- «Para hoy».
- «Pendiente hace 3 días».
- La fecha prevista, para que el usuario pueda comprobar el dato.

**Ejemplo:** al comparar dos mascotas con seguimiento pendiente, el equipo identifica cuál lleva varios días esperando antes de abrir su expediente.

Condiciones:

- Calcular días de calendario en hora de Colombia.
- Mostrar un estado de fecha no disponible cuando el dato sea inválido.
- Conservar el aviso de que Inicio muestra una selección breve; el módulo sigue conteniendo el listado completo.
- Mantener los permisos, destinos y orden de prioridades existentes.

**Comprobación:** seguimiento de hoy, uno anterior, cruce de medianoche en Colombia, fecha inválida y perfil sin acceso a seguimientos.

## Alcance y cierre

Ambas propuestas pertenecen a presentación y navegación. Reutilizan entidades, fechas, permisos y mecanismos existentes; no requieren tablas ni nuevas reglas de negocio.

Recomiendo implementar primero la continuidad de la vista y después las fechas de seguimiento. Tras verificar ambos ajustes con los cuatro perfiles y los tamaños de pantalla actuales, Inicio puede cerrarse para este alcance.

Ambos ajustes quedaron implementados y verificados. Evidencia y alcance en [el informe de cierre](../CIERRE_INICIO_CONTINUIDAD_Y_SEGUIMIENTOS_20261008.md). El conjunto local continúa pendiente de commit, push y publicación.
