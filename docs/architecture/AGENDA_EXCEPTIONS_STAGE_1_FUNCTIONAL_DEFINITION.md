# Excepciones de Agenda — Etapa 1: Definición funcional

**Estado:** propuesta para aprobación de Etapa 2  
**Fecha:** 2026-09-17  
**Origen:** necesidad operativa identificada tras la configuración de horarios por servicio (ADR 012).

## Problema

El sistema conoce los festivos nacionales de Colombia y los trata como cierre
automático. Un establecimiento necesita además decidir, para una fecha concreta,
si abre un festivo, si cierra un día ordinario, si atiende media jornada o si
suspende la atención durante vacaciones. Esa decisión puede ser diferente para
veterinaria y peluquería.

Actualmente no existe una configuración del establecimiento para estas
excepciones. `StaffAvailability` modela la disponibilidad de un empleado, por
lo que no representa un cierre general ni debe reutilizarse para esta función.

## Objetivo

Permitir que administración configure excepciones de agenda por fecha o rango,
sin que el asistente ofrezca horarios que el establecimiento decidió cerrar y
sin modificar automáticamente las citas existentes.

## Actores

- **Administrador del establecimiento:** crea, consulta y elimina excepciones.
- **Agente de WhatsApp y API de disponibilidad:** consultan la regla efectiva
  antes de ofrecer, validar o confirmar un turno.
- **Personal administrativo:** identifica y gestiona manualmente citas que
  queden dentro de un cierre posterior.

## Capacidades incluidas

1. El calendario nacional colombiano continúa cerrado por defecto.
2. Se puede registrar un cierre especial en una fecha o rango de fechas.
3. Se puede registrar una apertura excepcional en un festivo.
4. Se puede registrar un horario reducido para una fecha concreta.
5. Una excepción puede afectar:
   - todo el establecimiento;
   - la agenda de veterinaria;
   - la agenda de peluquería.
6. Toda nueva reserva, sugerencia u oferta de horario respeta la excepción
   vigente.
7. El panel muestra las citas activas afectadas cuando una excepción de cierre
   o reducción se superpone con ellas.

## Reglas de negocio

1. **Precedencia:** excepción puntual → festivo nacional → horario del servicio
   → horario general → comportamiento legado.
2. Un festivo nacional solo puede abrirse mediante una excepción explícita de
   apertura, con su horario definido.
3. Un cierre extraordinario bloquea nuevas citas para su alcance desde el
   momento en que se guarda.
4. Una excepción global afecta veterinaria y peluquería, salvo que exista una
   excepción específica para ese servicio y esa fecha.
5. Una excepción específica de servicio no altera la agenda del otro servicio.
6. Los festivos nacionales siguen aplicando en Colombia, incluso cuando el
   horario semanal ordinario marque el día como activo.
7. Una excepción debe tener fecha inicial válida; si tiene fecha final, esta no
   puede ser anterior a la inicial.
8. Un horario reducido o una apertura excepcional requiere apertura anterior a
   cierre.
9. La creación de una excepción nunca cancela, mueve ni cambia el estado de una
   cita existente. El sistema solo informa las citas afectadas para que el
   administrador las gestione de manera consciente.
10. Cada excepción pertenece a un único `Tenant`; no puede afectar ni revelar
    datos de otro establecimiento.

## Escenarios verificables

| Escenario | Resultado esperado |
| --- | --- |
| Navidad sin excepción | No hay horarios disponibles para ningún servicio. |
| Veterinaria abre un festivo de 09:00 a 13:00 | Solo veterinaria ofrece turnos de 09:00 a 12:00; peluquería permanece cerrada. |
| Cierre por inventario para todo el negocio | Ninguno de los dos servicios acepta reservas en la fecha indicada. |
| Vacaciones de tres días | Ninguna reserva nueva entra durante el rango. |
| Horario reducido de peluquería | Solo se ofrecen turnos consecutivos dentro de la ventana reducida. |
| Cierre creado con citas ya agendadas | Las citas siguen intactas y el panel las reporta como afectadas. |

## Fuera de alcance

- Reprogramación o cancelación automática de citas.
- Envío automático de mensajes a clientes por una excepción.
- Calendarios individuales por cada `Service` del catálogo; el alcance actual
  se limita a las agendas compartidas `vet` y `grooming`.
- Ausencias individuales del staff.
- Festivos de países distintos de Colombia y zona horaria configurable por
  tenant.

## Criterios de aceptación de la función

- No se puede reservar fuera de una excepción de apertura u horario reducido.
- No se puede reservar dentro de un cierre extraordinario.
- Veterinaria y peluquería respetan excepciones independientes.
- Las citas existentes no cambian al crear, modificar o eliminar una excepción.
- La interfaz identifica de forma explícita las citas afectadas.
- Las consultas y mutaciones quedan aisladas por tenant.

## Resultado de la etapa

La función está definida como una configuración operativa del establecimiento,
conservando el calendario colombiano como base segura y la gestión humana para
citas ya comprometidas. La siguiente etapa define los casos de uso y sus
contratos.
