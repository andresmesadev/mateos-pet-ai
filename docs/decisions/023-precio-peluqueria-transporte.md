# ADR 023 — Peluquería, transporte y precios pendientes

Fecha: 2026-10-16. Decisión autorizada por el responsable al confirmar: el importe «con domicilio» es total; el transporte no genera comisión de peluquería; se respeta el acuerdo particular aunque difiera de la zona.

## Evidencia y reconciliación

El catálogo de 2.1 exigía duración y precio base conocido para todo servicio. El adaptador sustituía precio ausente por cero, aunque el esquema ya admite `Service.basePrice = null`. El caso real de recogida/entrega no ocupa un turno de peluquería y puede tener precio pendiente. Se reabre únicamente esa restricción del catálogo: un servicio que reserva horario mantiene duración positiva; un complemento sin reserva permite duración nula. Precio base nulo significa pendiente, nunca gratuito. Cero explícito sigue siendo gratuito. Se conserva el bloqueo de completar una atención facturable con importes pendientes (ADR 007).

El precio acordado de peluquería y el total pactado con recogida/entrega son datos distintos de la mascota. El total pactado se respeta antes de aplicar una referencia general de zona. La diferencia se calcula exclusivamente en `price-resolver.service.js` cuando existe una base de peluquería individual conocida. Un total aislado no permite inventar la base de comisión usando el catálogo.

## Decisión

El transporte acompaña a la cita de peluquería; no crea otra cita ni otro turno. Modalidades: el cliente la lleva, recogida y entrega, solo recogida, solo entrega o traslado cobrado en otra cita del mismo propietario. Una tarifa de zona es referencia hasta confirmación humana. Un solo trayecto no se divide automáticamente a la mitad. Compartir exige indicar la otra atención que cubre el cobro; no se multiplica ni distribuye por mascota.

El desglose confirmado queda congelado al completar. `Appointment.finalPrice` conserva el importe de peluquería; la comisión recibe ese importe. El cobro oficial único recibe el total de peluquería y transporte calculado por la misma autoridad de precios. No se crea una segunda venta de domicilio desde POS. Las comisiones existentes permanecen inmutables.

## Consecuencias

Se amplían campos existentes y la configuración de zonas por establecimiento. No se implementa logística de conductores/rutas. WhatsApp conserva su pausa; su solicitud de recogida existente se persiste como transporte pendiente, utilizando el mismo contrato, sin prometer precio u hora de recogida no confirmados.

## Simplificación solicitada el 17 de octubre

El responsable descarta el bloque obligatorio de logística en Nueva cita. La ficha de Mascota usa dos campos en la pestaña existente: valor del servicio y recargo de domicilio independiente. `defaultGroomingTransportPrice` tiene prioridad para recogida/entrega; los acuerdos históricos de total se leen sin perderlos. Un total aislado no se reemplaza con un desglose incompleto. Una reserva sin selección de traslado conserva `transportMode=none`; tener un precio de domicilio guardado no autoriza a cobrarlo en todas las visitas. La revisión de traslado sigue disponible desde el botón existente de la atención. Dirección en Cliente, sin deducir automáticamente una zona geográfica. Ver [cinco etapas del ajuste](../architecture/grooming-transport-simplification.md).
