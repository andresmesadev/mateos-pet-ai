# Alta de integrantes con permisos

Fecha: 2026-10-16. Ampliación solicitada para la beta de la veterinaria propia.

## 1. Definición funcional y reconciliación

Al crear un integrante, Administración puede elegir sus permisos de acceso. El perfil profesional sigue siendo Veterinario/a, Peluquero/a o Recepción. Una habilitación explícita y opcional de acceso administrativo permite administrar el establecimiento sin cambiar el perfil profesional visible.

El responsable confirmó expresamente que «todos los servicios» significa acceso a todo el dashboard, no asignación de servicios de Veterinaria/Peluquería. No se modifica el editor de capacidades profesionales.

Esto amplía la lista cerrada de habilitaciones definida en [Acceso del equipo](team-business-access.md); no introduce roles personalizados ni una nueva unidad de aislamiento. A diferencia del contrato anterior, un profesional puede recibir administración completa del establecimiento. Nunca concede superadministración ni acceso a otros establecimientos. Conceder administración no cambia capacidades profesionales ni comisiones.

## 2. Casos de uso

- Crear una veterinaria con permisos de Caja, ajuste de precio o registro de insumos, elegidos en el mismo formulario.
- Crear una veterinaria con acceso administrativo, conservando su perfil y su regla de comisión profesional.
- Modificar o retirar habilitaciones desde Perfil y permisos. El servidor consulta el estado vigente en cada petición, incluso con una sesión ya abierta.
- Rechazar permisos desconocidos antes de crear la ficha; impedir que un trabajador sin administración conceda permisos o cree integrantes.

La cuenta de ingreso conserva su paso explícito de correo y contraseña en Acceso. Crear la ficha con permisos no crea credenciales ni envía correos.

## 3. Arquitectura técnica

Reutilizar Registrar Staff y persistir ficha y permisos en un único INSERT. La validación de la lista cerrada vive en Staff. La autoridad del adaptador se deriva del perfil y las habilitaciones vigentes en BD: `type` sigue representando el acceso efectivo para los gates existentes y `professionalRole` conserva la identidad profesional. El contrato de acceso expone ambas dimensiones; la interfaz muestra la profesional.

La revalidación interna de facturación usa la misma resolución de autoridad y no depende del rol antiguo de la sesión. Revocar administración retira los privilegios en la siguiente solicitud. La selección de servicios continúa usando Staff.role y las reglas de compatibilidad existentes, nunca el acceso administrativo.

Los campos de permisos son compartidos por el alta y el editor posterior. Ningún permiso se marca automáticamente al cambiar de profesión. Administración completa se presenta como una habilitación explícita con su alcance explicado; las habilitaciones individuales se conservan para cuando se retire.

## 4. Persistencia

Reutilizar Staff.accessPermissions; agregar `administration` al vocabulario cerrado de permisos. Las invocaciones existentes sin ese parámetro conservan permisos vacíos.

No cambiar Staff.role al conceder administración. Conservar credenciales, horarios, capacidades previas, historial y comisiones. Sin datos reales de prueba ni cambios a la base de producción.

## 5. Esquema físico y validación

Sin migración: TEXT[] existente. Verificar alta atómica, permisos inválidos, conservación del perfil, compatibilidad de servicios, concesión/revocación en sesión abierta, credenciales revocadas y aislamiento entre establecimientos. Ejecutar tests, lint y compilación del frontend antes del cierre local.
