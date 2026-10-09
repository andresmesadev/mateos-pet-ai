# ADR 011 — Disponibilidad del equipo aplicada a Agenda

Fecha: 2026-10-06. Alcance autorizado: horarios, ausencias y revisión de citas afectadas en Equipo y accesos.

## Decisión

Se integra StaffAvailability existente (§6 del modelo) con Agenda, sin nuevas entidades ni migraciones. Esta integración reemplaza la convivencia sin consumidores comunes del ADR 003. No es un nuevo entregable del roadmap histórico de Fase 2: es la conexión solicitada de capacidades ya construidas. La regla de ejecución de esa fase no se amplía a todas las fases por inferencia.

Las franjas base estructuradas prevalecen cuando existen. El JSON semanal legado se interpreta solo si no existen franjas; `null` sin franjas significa usar el horario del establecimiento, y un objeto vacío significa semana cerrada. Guardar una semana desde Equipo sustituye exclusivamente sus franjas base, sincroniza el JSON y conserva todas las ausencias. Restablecer el horario del negocio elimina únicamente las franjas base. Una inserción por la ruta estructurada importa primero la semana JSON, para no perder días. Las múltiples franjas se respetan al resolver; el editor semanal informa si una sustitución simplificará estas franjas.

Una regla pura del contexto Staff comprueba rango completo y cruces de ausencias, en hora de Colombia (zona técnica `America/Bogota`) para dashboard; la resolución histórica conserva UTC por defecto para sus consumidores. Agenda añade compatibilidad de rol, capacidades explícitas si están configuradas y ocupación del profesional. La duración del servicio define el intervalo del profesional (mínimo un minuto; 60 minutos si falta duración). La capacidad existente de un turno de una hora por bucket se conserva. Las reservas sin profesional siguen permitidas; su asignación posterior debe cumplir estas comprobaciones.

Asignaciones nuevas se validan en el servidor. Creación con profesional y reasignación comparten un lock PostgreSQL por profesional con los cambios de horario, ausencia y activación del dashboard. Cambiar disponibilidad no cancela ni reescribe citas existentes. Las citas futuras pendientes/confirmadas/recibidas que ya no cumplan aparecen en revisión; el operador puede reasignar y abrir Agenda para gestionar la reserva. Las atenciones iniciadas y el historial cerrado se conservan.

Ausencias programadas e imprevistas usan los casos de uso existentes y sus eventos; se listan en Equipo con motivo y rango. Se validan fechas reales y límites antes de escribir. No se borran antecedentes ni se incorporan envíos de WhatsApp o cancelaciones masivas.

## Alternativas descartadas

- Validar solo en frontend: permite asignaciones inválidas desde otros clientes.
- Introducir otro modelo de disponibilidad: duplica StaffAvailability.
- Cambiar capacidad por bucket a capacidad por profesional: modifica una regla no solicitada.
- Cancelar automáticamente las citas afectadas: elimina reservas sin decisión operativa.

## Verificación

Pruebas de fronteras temporales, minutos, franjas partidas, propiedad del tenant, reservas simultáneas, ausencias, cambios de horario y conservación de citas; lint y pruebas del proyecto. Evidencia y limitaciones en el informe de cierre de esta tarea.
