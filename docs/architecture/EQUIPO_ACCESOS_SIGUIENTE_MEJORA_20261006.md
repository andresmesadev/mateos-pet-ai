# Equipo y accesos: mejoras pendientes

**Actualización del 7 de octubre de 2026:** los tres ajustes de esta propuesta fueron aceptados, implementados y comprobados. Decisión en ADR 011 y evidencia en [Disponibilidad integrada con Agenda](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/EQUIPO_DISPONIBILIDAD_AGENDA_20261007.md). El texto siguiente conserva la propuesta original.

## Recomendación

La presentación, la búsqueda, los formularios y los permisos ya fueron mejorados y comprobados. Antes de dar por cerrada la disponibilidad del equipo, recomiendo completar estos tres ajustes relacionados:

1. **Aplicar el horario del profesional en Agenda.** Al elegir un veterinario o peluquero, ofrecer únicamente horarios compatibles con su jornada, el establecimiento y el servicio. El horario individual guardado hoy todavía no bloquea las asignaciones manuales.
2. **Gestionar ausencias desde Equipo.** Registrar vacaciones, permisos o ausencias imprevistas indicando fechas, horas y motivo. Una ausencia debe impedir nuevas asignaciones durante ese intervalo y poder consultarse en la ficha.
3. **Mostrar las citas afectadas.** Al cambiar un horario, registrar una ausencia o desactivar a alguien, presentar las citas futuras que necesitan revisión. Permitir revisar su reasignación o reprogramación mediante los flujos existentes; conservar sus registros.

Los tres ajustes forman una misma integración de disponibilidad. Conviene resolverlos juntos para que lo configurado en Equipo coincida con lo que Agenda permite reservar.

## Base y condición técnica

El dominio ya contempla StaffAvailability y sus tipos base_schedule, planned_absence y unplanned_absence. El dashboard conserva el JSON Staff.availability. ADR 003 documenta que ambas representaciones pueden divergir y que unificarlas requiere un ADR propio.

Por eso, el siguiente paso debe definir el comportamiento, los casos de uso, la fuente de verdad y la transición de los horarios existentes antes de implementar. Se reutilizarán los casos de uso de Staff y Agenda, el aislamiento por establecimiento y los permisos existentes. Esta propuesta no constituye una integración ya terminada.
