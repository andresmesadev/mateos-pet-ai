# Administración: revisión y propuesta de mejora

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../ADMINISTRACION_REVISION_CONJUNTO_20261007.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Fecha: 2026-10-06. Estado: propuesta aprobada; primer bloque implementado y comprobado localmente. Evidencia: `docs/history/ADMINISTRACION_DATOS_NAVEGACION_20261006.md`.

## Cómo trabajarla

Sí: revisar y mejorar sección por sección, empezando por la organización común. En cada sección revisaremos qué necesita configurar el administrador, qué se puede simplificar, cómo se guarda y cómo afecta al resto del aplicativo. Cerramos cada bloque comprobando su recorrido antes de continuar.

## Qué existe y qué conviene cambiar

| Sección actual | Hallazgo | Propuesta |
| --- | --- | --- |
| Información general | Nombre, teléfono, correo y descripción. La dirección está en otra pestaña. | **Datos del negocio**: reunir información de contacto y dirección. Distinguir el nombre del establecimiento de una razón social fiscal. |
| Áreas del negocio | Ya permite activar veterinaria, peluquería y Pet shop, conservando antecedentes al desactivar. | Conservar **Áreas del negocio**; explicar qué pantallas y operaciones habilita cada área y hacer claro el resultado de guardar. |
| Localización y servicios | Mezcla dirección con creación, edición y retiro de servicios. | Mover la dirección a Datos del negocio y dejar **Servicios y precios** como sección propia. |
| Agenda y disponibilidad | Contiene horario general, horarios de veterinaria/peluquería y fechas especiales. | **Horarios y disponibilidad**: ordenar primero el horario habitual y después las excepciones. Mostrar las áreas que correspondan al establecimiento. |
| Gestión de usuarios | Administra integrantes, horarios, acceso y permisos adicionales. La cuenta administradora ya puede atender y responder. | **Equipo y accesos**: distinguir datos del integrante, trabajo que realiza, horario y permiso para ingresar. Mantener el acceso del administrador que también atiende. |
| Importar contactos | Ya tiene vista previa y resumen de resultados. La pestaña anuncia Outlook/Google, pero el componente exige el CSV de Mateos Pet con columnas de mascotas y menciona una exportación por Claude AI. | **Importar clientes y mascotas**, dentro de Herramientas: unificar instrucciones con el formato realmente aceptado, explicar qué datos se actualizan y presentar errores accionables. |
| Perfil fiscal | No permite configurar información fiscal: muestra “Próximamente” y repite datos del negocio y plan. | Retirarlo de la navegación principal. No presentar facturación electrónica como una función disponible ni implementarla dentro de esta mejora. |

## Organización recomendada

Cinco secciones principales:

1. **Datos del negocio**
2. **Áreas del negocio**
3. **Servicios y precios**
4. **Horarios y disponibilidad**
5. **Equipo y accesos**

La importación queda como **Herramientas → Importar clientes y mascotas**, accesible cuando se necesite cargar información.

## Orden de ejecución y mejoras concretas

### 1. Datos del negocio y navegación

- Reunir contacto y dirección en una pantalla clara, con campos agrupados y etiquetas visibles.
- Unificar botones, ancho del contenido, espaciado y mensajes con el resto del dashboard.
- Avisar antes de abandonar un formulario con cambios sin guardar: actualmente el cambio de pestaña desmonta la sección.
- Conservar la sección seleccionada en la URL para volver a ella al recargar y compartir un enlace directo.
- Dar a la navegación estados accesibles y manejo por teclado; actualmente son botones con selección visual.

### 2. Áreas del negocio

- Explicar de forma breve qué habilitan Veterinaria, Peluquería y Pet shop.
- Diferenciar selección pendiente de configuración guardada.
- Explicar el efecto de desactivar un área y conservar la política existente de mantener su historial.
- Comprobar que una tienda sola no presente opciones de atención que no utiliza.

### 3. Servicios y precios

- Añadir búsqueda y filtros por área y estado para encontrar servicios sin recorrer todo el catálogo.
- Mostrar nombre, duración en minutos y precio en COP con la misma jerarquía visual.
- Explicar los servicios con precio variable y conservar las tarifas por mascota ya existentes.
- Hacer claras las acciones Editar, Retirar y Reactivar; retirar un servicio conserva sus antecedentes.
- Sustituir la confirmación nativa de retiro por un diálogo coherente con el proyecto.

