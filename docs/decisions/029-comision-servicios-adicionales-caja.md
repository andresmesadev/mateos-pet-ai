# ADR 029 — Comisión de servicios adicionales de Caja

Solicitud 19/10/2026: Dayra tiene cuatro servicios principales por 99000 de comisión, pero faltan Desenredada 28000 × 50% = 14000 y Corte de uñas 8000 × 50% = 4000, incluso cuando este último acompaña una consulta veterinaria. El responsable confirmó expresamente que ambos fueron realizados por Dayra. Total esperado 117000. La jornada está abierta.

## 1. Definición funcional

El reparto sigue cada servicio y su profesional, no la categoría general del comprobante. Productos, domicilio y servicios directos no generan porcentaje. El contrato y el check del servicio gobiernan las líneas adicionales igual que el servicio principal. No se modifica una comisión histórica ni un comprobante.

## 2. Casos de uso

Registrar comisión por línea de servicio pagada: Caja identifica servicio de catálogo y profesional activo del mismo establecimiento; exige profesional para servicios con reparto. Principal de cita conserva su comisión existente; solo adicionales y servicios de venta libre generan registros por línea. Congela base total (cantidad × precio), tasa, servicio y profesional. Idempotencia por línea y transacción del cobro. Anular venta anula también sus comisiones, con los bloqueos de cierre/liquidación existentes. Corrección administrativa histórica: vinculación explícita de línea pagada a servicio y persona; requiere motivo, día abierto y profesional sin liquidación consolidada. Nunca infiere por nombre ni asigna automáticamente al médico el trabajo de peluquería.

## 3. Arquitectura técnica

Staff conserva un único libro Commission. Un nuevo caso de uso por línea usa puertos para leer la línea pagada, servicio y profesional, junto con gates de día y profesional, cálculo existente y evento ComisiónRegistrada. Workflow POS lo invoca en la misma unidad de trabajo que factura/inventario, y el evento se publica tras commit. Una venta anulada no puede conservar comisión activa. Caja muestra selector de profesional en líneas con reparto; identidad del servicio viaja como ID y se valida server-side. Precios continúan entrando por el catálogo/resolvedor y el importe final confirmado en Caja.

### Decisiones diferidas

No se añaden nóminas ni pagos al profesional; la reserva del cierre sigue sin acreditar desembolso. No se reabren cierres oficiales ni se reinterpretan automáticamente comprobantes anteriores. Los artículos manuales sin identidad de catálogo no inventan reparto; se informa al operador. El saneamiento de hoy es explícito y acotado a las dos líneas confirmadas.

## 4. Persistencia

Commission admite exactamente una fuente: cita principal o TransactionItem. Conserva historial de anulaciones/reemplazos, profesional y tasa congelados. Cada línea tiene como máximo una comisión activa. TransactionItem nuevo puede guardar serviceId y performedByStaffId; los registros históricos quedan null. La corrección histórica crea Commission asociada a la línea con serviceId explícito, sin editar la línea. Una línea de producto o transporte no puede originarla. Las lecturas existentes de Finanzas y liquidaciones agregan el mismo libro, sin segunda suma derivada del catálogo actual.

## 5. Esquema físico

Migración aditiva: Commission.appointmentId nullable; transactionItemId nullable con FK restrict, serviceId nullable con FK restrict, CHECK XOR de fuentes e índice único parcial por transactionItemId activo. Se conserva el índice parcial por cita. TransactionItem agrega referencias opcionales a servicio/profesional. Commission.splitRate aumenta de Decimal(4,3) a Decimal(5,4) para conservar porcentajes con dos decimales (por ejemplo 33,33%). Las claves tenant se verifican bajo la misma transacción antes de escribir. Sin backfill automático. prisma generate obligatorio.
