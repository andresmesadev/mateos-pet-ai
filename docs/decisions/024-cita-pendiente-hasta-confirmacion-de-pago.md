# ADR 024 — Cita finalizada pendiente de pago hasta confirmación de Caja

2026-10-17. Autorización explícita: «Sí, pendiente de pago hasta confirmar en Caja».

Continuación autorizada el mismo día: [ADR 025](025-carrito-unico-de-cita-y-comision-final.md) permite ajustar el importe de una obligación todavía impagada en un carrito único con adicionales y corrige su comisión por anulación/reemplazo. La confirmación del ingreso y el tratamiento histórico de este ADR se conservan.

## Reconciliación con ADR 007

Se conserva una Transaction activa única por cita y la creación atómica de cita completada, comisión y obligación de cobro. La comisión es inmutable y solo utiliza el servicio. Se modifica el reconocimiento del ingreso: finalizar no acredita dinero recibido. `paidAt = null` representa pendiente; su confirmación por Caja fija método, operador y fecha real de pago, sin cambiar el monto. `paymentStatus` es una proyección de `paidAt`, no otra fuente de verdad.

Registros anteriores conservan sus importes y fechas. Un cobro histórico con fecha pero sin operador sigue disponible para revisión; completar esa revisión no mueve el ingreso a otra fecha. No se reclasifican automáticamente ventas del ensayo ni de producción.

El cierre diario suma solo cobros con fecha de pago dentro del día. La integridad de citas completadas comprueba que tengan su obligación activa de cobro, pendiente o pagada, sin exigir que se pague el mismo día. Un pago posterior entra en el día de confirmación. La comisión conserva su fecha de prestación; no se reescribe para alinearla al día de pago. No se implementan abonos, crédito ni devolución.

## Cinco etapas

1. Función: finalizar deja pendiente, acceso con icono de Caja por cita, confirmación humana y consulta posterior del comprobante. Ninguna factura manual adicional para el mismo servicio.
2. Casos: terminar sin sumar dinero, pagar una vez con método válido, recuperar un resultado incierto sin duplicar, rechazar segundo pago contradictorio, pagar otro día, cerrar con pendientes, mantener históricos e impedir cruces de Tenant/rol.
3. Arquitectura: conservar disparador de obligación en Agenda; ampliar el comando existente `settleSystemCharge` con transacción, bloqueo de fila y gate del día contable. Reutilizar `ReviewPaymentDialog`, resolución central e importe congelado. El botón conduce a Caja filtrada por cita. DTO deriva estado e identifica transacción para evitar búsquedas manuales por nombre.
4. Persistencia: `Transaction.paidAt` nullable; nuevas obligaciones se crean con null y relaciones de cliente/mascota. Se liquida la misma fila. No añadir una entidad de cobro ni otra bandera de estado. Los reportes temporales excluyen null; el panel de pendientes conserva el monto por cobrar separado de recibido.
5. Esquema: migración aditiva que permite null exclusivamente en cobros de cita. No cambia filas existentes. Regenerar Prisma. Verificar PostgreSQL real, cierre, pago concurrente/repetido, permisos, cuenta de ingresos, navegador, lint, build y regresiones completas antes de publicar.

Este ADR sustituye únicamente la presunción de pago al completar y su interpretación para consolidación de ingresos; mantiene precio único, comisión inmutable, una Transaction activa por cita y consistencia atómica de la obligación.
