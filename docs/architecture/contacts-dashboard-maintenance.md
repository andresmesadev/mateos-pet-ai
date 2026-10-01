# Clientes y mascotas: organización del dashboard

## Alcance funcional

Mantenimiento del adaptador del dashboard: búsqueda persistente, estados vacíos claros, acceso directo a edición, presentación móvil y ficha organizada. No introduce entidades, reglas clínicas, cambios de precio ni una nueva fase.

## Casos de uso existentes

Buscar propietarios o mascotas, consultar y editar su ficha, consultar citas y registros, consultar notas de peluquería por visita y actualizar tarifas ya acordadas. La eliminación sigue usando el comando existente y su confirmación; una respuesta HTTP fallida no se interpreta como éxito.

## Arquitectura

Componentes cliente usan `proxyUrl`; la selección de establecimiento se conserva mediante `tenantQuery`. La ficha usa pestañas accesibles: datos y cuidados, historial y citas, peluquería y tarifas acordadas. La peluquería consulta su endpoint operativo paginado; no convierte las notas de baño o corte en registros clínicos. Las búsquedas sin coincidencias conservan el campo para corregirlas. Las listas se presentan como tarjetas en celular.

## Persistencia y esquema físico

Se reutilizan User, Pet, Appointment, MedicalRecord y tarifas acordadas existentes. Sin migraciones ni cambios del esquema. La resolución y conservación del precio permanecen en los servicios existentes.

## Continuidad desde la ficha

La ficha de mascota y cada mascota del propietario abren el mismo formulario de citas, con la selección inicial verificada contra el detalle autenticado del propietario. Si una mascota cambia de dueño o no puede verificarse, no se preselecciona una relación inválida. El formulario conserva la consulta real de disponibilidad y el comando existente para reservar; no se crea un segundo flujo de agenda.

Los cuidados destacados provienen exclusivamente de `Pet.notes`, conservando saltos de línea. No se infieren diagnósticos ni se interpreta la ausencia de observaciones como ausencia de alergias. La edición usa el PATCH de perfil existente.

Cada editor registra si tiene cambios pendientes o está guardando. Cierre con X, Escape, fondo y cancelación consultan un diálogo de descarte cuando existen cambios. Recargar/cerrar la página usa el aviso nativo `beforeunload`. Las pestañas conservan los borradores y durante un guardado se impide descartar o modificar ese formulario. La indicación de guardado usa la hora del éxito de la respuesta, no supone autoguardado ni reemplaza la auditoría del backend. Las notas, tarifas y creación de citas también conservan esta protección.

## Validación

Lint, compilación de producción, suite existente y comprobación del recorrido de consulta y edición sin guardar cambios en registros reales.

## Segunda revisión de fichas (2026-09-30)

Definición funcional: facilitar el registro y consulta de antecedentes existentes, mostrar identificación y alergias registradas sin inferir condiciones activas, y organizar la ficha del propietario por contacto, mascotas y citas.

Casos de uso: registrar vacuna, desparasitación, alergia o nota con campos legibles; consultar antecedentes sin cita; abrir notas de una visita de peluquería; buscar en el historial por texto y tipo; distinguir citas próximas, atenciones pendientes de cierre y citas anteriores en los datos disponibles del propietario.

Arquitectura: mantenimiento de adaptadores del dashboard; formularios accesibles con acciones visibles y protección de borradores. Las notas operativas de peluquería se editan con el diálogo y endpoint existentes de la cita. Las alergias se muestran como registros, sin afirmar que siguen activas. La búsqueda del historial opera sobre el timeline completo existente. Los registros de consultas vinculadas a citas se corrigen desde Consultas veterinarias, conservando el contrato de versiones.

Persistencia: se reutilizan Pet, User, Appointment, MedicalRecord y notas de peluquería. Esquema físico: sin cambios ni migraciones. La ficha del cliente informa que el endpoint actual devuelve sus cinco citas más recientes; no presenta esa selección como toda su agenda.

