# Recepción de peluquería cada 20 minutos

## 1. Definición funcional

Solicitud explícita del responsable del producto, 19 de octubre de 2026: sustituir la separación de una hora por 20 minutos entre citas de peluquería. Es un intervalo de recepción/reserva, no una promesa de terminar el baño o corte en 20 minutos. La duración de catálogo, tarifas y comisiones no se editan.

## 2. Casos de uso

Dashboard, Portal y motor conversacional consultan y reservan 09:00, 09:20, 09:40, etc., desde la apertura real. Se mantiene la secuencia de huecos futuros y el margen de anticipación de 30 minutos, así como cierres, festivos, excepciones y aislamiento por Tenant. Cada turno de recepción ocupa 20 minutos; dos reservas con menos separación se rechazan, también bajo concurrencia. Reprogramar usa la misma regla. Un peluquero puede recibir la siguiente mascota 20 minutos después; horarios, ausencias y habilitaciones siguen vigentes. Veterinaria conserva su comportamiento.

## 3. Arquitectura técnica

Política de intervalo única reutilizada por disponibilidad, creación/reprogramación y asignación de staff. Generar turnos y comprobar secuencia en minutos enteros evita acumulación de errores decimales. Adaptadores existentes conservan contrato de hora decimal y representación HH:mm. Google Calendar refleja el bloque de recepción de peluquería; no se activa ninguna integración ni WhatsApp.

## 4. Persistencia

Se reutilizan Appointment.date, availabilityBucket, staffId y el índice único existente. El bloqueo transaccional por Tenant/bucket sigue protegiendo la comprobación de cruces. No se mueven citas, no se convierten duraciones históricas ni se cambian precios. La ocupación operativa se interpreta con la nueva cadencia, incluidas citas futuras ya registradas.

## 5. Esquema físico y validación

Sin cambios de schema/migración. Regresiones para minutos exactos, apertura con minutos, cierre, huecos, reserva concurrente, reprogramación, peluquero único y veterinaria. Ejecutar Jest completo y ensayo Chrome/PostgreSQL desechable; no modificar fichas reales ni publicar el lote.

## Decisiones arquitectónicas diferidas

Capacidad paralela, fases internas de peluquería, duración por tamaño y configuración de la cadencia por establecimiento no forman parte de este pedido. La regla aprobada aplica al bucket de peluquería existente.
