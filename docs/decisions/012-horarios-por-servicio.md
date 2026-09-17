# ADR 012 — Horarios de atención por servicio

**Estado:** aceptada  
**Fecha:** 2026-09-17

## Contexto

`Tenant.businessHours` era un único calendario semanal. Al aplicarlo al motor
de disponibilidad, esa misma ventana reemplazaba por igual los horarios de
veterinaria y peluquería. No representa la operación de establecimientos donde
cada servicio tiene días u horarios propios; por ejemplo, una clínica puede
atender consultas un domingo y mantener peluquería cerrada.

Los tenants existentes ya persisten el formato plano por día. Cambiarlo de
forma obligatoria o crear columnas fijas por servicio alteraría su operación y
haría más costosa la configuración de servicios futuros.

## Decisión

Se conserva el calendario plano existente como horario general y se añade una
capa opcional `services` dentro del mismo `Tenant.businessHours`:

```json
{
  "mon": { "open": "08:00", "close": "18:00", "active": true },
  "sun": { "open": "08:00", "close": "18:00", "active": false },
  "services": {
    "vet": {
      "sun": { "open": "09:00", "close": "13:00", "active": true }
    },
    "grooming": {
      "sun": { "open": "08:00", "close": "18:00", "active": false }
    }
  }
}
```

Para una fecha y servicio, la precedencia es:

1. `businessHours.services[serviceType][day]`, si es válida.
2. `businessHours[day]`, el horario general existente.
3. La regla legada del motor, solo cuando el tenant no configuró ese día.

Los festivos nacionales continúan cerrando ambos servicios. La configuración
se valida en la ruta de perfil, se administra desde el panel y se utiliza tanto
para validar como para sugerir citas.

## Alternativas evaluadas

### Nuevas columnas en `Tenant`

Requeriría una migración por cada clase de servicio y no permite extender el
catálogo sin cambios de esquema.

### Tabla de horarios por servicio

Es adecuada si cada servicio del catálogo necesita un calendario independiente.
Hoy el motor sólo distingue las agendas compartidas `vet` y `grooming`; una
tabla introduciría complejidad de persistencia y administración sin un
consumidor actual.

### JSON opcional por tipo de agenda

Mantiene compatibilidad con los tenants existentes, modela la regla que el
motor ya conoce y permite que clientes futuros configuren ambos servicios sin
migración. Es la alternativa elegida.

## Consecuencias

- Un tenant actual conserva su comportamiento hasta que guarde horarios por
  servicio.
- El calendario general sigue siendo útil para la vista administrativa y como
  respaldo de otros servicios futuros.
- Si más adelante el producto requiere una agenda distinta por cada `Service`
  individual, deberá evaluarse una nueva decisión y una tabla específica; esta
  decisión no pretende anticiparla.
