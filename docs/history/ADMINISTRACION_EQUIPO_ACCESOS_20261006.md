# Administración: Equipo y accesos

Fecha: 6 de octubre de 2026. Revisión y mantenimiento de la sección existente, a solicitud del responsable del proyecto.

## Qué quedó aplicado

- Búsqueda por nombre, correo y teléfono, sin distinguir tildes ni mayúsculas. Filtros por perfil y por integrantes activos/inactivos. Las tarjetas se agrupan por los cuatro perfiles existentes.
- Ficha, perfil/permisos, horario y acceso se editan por separado en una hoja centrada. Los permisos dejan de ocupar todas las tarjetas del equipo.
- Formularios con etiquetas, errores recuperables, protección del borrador al cerrar y comunicación del estado de edición/guardado a Administración. Un fallo de carga muestra Reintentar; no se presenta como un equipo vacío.
- Recepción muestra Caja como permiso incluido. Los permisos adicionales explican su alcance y las áreas deshabilitadas; se conservan los permisos previamente guardados. La ficha vinculada al correo del administrador utiliza su cuenta existente.
- El horario individual no se rellena ni persiste al abrir el editor. Personalizarlo utiliza el horario del área/establecimiento. Admite minutos, valida entrada anterior a salida y permite quitar explícitamente la restricción individual. Guardar horario queda fijo al pie de la hoja.
- Activar, desactivar y revocar acceso tienen confirmación dentro del aplicativo. La desactivación conserva la ficha y el historial. Una ficha vinculada a la cuenta administradora no afirma que desactivarla elimine ese acceso administrador.
- Validación de nombre, teléfono, correo, estado y horario en el servidor, antes de la primera escritura. Un horario inválido no deja guardado el nombre enviado junto a él.
- Todas las peticiones del navegador usan el proxy autenticado y el contexto del establecimiento. No se modificó el modelo de autorización ni se agregaron tablas o migraciones en esta revisión del equipo.

## Comprobación real

### Lint del frontend

Ejecutado con Node de Windows en el directorio frontend:

```text
node node_modules/eslint/bin/eslint.js .
Salida vacía; código de salida: 0.
```

### Compilación aislada

El build de comprobación utiliza NEXT_VERIFY_BUILD=1 y webpack; su salida está separada del servidor de desarrollo del usuario.

```text
next build --webpack
✓ Compiled successfully
Running TypeScript ...
Finished TypeScript ...
✓ Generating static pages using 11 workers (29/29)
Finalizing page optimization ...
Collecting build traces ...
```

### Staff y autorización

Jest: contexto Staff, tenant wiring, acceso veterinario, permisos por áreas y WhatsApp del equipo.

```text
Test Suites: 20 passed, 20 total
Tests:       138 passed, 138 total
Snapshots:   0 total
```

### Rutas reales y PostgreSQL local

Prueba guardada en [team-administration-postgres.test.cjs](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/scripts/team-administration-postgres.test.cjs). Utiliza establecimientos desechables, el middleware de permisos, las rutas reales y la base mateos_dev. Incluye nombre/teléfono, horario 09:15–15:10, reset a null, rechazo de horarios/contactos inválidos antes de escribir, permisos deduplicados, prohibición de cambios administrativos a Recepción, credencial temporal, protección de la cuenta administradora existente, revocación y aislamiento entre establecimientos.

```text
PASS: altas y cambios reales; horario 09:15–15:10 y reset;
validación antes de escribir; permisos por rol; acceso revocado;
sin hashes expuestos; aislamiento entre establecimientos.
PASS: establecimientos e integrantes temporales eliminados.
✔ Equipo: ficha, horario con minutos, permisos, acceso y aislamiento en PostgreSQL
tests 1
pass 1
fail 0
```

### Recorrido del navegador

Se ejecutó contra la compilación de producción, el adaptador real y un establecimiento temporal en PostgreSQL. No se editaron integrantes del negocio real.

1. Fallo 503 de carga → mensaje de error → Reintentar → equipo recuperado.
2. Buscar `maria` encuentra la ficha María. Filtrar Recepción deja únicamente ese perfil; Inactivos muestra la ficha bloqueada.
3. Crear una ficha y editar otra actualiza el equipo. Un 503 de guardado conserva el nombre introducido y muestra «Conservamos tus cambios»; Cerrar ofrece Seguir editando/Descartar. Seguir editando conserva el valor del campo.
4. Recepción muestra Caja incluida, marcada y no editable. En una ficha veterinaria de prueba sin cuenta de ingreso se guardó el permiso adicional de Caja.
5. El horario inicial es null; al personalizar, el lunes parte de 10:30 configurado en el establecimiento. Cambiar a 09:15–15:10 guarda y, al volver a abrir, conserva ambos valores. Salida 08:00 con entrada 09:15 deshabilita Guardar horario.
6. El formulario de acceso de un integrante inactivo bloquea Habilitar acceso. Se revisaron las etiquetas y el límite de 128 caracteres de contraseña, sin introducir ni cambiar contraseñas por la interfaz. La credencial de la prueba automatizada pertenece exclusivamente a un registro desechable.
7. En un viewport de 390 × 844, la hoja mide aproximadamente 358 px y queda entre x=16 y x=374; scrollWidth y clientWidth son 357 px. El contenido se desplaza y el botón Guardar permanece al pie. El tamaño del navegador se restauró al terminar.

Verificación adicional del primer recorrido completo:

```text
PASS: ficha creada y editada, horario con minutos y permiso de Caja
guardados desde el navegador en PostgreSQL.
```

La pestaña y los servidores temporales se cerraron. Se comprobó su limpieza:

```text
PASS: disposable tenant removed; existing business data unchanged.
PASS: no queda ningún establecimiento temporal de esta comprobación.
```

## Evidencia visual

Equipo organizado:

![Equipo organizado](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/ADMINISTRACION_EQUIPO_20261006.png)

Horario centrado con guardado al pie:

![Horario del integrante](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/ADMINISTRACION_EQUIPO_HORARIO_20261006.png)

Hoja en pantalla móvil:

![Horario en móvil](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/ADMINISTRACION_EQUIPO_MOVIL_20261006.png)

## Pendiente importante: disponibilidad integrada con Agenda

**Resuelto en el trabajo posterior del 7 de octubre de 2026.** Se integraron horarios, ausencias y revisión/reasignación de citas; ver [informe de comprobación](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/EQUIPO_DISPONIBILIDAD_AGENDA_20261007.md). Las observaciones siguientes describen el estado anterior a esa integración.

Esta revisión **no cierra toda la disponibilidad del equipo**. La auditoría confirmó que el horario semanal del dashboard vive en Staff.availability, mientras los horarios base y las ausencias del dominio viven en StaffAvailability. ADR 003 conserva su convivencia sin sincronización implícita. Las asignaciones manuales de Agenda todavía no bloquean automáticamente según el horario individual; el editor lo indica explícitamente.

El siguiente trabajo debe diseñar la conexión de los horarios individuales y las ausencias con las reservas/asignaciones, revisar el contrato de disponibilidad y documentar la evolución del ADR 003. No conviene presentar un editor de vacaciones o ausencias como bloqueo efectivo sin completar esa integración. Las entidades y los casos de uso ya existen: se debe reutilizar su lógica y mantener el aislamiento por establecimiento.

Los cambios de esta revisión están en el workspace. Esta solicitud no incluyó commit, push ni despliegue.
