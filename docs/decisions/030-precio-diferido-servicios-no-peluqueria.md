# ADR 030 — Finalizar servicios sin peluquería con precio pendiente de Caja

2026-10-24. Petición explícita del responsable: únicamente Peluquería exige
precio antes de finalizar; los demás servicios utilizan su tarifa configurada
y, si falta, el equipo la introduce al registrar el pago.

## Reconciliación y diseño en cinco etapas

1. **Función.** Finalizar atención y confirmar su pago son operaciones distintas.
   Peluquería conserva el requisito de precio y transporte resueltos. Consulta,
   vacunación y otros servicios pueden completarse sin precio. Nunca se sustituye
   un importe desconocido por cero. La categoría del servicio manda sobre el
   tipo heredado; el precio habitual de peluquería de la mascota no aplica a
   otras áreas.
2. **Casos de uso.** Una atención no peluquería sin precio termina con valoración
   pendiente y ofrece Registrar pago. Caja exige un importe explícito (incluido
   cero) y, al confirmar, registra una sola obligación pagada, artículos y la
   comisión que corresponda al contrato/servicio. Una tarifa disponible sigue
   generando la obligación pendiente habitual. Cobros confirmados, inventario y
   comisiones históricas no se modifican por este cambio.
3. **Arquitectura.** El resolver central identifica peluquería y conserva el null
   de una atención completada aún no valorada. Agenda publica CitaCompletada con
   priceDeferred; sus reactivos no crean cobro ni comisión hasta la valoración.
   El workflow POS existente crea la obligación diferida dentro de su misma
   transacción serializable, bajo bloqueo de cita, y reutiliza los casos de Staff
   y el protocolo idempotente de Inventario. Los eventos financieros se emiten
   después del commit. Se mantienen los permisos y el aislamiento por Tenant.
4. **Persistencia.** Se reutiliza completed + finalPrice null, exclusivamente
   fuera de peluquería, sin Transaction hasta valorar. Al pagar se fija el precio
   principal y se crea la Transaction de origen system_appointment_completed.
   El índice único existente y el bloqueo de cita evitan dobles cobros. El cierre
   mantiene su rechazo ante atenciones completadas sin obligación: se valoran
   primero en Caja; las obligaciones conocidas impagadas conservan ADR 024.
   Las comisiones se generan con la fecha de valoración para no introducir
   importes retroactivos en cierres o liquidaciones consolidados.
5. **Esquema y validación.** Sin migración ni reinterpretación de dinero existente.
   Probar vacunación con/sin tarifa, mascota con precio de peluquería, categoría
   sobre tipo heredado, cero explícito, bloqueo de peluquería, revalidación bajo
   lock, pago diferido, reintento, Tenant, reversión integral y comisión aplicable.
   Ejecutar tests, lint y build antes de publicar. Versionado se evaluará con el
   lote autorizado para publicación; este trabajo no incluye despliegue.

Esta decisión sustituye únicamente la exigencia universal del ADR 007-D4 y la
preexistencia de obligación del ADR 025 para servicios no peluquería cuyo precio
no estaba configurado. No relaja la unicidad del cobro ni la inmutabilidad de las
comisiones. La solicitud actual autoriza esta modificación de la regla previa.
