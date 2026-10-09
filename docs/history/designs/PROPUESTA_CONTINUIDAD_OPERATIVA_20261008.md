# Próximas mejoras: continuidad de trabajo y uso en celular

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../CONTINUIDAD_OPERATIVA_20261008.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Fecha: 2026-10-08. Estado: aceptada e implementada localmente. Comprobaciones y límites en [Continuidad operativa](../CONTINUIDAD_OPERATIVA_20261008.md). Commit, push y despliegue pendientes.

La [unificación anterior](../UNIFICACION_PRODUCTO_20261007.md) está implementada y verificada localmente. Su commit, push y publicación siguen pendientes. Las propuestas siguientes afinan las operaciones existentes y no abren una fase nueva ni agregan módulos al menú.

## 1. Volver a una pantalla conservando sus filtros

**Qué encontré:** Inventario conserva ciertos estados recibidos por URL, pero su búsqueda y filtro de uso comienzan vacíos. Peluquería inicia fecha, búsqueda, vista y responsable en estado local; únicamente recupera una etapa concreta desde los parámetros. Consulta veterinaria recupera parte del contexto, mientras búsqueda y selección de profesional se inicializan por separado. La navegación ya conserva parámetros, pero no todas las pantallas reconstruyen sus filtros a partir de ellos.

**Mejora:** al abrir un expediente o cambiar de módulo y regresar, mantener la búsqueda, fecha, profesional, etapa y vista aplicables. Añadir una acción clara «Limpiar filtros» para regresar a la selección inicial. Los valores deben validarse con los permisos y las opciones actuales.

**Ejemplo:** buscar las mascotas listas para entrega de un peluquero, abrir una ficha y volver a ese mismo listado, sin seleccionar todo otra vez.

**Alcance:** normalizar el estado de navegación de los listados existentes. No conservar formularios sin guardar mediante este mecanismo, ni presentar datos almacenados como si fueran una lectura nueva del servidor. La selección pertenece a la pantalla, usuario y establecimiento correspondientes.

**Comprobación:** regreso desde ficha, recarga y botones Atrás/Adelante; filtros inválidos; cambio de establecimiento o usuario; permisos modificados; limpiar filtros sin afectar otro módulo.

## 2. Recuperar el borrador de WhatsApp al regresar

**Qué encontré:** WhatsApp conserva borradores por conversación dentro del componente, lo que permite alternar chats mientras permanece montado. No utiliza almacenamiento de sesión en esa vista: al abandonar el módulo, ese estado se pierde.

**Mejora:** conservar temporalmente el texto no enviado dentro de la misma sesión del navegador. Al regresar a la conversación, recuperar el borrador e indicar «Borrador recuperado», con opción de descartarlo.

**Ejemplo:** recepción escribe una respuesta, abre Agenda para verificar un horario y regresa al chat con el texto disponible.

**Alcance:** borrador local por usuario, establecimiento y conversación, con caducidad y limpieza al enviar correctamente, descartar o cerrar sesión. Volver a comprobar acceso antes de recuperarlo. No enviarlo automáticamente ni guardar esos textos como mensajes confirmados. No promete sincronización entre dispositivos.

**Comprobación:** cambiar de chat y de módulo; recargar; envío exitoso y fallido; descarte; caducidad; cierre de sesión; ningún borrador visible para otro usuario o establecimiento. Los ensayos de recuperación no enviarán mensajes reales.

## 3. Usar la búsqueda general también en celular

**Qué encontré:** el buscador superior de clientes y mascotas tiene `hidden sm:block`, por lo que no aparece en pantallas pequeñas. La mejora anterior conserva el establecimiento al buscar, pero no incorpora una entrada móvil.

**Mejora:** mostrar un botón de búsqueda en el encabezado móvil. Abre un diálogo adaptable con el mismo buscador y resultados existentes: mascota, propietario y acceso a su ficha. Incorporar foco inicial, cierre con Escape, navegación por teclado y retorno del foco al botón.

**Ejemplo:** localizar una mascota desde un celular mientras se recibe al paciente, sin navegar primero a Clientes y mascotas.

**Alcance:** reutilizar `/api/dashboard/search`, sus permisos y la navegación con contexto. La búsqueda seguirá apareciendo únicamente con acceso a contactos. No ampliar el catálogo de resultados ni construir otro buscador en backend.

**Comprobación:** ancho de 320–390 px, teclado móvil, resultados largos, vacío, error y reintento, lector de pantalla, selección conservando establecimiento y acceso según perfil.

## Orden recomendado

1. Publicar el conjunto ya verificado y comprobar los recorridos afectados con registros de prueba persistidos, antes de declarar la actualización disponible en la VPS. Las pruebas de unificación anteriores usan un backend en memoria; no certifican una nueva escritura real en PostgreSQL.
2. Implementar conservación de filtros, porque ayuda al trabajo diario de varios perfiles.
3. Habilitar la búsqueda móvil y recuperación de borradores de WhatsApp.

La publicación y las pruebas con persistencia son trabajo pendiente de la entrega anterior, no funcionalidades nuevas. Antes de ejecutar escrituras de prueba debe quedar definida su identidad y limpieza, sin tocar registros reales de clientes ni enviar mensajes sin autorización.

## Límites del diseño

Se reutilizan las entidades, endpoints y autorizaciones existentes. Se conserva Tenant como unidad de aislamiento y no se modifica el motor conversacional, las reglas de precios, las comisiones ni los estados de atención. Si la implementación exige nueva persistencia o una regla de dominio, ese punto debe pasar primero por el diseño y aprobación correspondientes.

Al preparar la propuesta se inspeccionaron las fuentes y la evidencia anterior. Tras su aceptación se implementaron los tres ajustes y se ejecutaron las comprobaciones registradas en el informe de continuidad operativa.
