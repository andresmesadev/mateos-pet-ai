# Base de caja, efectivo reservado y participación de profesionales

## 1. Definición funcional

Solicitud del responsable del 22/10/2026, antes de publicar cambios pendientes:
registrar la base de efectivo al comenzar y mostrar el descuento de profesionales
por prestación de servicios en reportes. Confirmó que al cerrar se indique
cuánto efectivo dejan y se sugiera ese valor al abrir la siguiente jornada.

La base es dinero existente: nunca venta, ingreso, gasto ni utilidad. El importe
dejado en caja es una declaración del operador, no el saldo de todos los medios
de pago. Una comisión generada es una reserva; este alcance no inventa una
entrega efectiva al profesional ni genera un gasto automático duplicado.

## 2. Casos de uso

- Consultar/guardar base por fecha civil de Colombia y Tenant. Sugerir el importe
  del último cierre anterior solo si tiene efectivo dejado explícito y no hay
  una apertura intermedia sin cierre. Siempre confirmar; cero es válido.
- Corregir base mientras el día esté abierto. Un cierre conserva el importe
  vigente como snapshot y bloquea cambios de esa jornada. Recuperar respuesta
  incierta consultando, sin crear ventas o gastos para registrar una base.
- Cerrar indicando el efectivo que queda para la siguiente jornada. La interfaz
  exige base confirmada y efectivo retenido explícito. Compatibilidad: cierres
  de clientes anteriores sin estos datos se conservan como desconocidos.
- Reportes: ingresos, gastos, parte de profesionales generada y saldo tras esa
  reserva; desglose por profesional y los mismos importes en Excel/impresión.
  Se leen Commission activas congeladas, nunca el porcentaje/contrato actual.
  Así cambiar después un contrato no cambia el informe histórico.

## 3. Arquitectura técnica

Finanzas expone consultar/guardar base con repositorio propio y el mismo
business-day gate utilizado por gastos y cierres. Generar cierre incorpora el
snapshot dentro de su transacción. Permisos administrativos iguales al cierre;
Tenant/actor exclusivamente autenticados. Formularios cliente usan proxyUrl.
Los reportes agregan el ledger activo por completedAt con los mismos límites
Colombia del período seleccionado y reutilizan commissionReserve.

La reserva no vuelve a insertar Expense. Gastos manuales ya registrados no
tienen vínculo con liquidaciones: no se infiere que sean pagos de comisiones
ni se concilian automáticamente. Se mantiene visible esa distinción.

## 4. Persistencia

CashOpening único por Tenant/fecha, importe confirmado, procedencia del cierre
cuando coincide con la sugerencia, actor y marcas de tiempo. DailyClose añade
openingCashAmount y retainedCashAmount opcionales: null significa desconocido
en cierres anteriores, nunca cero inferido. Los totales income/expense/net
mantienen su semántica; la base no se acumula al sumar períodos.

## 5. Esquema físico y validación

Migración aditiva 65, sin rellenar históricos ni tocar Commission. Restricciones
de importe no negativo y unicidad. Regenerar Prisma. Ensayar base manual/cero,
arrastre sugerido, día intermedio abierto, aislamiento, edición contra cierre
concurrente, recuperación y snapshots antiguos. Reporte con porcentajes mixtos,
anulaciones, cambio posterior de contrato y sumas/Excel. Backend completo,
PostgreSQL/Chrome desechables, lint/build. No commit/push/despliegue en este pedido.

## Decisiones arquitectónicas diferidas

La conciliación de pagos reales a profesionales con reservas y gastos manuales,
el arqueo completo por medio de pago y los retiros de efectivo quedan fuera de
este alcance. No se deducen entregas reales a partir de una comisión generada.

Actualización: el responsable autorizó commit, push y despliegue el 22/10/2026,
después de la verificación local. Publicación preparada como 2.55.0.
