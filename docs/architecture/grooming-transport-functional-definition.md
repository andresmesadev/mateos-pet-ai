# Domicilio de peluquería — definición funcional en curso

**Requisitos registrados el 16 de octubre; implementación local verificada el 17 de octubre de 2026.** La decisión contable está resuelta en [ADR 023](../decisions/023-precio-peluqueria-transporte.md); las cinco etapas están en el [diseño de implementación](grooming-transport-implementation.md) y la evidencia en la [verificación local](../history/GROOMING_TRANSPORT_VERIFICATION_20261017.md). El recorrido de WhatsApp siguiente conserva su carácter de requisito para la futura reactivación. No declara una fase nueva ni modifica los cierres anteriores.

## Requisitos confirmados por el responsable

- El establecimiento cobra el traslado de mascotas para peluquería según la zona.
- La tarifa habitual incluye recogida y entrega. Existen, con poca frecuencia, casos de solo recogida o solo entrega.
- **Confirmación posterior del responsable:** cuando se trasladan varias mascotas juntas, el cobro depende del caso y el equipo confirma el importe. No existe una regla universal de multiplicar por mascota o repartir por viaje. La zona es una referencia de tarifa; no autoriza al agente a fijar por su cuenta el total de un caso con excepciones.
- Se necesita registrar esta prestación sin inventar una duración de atención ni un precio fijo cuando todavía no se conoce el importe aplicable.
- Cuando se reactive el agente de WhatsApp, debe preguntar si el cliente necesita domicilio o llevará la mascota al centro veterinario. La decisión pertenece a la cita y debe estar disponible también para el equipo del dashboard.

La recogida/entrega es **transporte hacia o desde el centro**. No significa que el baño/corte se realice en la vivienda del cliente y no debe confundirse con el tipo de atención «a domicilio» mencionado en el modelo de Agenda.

## Recorrido propuesto para WhatsApp y dashboard

1. Al reservar peluquería, aclarar: **«¿Llevas a tu mascota al centro veterinario o necesitas nuestro servicio de recogida y entrega?»** Opciones: «La llevo al centro» / «Necesito domicilio».
2. Si el cliente ya expresó una elección inequívoca, reutilizarla y confirmarla en el resumen; no repetir la pregunta como si no la hubiera respondido. Si no hay elección, preguntar: no asumir transporte ni asistencia por cuenta propia.
3. Para domicilio, proponer «Recogida y entrega» como modalidad habitual, mostrando que incluye ambos trayectos. Permitir corregirla a «Solo recogida» o «Solo entrega».
4. Solicitar o confirmar la zona y la dirección necesarias para ese traslado. Una dirección ya registrada se confirma antes de reutilizarla; no se considera automáticamente vigente para toda cita futura.
5. Consultar las tarifas configuradas del establecimiento mediante la misma operación que utiliza el dashboard. Distinguir referencia por zona de importe confirmado por el equipo para el caso concreto. El agente no inventa tarifas, cobertura ni una zona a partir de texto ambiguo. Una zona no configurada, un trayecto excepcional o un grupo de mascotas sin importe confirmado queda pendiente de confirmación humana. No dividir automáticamente la tarifa habitual por dos ni multiplicarla por cantidad de mascotas.
6. Resumir servicio, modalidad de transporte, zona/dirección confirmadas e importe de cada concepto. Si existe un importe pendiente, indicarlo expresamente y no presentar un total definitivo ni tratarlo como cero.
7. Guardar la elección con la cita para que recepción pueda verla y corregirla con los permisos apropiados. Una corrección previa a la confirmación actualiza el resumen; no agrega un segundo domicilio. El diseño de reprogramación/cancelación deberá conservar o revisar esa elección explícitamente, sin arrastrarla a otra atención por accidente.

La hora de la cita de peluquería no equivale a una hora de recogida garantizada. No se promete disponibilidad de conductor, recorrido o llegada puntual sin una regla operativa real que la respalde. Esta propuesta no incorpora un sistema de rutas ni de logística.

## Punto de partida ya existente en WhatsApp

La inspección del código confirmó que `conversation.service.js` ya contiene `AWAITING_DOMICILIO` y `AWAITING_DOMICILIO_ADDRESS`: después de aceptar el horario de peluquería pregunta si el cliente lleva la mascota o necesita recogida y solicita dirección. `whatsapp.service.js` guarda esa dirección al confirmar la cita. `booking-message.service.js` la incluye en el resumen y confirmación.

Por tanto, este requisito **amplía el recorrido existente**, no justifica crear un segundo wizard. La implementación local persiste la solicitud existente como recogida y entrega pendiente. Zona, modalidades, importe y alcance se gestionan en el dashboard. La futura reactivación debe comprobar y ampliar ese mismo recorrido para recopilar los datos completos, conservando la confirmación determinista y las protecciones de reserva.

## Ajuste conceptual propuesto

Separar en el catálogo si una prestación ocupa un turno de atención y si su importe está definido. Peluquería conserva duración estimada para calcular disponibilidad; el traslado es un complemento ligado a la cita, sin consumir por sí mismo otro turno de peluquería. El importe del complemento se confirma según zona/modalidad en cada atención.

Precio pendiente es distinto de gratuito. El importe del domicilio no hereda el precio acordado del baño/corte de una mascota y no se mezcla silenciosamente con la base de comisión. Toda resolución debe conservar el punto único de precios y su trazabilidad. El diseño contable deberá respetar ADR 007: una atención facturable no se completa con precio indeterminado; no cambiar el comando de cierre, sus reactivos ni comisiones inmutables como efecto lateral de un formulario.

Estos cambios amplían las reglas vigentes de Servicios (duración positiva y precio base requerido) y la relación actual de una cita con su servicio. Antes de implementar se deben concretar casos de uso, arquitectura, persistencia y esquema, dejando explícita cualquier reconciliación necesaria. Quitar solamente `required` en frontend no implementaría este alcance.

## Configuración y alcance posterior

- Nombres/cobertura de las zonas y tarifa habitual de recogida + entrega de cada una.
- El alcance compartido se registra con observaciones y referencia a otra cita del mismo propietario y día; el equipo decide qué cobro corresponde. La cita principal debe completarse antes de cerrar las cubiertas.
- Los trayectos únicos admiten tarifa propia o confirmación manual. Destinos distintos y logística de rutas quedan fuera de esta implementación.
- Transporte excluido de comisión; confirmación humana del importe antes de completar. Recepción puede solicitarlo pendiente; administración o el permiso de ajuste de precio confirman el importe.
- La configuración real de zonas, importes y cobertura se cargará después del despliegue.

## Comprobaciones requeridas antes de habilitar el canal

El mismo caso debe producir los mismos datos e importe desde dashboard y WhatsApp. Probar elección explícita en el centro, ida/vuelta, trayecto único, zona desconocida, dirección corregida, tarifa pendiente, varias mascotas, reintentos y cambio/cancelación de cita. Verificar aislamiento por establecimiento, permisos, ausencia de doble cargo y separación del precio acordado de peluquería.

No se activa WhatsApp por registrar este requisito. La futura reactivación debe comprobar el recorrido real con la línea autorizada y conservar los controles de atención humana, entrega y privacidad existentes.

Casos de uso y escenarios de aceptación: [contrato funcional](grooming-transport-use-cases.md). La arquitectura, persistencia, esquema y revisión contable del dashboard están documentados en el diseño y la verificación enlazados al inicio; la prueba real del canal sigue pendiente.
