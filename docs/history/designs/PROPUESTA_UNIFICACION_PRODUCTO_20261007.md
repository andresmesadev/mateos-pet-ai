# Propuesta para mejorar y unificar Mateos Pet AI

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../UNIFICACION_PRODUCTO_20261007.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

## Objetivo

Que el establecimiento complete su trabajo con menos pasos, conserve el contexto al cambiar de pantalla y encuentre una única forma de realizar cada operación.

Esta propuesta parte de la revisión del Plan Maestro, el modelo de dominio, la regla de ejecución y la estructura actual del dashboard. Es una revisión de código y recorridos; no sustituye una auditoría visual completa ni una prueba de producción con todos los perfiles.

## Qué crear

### 1. Registrar un cliente y agendar sin salir del proceso

**Situación comprobada:** el formulario de cita manual exige cliente y mascota existentes. Si el cliente no aparece, ofrece ir a Clientes y mascotas para registrarlo.

**Propuesta:** incorporar «Registrar cliente y mascota» dentro del recorrido de creación de cita. Reutilizar los formularios y operaciones existentes y, al terminar, regresar a la cita con ambos seleccionados. Conservar el servicio, fecha y profesional elegidos; volver a comprobar disponibilidad antes de guardar.

También permitir agregar una mascota al propietario seleccionado desde ese recorrido, cuando el usuario tenga permiso para registrar contactos.

**Beneficio:** recepción puede resolver en un recorrido el caso «es la primera visita y quiero agendar».

**Alcance:** integración de interfaz, no una segunda base de clientes ni otra forma de resolver precios. La unicidad y las validaciones actuales siguen aplicándose.

### 2. Una guía de puesta en marcha dentro de Administración

**Propuesta:** un bloque breve «Prepara tu establecimiento» que enlace a las secciones ya construidas:

- Datos del negocio y áreas activas.
- Servicios y precios, cuando el negocio presta servicios.
- Horarios y disponibilidad, cuando usa agenda.
- Equipo y accesos.
- Productos y existencias, cuando corresponde.

La guía debe adaptarse a veterinaria, peluquería, tienda y sus combinaciones. Sus indicadores deben explicar exactamente qué pueden comprobar con los datos disponibles; «configurado» no significará que todos los recorridos fueron probados.

**Beneficio:** el propietario sabe por dónde empezar y puede abrir directamente cada configuración.

**Alcance:** mostrar y enlazar capacidades existentes. No pedir campos técnicos al empleado ni crear configuraciones paralelas.

### 3. Ayuda breve por perfil y operación

**Propuesta:** ayudas pequeñas junto a los procesos importantes: «Cómo recibir una cita», «Cómo guardar una consulta», «Cómo entregar una mascota» y «Cómo confirmar un cobro». Cada ayuda tendría de tres a cinco pasos y se mostraría únicamente en el módulo correspondiente.

**Beneficio:** capacitar a un nuevo trabajador sin convertir Inicio en un manual ni añadir otra sección grande al menú.

Las ayudas deben explicar las reglas reales: por ejemplo, un servicio completado puede tener ya un cobro registrado y requerir confirmar el método de pago. No deben inducir a crear otra venta.

## Qué unificar

### 4. Una pantalla principal por función y navegación que conserve el contexto

**Situación comprobada:** Clientes y mascotas y Administración ya reúnen funciones que todavía cuentan con páginas separadas. `/clients`, `/pets`, `/services` y `/staff` siguen renderizando pantallas propias. Otros accesos antiguos, como Reportes y Seguimiento, ya utilizan redirecciones.

**Propuesta:** usar como destinos principales:

| Función | Destino principal |
| --- | --- |
| Clientes y mascotas | Clientes y mascotas, con la pestaña y ficha seleccionadas. |
| Servicios y precios | Administración → Servicios y precios. |
| Equipo | Administración → Equipo y accesos. |
| Cobros y reportes financieros | Punto de venta y su pestaña correspondiente. |
| Seguimiento | Seguimiento de clientes y su pestaña correspondiente. |

Los enlaces antiguos deben llevar a esos destinos conservando establecimiento, cliente, mascota, cita, fecha y filtros que correspondan. Antes de sustituir una pantalla, comprobar que el destino conserva sus operaciones y permisos.

**Corrección concreta encontrada:** pulsar Enter en la búsqueda superior navega a `/dashboard/contacto?search=...` sin incluir el establecimiento seleccionado. La ruta antigua `/dashboard/reports` también redirige sin conservar sus parámetros. Revisaría estas entradas junto con el resto de la navegación.

**Beneficio:** el operador encuentra una función en un único lugar y vuelve al caso correcto al seguir un acceso.

### 5. Una presentación consistente del caso en atención

**Propuesta:** compartir un resumen breve del contexto entre Agenda, consulta, peluquería y ficha de la mascota: mascota, propietario, servicio, fecha, profesional y estado. Mostrar precio y acciones únicamente cuando el permiso lo permita.

