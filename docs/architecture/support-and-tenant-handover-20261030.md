# Soporte y entrega asistida de datos de Huella Nex

**Fecha:** 30/10/2026. Diseño acotado del punto 3 del software general.

## Definición y casos

Preparar un procedimiento repetible para atender una incidencia de un negocio,
recuperar a su administrador sin conceder permisos nuevos y entregar sus registros
operativos si lo solicita. El Establecimiento (`Tenant`) sigue siendo la unidad
de aislamiento. Mateos Pet no actúa como cuenta ni configuración global de otros
clientes.

El soporte comprueba identidad y facultad del solicitante mediante un canal ya
registrado, anota la solicitud y su alcance y usa el restablecimiento existente.
No cambia correos ni privilegios como sustituto de verificar identidad. Si no
hay un canal previamente acreditado, el caso queda pendiente de comprobación.

La entrega es asistida y de solo lectura. No solicita una baja ni borrado implícito.
El operador técnico debe tener acceso autorizado al establecimiento concreto,
registrar el caso y preparar un paquete con manifiesto, alcance y comprobaciones
de integridad. No se enviará automáticamente por correo o WhatsApp.

## Arquitectura, persistencia y esquema

No se añade una entidad de tickets, nueva API pública ni recuperación de cuenta
por enlace. Se reutilizan las rutas de credenciales, autenticación, revocación
de sesión y selección explícita del establecimiento por administración de
plataforma. El modo heredado `SINGLE_TENANT_ID` no se modifica en producción;
su fallback no debe confundirse con la selección de otro negocio.

Un script de operación construye una copia consistente en una transacción
`REPEATABLE READ`, declarada `READ ONLY`, de los modelos operativos incluidos.
Usa campos permitidos explícitamente y filtros por tenant o por sus relaciones.
Comprueba relaciones entre los modelos incluidos y falla ante referencias ajenas,
modelos/campos nuevos sin revisar o exceso del límite de filas: nunca trunca en
silencio. Los modelos excluidos y campos omitidos quedan en el manifiesto.

Se incluyen clientes, mascotas, historias y revisiones, citas, servicios/precios,
personal/turnos, inventario/movimientos, cobros/artículos, gastos, comisiones,
liquidaciones, aperturas/cierres, conversaciones/mensajes y configuración de
automatizaciones/asistentes y cupos. Credenciales, sesiones, claves, tokens,
colas, pruebas de autoridad y trazas técnicas internas quedan fuera. Los vectores
derivados y archivos alojados por proveedores no se presentan como exportados.
Las referencias conservadas no equivalen a descargar sus archivos.

El registro del caso y sus evidencias son documentación operacional privada;
no se modifica la base de datos para crear un ticket ni se atribuye a ese registro
una garantía de auditoría inmutable. No hay cambios en persistencia ni esquema.

## Criterios de comprobación

- Contraseña nueva permite entrar; anterior y sesión anterior quedan rechazadas.
- El rol, permisos, tenant y datos del administrador permanecen iguales.
- Otro negocio no puede restablecer esa cuenta ni acceder a sus registros.
- El paquete contiene registros directos e indirectos del negocio correcto,
  conteos conciliados, exclusiones expresas y cero credenciales técnicas.
- La preparación no modifica datos; se comprueba integridad del paquete y el
  rechazo de una relación ajena o archivo alterado.
- Solicitud, verificación sintética, actuación, comprobación y cierre del caso
  quedan en el ensayo; no se inventa una verificación ni aceptación humana real.

## Decisiones diferidas

La entrega real requiere verificar al destinatario, acordar el medio seguro y
conservar su constancia. Se acuerdan aparte baja, proveedores y conservación;
este punto no decide plazos legales ni borra registros. La pérdida simultánea de
acceso a los canales acreditados requiere revisión humana; no se automatiza un
bypass. Un portal de tickets o exportación autoservicio solo se considerará ante
una necesidad posterior explícita.