### 4. Horarios y disponibilidad

- Separar horario habitual, horarios por área y fechas especiales con una explicación de su relación.
- Aclarar días cerrados y las horas de apertura/cierre; revisar mensajes de validación.
- Mantener visible la revisión de citas afectadas al modificar una fecha especial, que ya existe.
- Integrar la referencia a los horarios del equipo sin duplicar su configuración.

### 5. Equipo y accesos

- Facilitar localizar integrantes y distinguir activos de retirados.
- Separar “integrante del equipo” de “acceso al aplicativo”: tener una ficha no implica tener credenciales.
- Mostrar un resumen entendible del perfil y de sus permisos adicionales antes de guardar.
- Ordenar edición, horario, habilitación/cambio de acceso y revocación como acciones diferenciadas.
- Comprobar los perfiles y combinaciones de áreas que ya ofrece el software; esta revisión no requiere inventar roles nuevos.

### 6. Importar clientes y mascotas

- Corregir la contradicción entre instrucciones y parser antes de promover esta herramienta.
- Indicar claramente formato, columnas requeridas, ejemplo y tratamiento de contactos existentes.
- Conservar y mejorar la vista previa y el resumen existentes, sin duplicarlos.
- Mostrar qué filas necesitan corrección y proteger el formulario frente a importaciones repetidas mientras una operación está en curso.

## Criterio de cierre por sección

Comprobar carga, edición, guardado, recarga y persistencia; validación y errores; permisos y aislamiento por establecimiento; vista móvil y teclado. Cuando haya cambios implementados, ejecutar lint y las pruebas pertinentes y registrar resultados reales.

Esta propuesta mejora capacidades existentes. No incluye nuevas reglas de precios, facturación electrónica, roles nuevos ni cambios de aislamiento.

## Evidencia de la revisión

- `frontend/components/dashboard/settings-tabs.tsx`: siete pestañas, selección local inicial en Información general, secciones desmontadas al cambiar.
- `frontend/components/dashboard/settings-view.tsx`: datos del negocio; dirección junto a servicios; horarios; perfil fiscal informativo sin configuración.
- `frontend/components/dashboard/business-modules.tsx`: selección y guardado de áreas existentes.
- `frontend/components/dashboard/staff-manager.tsx` y `team-permissions.tsx`: integrantes, horarios, credenciales, cuenta administradora y permisos adicionales.
- `frontend/components/dashboard/contacts-importer.tsx`: parser CSV, vista previa y resumen de importación existentes.
- `frontend/components/dashboard/agenda-exceptions-manager.tsx`: fechas especiales y revisión de citas afectadas existentes.

La revisión original no modificó el aplicativo. Tras la aprobación se implementó el primer bloque y se ejecutaron lint, pruebas de backend/navegación, build y comprobación en navegador con PostgreSQL local.

La implementación identificó que `Tenant.phone` también resuelve el canal entrante de WhatsApp. Se protege como dato de solo lectura; editar un teléfono de contacto independiente requiere separar ese dato del identificador actual. Esta corrección evita que la reorganización del formulario afecte la recepción de mensajes.

Actualización posterior autorizada, 2026-10-06: se implementó `Tenant.contactPhone` como dato independiente, nullable, sin copiar el identificador del canal. Diseño en `business-contact-phone-20261006.md` y evidencia en `../ADMINISTRACION_TELEFONO_CONTACTO_20261006.md`.

Segundo bloque autorizado y comprobado, 2026-10-06: **Áreas del negocio** tiene tarjetas explicativas, selección pendiente, descarte, confirmación de desactivación, recuperación de errores y actualización del menú según el acceso real. Se verificaron siete combinaciones de áreas, cuatro perfiles y conservación del historial en PostgreSQL, además del recorrido en navegador. Evidencia en `../ADMINISTRACION_AREAS_20261006.md`. Siguiente revisión propuesta: **Servicios y precios**.

Tercer bloque autorizado y comprobado, 2026-10-06: **Servicios y precios** tiene búsqueda, filtros, Activos/Retirados, formulario centrado, precio explícito, edición protegida y retiro recuperable. Las pruebas comprobaron persistencia real y conservación de tarifas por mascota e historia. Evidencia en `../ADMINISTRACION_SERVICIOS_PRECIOS_20261006.md`. Siguiente revisión propuesta: **Horarios y disponibilidad**.