Diseño: conservar la tipografía y tokens actuales. Blanco (#ffffff) y fondo suave (#f4f8f7), texto oscuro (#18343d), acción verde (#087f73), ámbar para cuidados (#fffbeb) y rojo suave para alergias (#fff1f2). Alineación izquierda, datos de identificación en una franja compacta, formularios con espacio para observaciones y barra de acciones fija. Se evita convertir cada dato en una tarjeta decorativa: contacto en una sección, mascotas en filas con acciones y citas agrupadas por su situación real.

### Evidencia de verificación

`npm run lint` y `npm run build` del frontend: salida 0; producción genera 28/28 páginas. `node --test scripts/contact-profile-utils.test.cjs`: 6 pruebas aprobadas (fechas, edad, búsqueda, tipos y clasificación de citas). Suite existente del backend: 148 suites y 1128 pruebas aprobadas. `git diff --check`: salida 0.

Recorrido en Chrome local: validación de campos y próxima fecha, conservación de texto con saltos de línea al cancelar, guardado de vacuna y lectura directa de sus fechas y observaciones desde PostgreSQL, búsqueda sin acentos, protección de borradores en edición y antecedentes, acceso a las notas de una cita de peluquería no asistida en solo lectura y agrupación de una atención pendiente de cierre en la ficha del propietario. Vista de 390 × 844: sin desbordamiento horizontal y barra Guardar/Cancelar visible; tamaño temporal restablecido. La mascota y propietario temporales, sus tres registros y próxima acción se retiraron con comprobaciones de identidad y ausencia de citas; se conservaron los datos anteriores.

Las fechas de aplicación/control elegidas como día calendario se muestran sin desplazarlas a la víspera por UTC. Las fechas y horas de citas conservan Bogotá. Sin migraciones, commit ni despliegue en esta revisión.

## Navegación contextual de fichas (2026-09-30)

Definición funcional y casos de uso aprobados: abrir la consulta vinculada exacta desde el historial, consultar la agenda de un propietario concreto y leer la fecha/detalle de una alergia registrada. Son mejoras de adaptadores sobre capacidades existentes.

Arquitectura: enlaces con identificadores y fecha en Bogotá, conservando el establecimiento seleccionado. La consulta se selecciona únicamente entre las citas obtenidas por el endpoint autenticado de su semana; identificadores inexistentes o ajenos no abren otro registro. La agenda valida el propietario con su detalle autenticado y filtra por `Appointment.userId`, tanto en semana como en mes, con una acción explícita para quitar el filtro. El DTO existente de citas incorpora ese identificador; no introduce una identidad nueva ni se usa como autorización. Las alergias abren un detalle de solo lectura dentro de la ficha, conservando borradores.

Persistencia: Appointment.userId, MedicalRecord y relaciones existentes. Esquema físico: sin cambios ni migraciones. Decisiones diferidas: ninguna nueva regla de dominio, búsqueda histórica global nueva o política de autorización; se reutilizan la agenda por período y el editor/versionado clínico existentes.

### Verificación de navegación contextual

Frontend: `npm run lint` salida 0 y `npm run build` salida 0, con 28/28 páginas generadas. `node --test scripts/contact-navigation.test.cjs scripts/contact-profile-utils.test.cjs`: 9 aprobadas, 0 fallos. Backend: `npm test -- --maxWorkers=1 --workerIdleMemoryLimit=256MB --silent`, 148 suites y 1128 pruebas aprobadas. `git diff --check`: salida 0.

Chrome local: desde el historial de Nala se abre su consulta exacta del 28/09/2026 a las 11:30; desde Camila Ruiz, la agenda muestra únicamente sus tres citas, conservando el filtro en semana, mes, día y por profesional. Quitar el filtro restaura las seis citas del período. Un propietario inexistente muestra un aviso explícito; una cita inexistente no abre otra historia clínica.

La alergia temporal muestra 01/09/2025 y sus observaciones en un diálogo de solo lectura. Abrir y cerrar ese detalle conserva el título de una nota sin guardar; cerrar la ficha pide descartar el borrador. Los dos registros, mascota y propietario temporales se retiraron con la comprobación de identidad y ausencia de citas del script local; la lista vuelve a sus cuatro mascotas anteriores. Evidencia visual: `agenda-propietario.jpg` en la carpeta de visualizaciones de este chat. Sin cambios de esquema, commit ni despliegue.
