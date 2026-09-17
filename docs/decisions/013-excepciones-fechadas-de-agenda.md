# ADR 013 — Excepciones fechadas de agenda

**Estado:** aceptada  
**Fecha:** 2026-09-17

## Contexto

Los horarios semanales por servicio del ADR 012 no representan cierres por
inventario, vacaciones, aperturas durante un festivo ni jornadas reducidas.
El calendario colombiano ya bloquea festivos nacionales por defecto, pero el
establecimiento necesita excepciones explícitas y auditables por fecha.

## Decisión

Se introduce `AgendaException`, una entidad tenant-scoped con fecha o rango,
alcance `all`/`vet`/`grooming` y modo `closed`/`open`. Las excepciones se
resuelven antes de festivos y horarios semanales. Una excepción específica de
servicio prevalece sobre una global.

Las citas existentes nunca se modifican automáticamente. Administración recibe
un resumen de citas afectadas antes y después de guardar la regla.

## Consecuencias

- Los festivos nacionales permanecen cerrados por defecto.
- Un negocio puede abrir un festivo solo mediante una excepción con horario.
- La disponibilidad de WhatsApp, sugerencias y confirmación final comparte la
  misma resolución de excepción.
- Las excepciones no reutilizan `StaffAvailability`, que representa ausencias
  personales y no el cierre del establecimiento.

## Diferido

La notificación o reprogramación automática de clientes, y los calendarios por
servicio individual del catálogo, requieren decisiones posteriores.