Reutilizar los datos y acciones ya existentes, con enlaces claros hacia la ficha y el área responsable. Mantener diferenciados historia clínica, notas de peluquería y cobros, porque tienen responsabilidades y autorizaciones diferentes.

**Beneficio:** cambiar de pantalla sin perder qué paciente, visita o propietario se está atendiendo.

**Límite:** el resumen no tendrá sus propias reglas de estados, precios ni autorizaciones. Las operaciones seguirán perteneciendo a sus módulos actuales.

### 6. Confirmaciones y respuestas de formularios

**Situación comprobada:** existen diálogos del proyecto y confirmaciones nativas del navegador, por ejemplo en la ficha de cita.

**Propuesta:** aplicar un patrón común para confirmar, guardar, reintentar y advertir sobre cambios sin guardar. Mantener las confirmaciones y motivos obligatorios que cada operación ya exige, incluidos los requisitos para eliminar definitivamente un servicio o anular un movimiento.

Usar mensajes específicos: «No se guardó», «Guardado», «No se pudo comprobar» o «Datos anteriores», según la situación real. Extender la distinción entre vacío y fallo de lectura ya implementada en Inicio.

**Beneficio:** el usuario reconoce qué pasó y qué acción debe tomar en cualquier módulo.

## Qué quitar o retirar

### 7. Componentes del Inicio anterior que ya no se utilizan

**Hallazgo:** `OperationalHome` aparece únicamente en su archivo dentro del frontend revisado. Las secciones antiguas de métricas, conversaciones y recordatorios siguen en `home/sections.tsx`, mientras la página actual utiliza `HomeWorkspace`.

**Propuesta:** comprobar referencias en todo el repositorio, incluidas pruebas e importaciones indirectas, y retirar solamente los componentes y funciones que resulten inaccesibles. Mantener los lectores, tipos o componentes que sigan siendo compartidos.

**Beneficio:** evitar que una corrección futura se haga en una pantalla que el producto ya no utiliza.

### 8. Textos que presentan toda la plataforma como una veterinaria

**Hallazgo:** el registro inicial todavía dice «Registra tu veterinaria», «Datos de la veterinaria» y «Nombre de la veterinaria».

**Propuesta:** utilizar «establecimiento» o «negocio» en los procesos generales. Mantener «veterinaria» en las funciones clínicas y «peluquería» en sus funciones específicas.

**Beneficio:** una tienda o peluquería puede registrarse sin sentir que está usando un producto destinado a otro negocio.

### 9. Indicaciones documentales vigentes que quedaron desactualizadas

**Hallazgo:** la introducción del modelo de dominio aún describe Inventario como pendiente de diseño e implementación, mientras su sección específica y las notas posteriores registran la implementación.

**Propuesta:** reconciliar el estado vigente y los enlaces a informes de cierre, conservando los informes históricos. Registrar con claridad qué está implementado, qué está verificado localmente y qué está publicado en la VPS.

**Beneficio:** las próximas modificaciones parten de una descripción coherente del software real.

## Orden recomendado

| Orden | Trabajo | Resultado para el usuario |
| --- | --- | --- |
| 1 | Navegación, destinos principales y lenguaje general — puntos 4 y 8. | Funciones ubicadas en un solo lugar y contexto conservado. |
| 2 | Registrar y agendar en un recorrido — punto 1. | Primera visita más rápida para recepción. |
| 3 | Resumen del caso y patrones de formularios — puntos 5 y 6. | Trabajo más claro y consistente entre módulos. |
| 4 | Guía inicial y ayudas breves — puntos 2 y 3. | Puesta en marcha y capacitación más sencillas. |
| 5 | Retiro de código sin uso y reconciliación documental — puntos 7 y 9. | Base más fácil de mantener. |

## Cómo comprobarlo al implementar

- Cuenta administradora y perfiles operativos con sus permisos reales.
- Las siete combinaciones de veterinaria, peluquería y tienda.
- Primera cita de un cliente nuevo, cita de una mascota nueva de un propietario existente y regreso al borrador.
- Enlaces antiguos y búsqueda por Enter con establecimiento seleccionado.
- Fichas y acciones desde Agenda, consulta, peluquería y cobros.
- Errores de lectura, guardado, cambios pendientes y teclado/móvil.
- Lint, pruebas de los recorridos afectados y compilación.

Los cambios de interfaz reutilizarán los contratos existentes. Si un punto exige una regla de negocio, una entidad o persistencia nueva, se debe definir y aprobar su diseño antes de implementarlo, siguiendo la regla del proyecto.

## Estado

Propuesta aceptada por el responsable del proyecto e implementada localmente el 2026-10-07. Los hallazgos anteriores describen la revisión inicial, antes de los cambios. La evidencia, el alcance de las comprobaciones y las decisiones de limpieza están en [Unificación del producto](../UNIFICACION_PRODUCTO_20261007.md). Estos cambios todavía no están publicados en la VPS.
