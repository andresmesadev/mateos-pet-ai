# Domicilio de peluquería — casos de uso y aceptación

**Definido el 16 de octubre de 2026; dashboard implementado y verificado localmente el 17 de octubre.** Se apoya en la [definición funcional](grooming-transport-functional-definition.md) y en la respuesta del responsable: el equipo confirma el importe según el caso cuando participan varias mascotas. Contrato técnico y reconciliación en [diseño](grooming-transport-implementation.md) y [ADR 023](../decisions/023-precio-peluqueria-transporte.md). WhatsApp sigue pendiente de reactivación y prueba real.

## Actores y autoridad

- Cliente: expresa si lleva la mascota o solicita traslado, confirma dirección y revisa el resumen.
- Equipo autorizado: revisa zona, modalidad, cobertura, mascotas involucradas e importe definitivo. No se amplían permisos de recepción o de un empleado digital como consecuencia de estos casos de uso.
- Agente de WhatsApp: recoge datos y comunica el estado respaldado por el sistema; no inventa precio, permiso de excepción o disponibilidad de transporte.

## D01 — Registrar la oferta del traslado

El administrador puede definir una prestación complementaria de transporte y sus referencias por zona, sin duración de turno de peluquería. El precio puede quedar pendiente de definir por atención; no se introduce duración ficticia o precio cero para superar una validación. La selección de categoría y el tratamiento de comisión deben quedar explícitos antes de cerrar el diseño contable.

**Aceptación:** nombre y actividad válidos; ausencia de duración representada como no aplicable; importe pendiente distinto de gratuito; los servicios con turno conservan duración positiva. Un complemento no aparece como una reserva independiente que compita por el puesto de peluquería.

## D02 — Elegir asistencia por cuenta propia o domicilio

Dashboard y WhatsApp producen la misma elección en el mismo contexto de cita. El agente reutiliza la pregunta de recogida existente y confirma una respuesta inequívoca; no agrega una segunda pregunta equivalente. Una respuesta ambigua no selecciona domicilio automáticamente.

**Aceptación:** «La llevo yo» no agrega transporte ni pide dirección de recogida; «Necesito que pasen por ella» inicia la solicitud; una mención inequívoca previa se conserva en el resumen. Al corregir la elección, no queda un cargo de domicilio oculto o duplicado.

## D03 — Precisar trayectos, zona y dirección

La modalidad habitual es recogida + entrega; se puede corregir a uno solo de los trayectos. Se confirma dirección y zona aplicables al caso. La hora de atención se distingue de la hora de recogida.

**Aceptación:** un único trayecto no se tarifa automáticamente al 50 %; una zona desconocida queda por revisar; una dirección antigua no se reutiliza sin confirmación; no se promete atención en la vivienda por haber solicitado transporte al centro. Un destino distinto para la entrega requiere revisión explícita, no una dirección inventada.

## D04 — Confirmar importe y alcance para varias mascotas

El equipo revisa la solicitud, las mascotas involucradas y la referencia por zona; define el importe aplicable y qué traslado/mascotas cubre. Esa decisión debe ser visible antes de generar el cargo. No hay multiplicación, división o distribución automática por número de mascotas.

**Aceptación:** dos mascotas de la misma dirección pueden quedar pendientes hasta la confirmación; el agente comunica ese estado. Releer o reintentar una confirmación no crea otro cargo. El diseño de persistencia debe permitir identificar el alcance confirmado y evitar cobrar el mismo traslado desde dos citas distintas. No se fija todavía cómo se representa físicamente ese vínculo.

## D05 — Comunicar resumen y estados

El resumen distingue datos de la cita, solicitud de transporte, referencia de tarifa e importe confirmado. Si el equipo aún no ha confirmado el transporte o su valor, debe indicarlo: «Domicilio solicitado; nuestro equipo confirmará el valor y las condiciones». No equivale a confirmar una hora de recogida o el precio total.

**Aceptación:** una tarifa de referencia no aparece como precio definitivo; no hay total definitivo si falta un concepto; un importe confirmado se comunica con la misma información que ve recepción. La confirmación de cita no puede anunciar un transporte garantizado que sigue pendiente.

## D06 — Resolver el precio y generar el cobro

Peluquería y transporte son conceptos distinguibles. El domicilio no hereda el acuerdo de precio del baño/corte, y no se suma silenciosamente a su base de comisión. La resolución reutiliza el punto único de precios, con decisión y origen trazables.

**Aceptación:** no se completa una atención facturable con precio indeterminado ni se genera un cobro definitivo con conceptos pendientes. El diseño de integración debe respetar la transacción de Completar Cita, el evento CitaCompletada y las comisiones inmutables; no añadir el transporte al único `resolvedPrice` existente sin resolver primero su efecto sobre Finanzas y Staff. Comprobación obligatoria con PostgreSQL real antes de publicar.

## D07 — Corregir, reprogramar o cancelar

El cambio de mascota, dirección, zona o trayectos exige revisar la aplicabilidad del importe previo. La reprogramación no agrega una segunda solicitud/cobro por sí misma. Una cancelación no borra cargos, decisiones o auditoría existentes; cualquier corrección financiera utiliza los comandos vigentes.

**Aceptación:** ningún reintento duplica domicilio; un cambio relevante no presenta una cotización antigua como válida automáticamente; una cita nueva no recibe una solicitud anterior de otra mascota. Las decisiones sobre cancelación de transporte ya prestado quedan por definir antes de implementarse.

## D08 — Separar establecimiento, permisos y canales

La identidad autenticada determina el establecimiento y el operador autorizado. El cliente y el agente no fijan roles, Tenant o precio confirmado mediante texto libre. Un mismo caso consultado desde WhatsApp y dashboard debe conservar modalidad, estado e importe.

**Aceptación:** no hay lectura de zonas, direcciones o solicitudes de otro Tenant; los permisos se revalidan al confirmar, aunque una pantalla o conversación estuviera abierta. La configuración y pruebas del dashboard pueden prepararse con WhatsApp apagado; la habilitación del canal exige su prueba real posterior.

## Reconciliación implementada y límites

ADR 023 permite duración nula solo sin reserva y precio base pendiente sin convertirlo en cero. El cierre conserva peluquería como base de comisión y entrega el total a Finanzas dentro de la transacción existente. El cobro compartido referencia una cita principal del mismo propietario, establecimiento y día; se completa primero la principal. El acuerdo particular se respeta antes de aplicar la zona.

La [verificación local](../history/GROOMING_TRANSPORT_VERIFICATION_20261017.md) certifica el alcance de dashboard, importación y cierre financiero. Transporte pendiente bloquea completar; cancelación/reprogramación conserva las protecciones de las citas cubiertas. Cancelación de transporte ya prestado, destinos diferentes y prueba real de WhatsApp siguen fuera de alcance. Las zonas e importes reales se cargarán desde configuración después del despliegue y no se inventan ni publican en Git.
