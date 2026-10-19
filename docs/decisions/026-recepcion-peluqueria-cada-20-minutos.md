# ADR 026 — Recepción de peluquería cada 20 minutos

Fecha: 2026-10-19. Estado: aceptado por solicitud explícita del responsable del producto.

El modelo anterior reservaba una hora por cita de peluquería; el responsable requiere iniciar reservas cada 20 minutos. Esto modifica la cadencia de recepción y capacidad de reserva del bucket de peluquería, y la ventana operativa usada para asignar al peluquero. No modifica Service.duration ni garantiza una duración clínica/estética de 20 minutos.

Se mantiene la fuente compartida de disponibilidad, la secuencia de turnos futuros, anticipación de 30 minutos, horario real, excepciones y Tenant. Se sustituye la separación de una hora en consulta, bloqueo atómico, reprogramación y asignación; cambiar solo las opciones visibles dejaría turnos que el guardado rechazaría. Veterinaria conserva sus reglas. No se reescribe el motor conversacional: consume la disponibilidad existente con la nueva política. WhatsApp sigue pausado.

La precisión histórica del 2026-10-10 en el modelo sigue describiendo su alcance original; la cadencia cambia ahora por este requerimiento posterior. [Cinco etapas y límites](../architecture/grooming-twenty-minute-slots-20261019.md). Sin nueva entidad ni migración. Citas y precios existentes conservan sus valores.
