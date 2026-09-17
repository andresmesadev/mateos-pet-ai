# Fechas especiales de agenda — cierre técnico

**Versión:** v2.39.0  
**Fecha:** 2026-09-17

## Resultado

La agenda admite excepciones fechadas por establecimiento para todo el negocio,
veterinaria o peluquería. Cada excepción puede cerrar una fecha o rango, o abrirlo
con un horario especial. Los festivos nacionales colombianos permanecen cerrados
por defecto y pueden abrirse mediante una excepción explícita.

## Reglas aplicadas

1. Excepción específica del servicio.
2. Excepción de todo el establecimiento.
3. Horario configurado para el servicio.
4. Horario general del establecimiento.
5. Horario heredado.

Las citas existentes nunca se cancelan ni se reprograman automáticamente. Antes de
guardar, el panel muestra las citas activas que quedarían afectadas.

## Componentes entregados

- Modelo `AgendaException`, migración SQL e índices por establecimiento, fecha y alcance.
- Validación, prevención de solapamientos y lectura de la excepción efectiva.
- Aplicación uniforme en la validación conversacional y la disponibilidad de agenda.
- Gestión y vista previa en **Administración → Agenda y disponibilidad**.
- Definición funcional, casos de uso, arquitectura, persistencia y ADR 013.

## Verificación

- `npx prisma validate`: correcto.
- `npx prisma generate`: correcto.
- Pruebas específicas: 43 correctas.
- Backend completo: 133 suites y 1.013 pruebas correctas.
- `npm run lint` frontend: sin errores; persisten 3 advertencias preexistentes.
- `npm run build` frontend: correcto.
