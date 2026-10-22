# Base de caja y participación profesional: verificación local

Actualización posterior: publicado el 22/10 en 2.55.0.
[Certificación productiva](RELEASE_2_55_0_VPS_20261022.md).
El contenido inferior conserva el corte previo a la autorización y publicación.

Fecha: 22/10/2026. Estado: implementado y probado localmente, sin publicación.
[Diseño de cinco etapas](../architecture/cash-opening-and-professional-reports-20261022.md).

## Resultado funcional

- En Punto de venta → Caja, Administración confirma la base de efectivo de la
  jornada. Puede corregirla mientras siga abierta; cero es un importe explícito.
- Al cerrar, indica el efectivo que deja. El cierre conserva ambos importes y
  bloquea su edición. La siguiente apertura sugiere el efectivo del último
  cierre anterior; requiere confirmación y no reutiliza una sugerencia que
  ya tuvo una apertura intermedia sin cierre.
- Base y efectivo dejado no crean ventas, ingresos, gastos ni pagos. Los
  cierres anteriores sin esos datos muestran «No registrado», sin inferir cero.
- Reportes muestran ingresos, gastos, participación profesional generada y
  saldo tras reservarla. Excel e impresión incluyen el desglose profesional.
  Se usa Commission activa del período, con sus importes históricos, sin
  recalcular porcentajes desde el contrato actual ni incluir anulaciones.

La reserva no acredita entrega de dinero. Gastos manuales que representen pagos
a profesionales no se concilian automáticamente con esa reserva. El reporte
explica esta distinción; no se inserta un segundo Expense al calcularla.

## Persistencia, permisos y concurrencia

Migración aditiva `20261022190000_cash_opening_and_retained_cash`: CashOpening
único por Tenant/fecha y dos columnas monetarias opcionales en DailyClose.
Prisma regenerado. Sin relleno de históricos ni modificaciones de Commission.
Fecha civil de Colombia, importes no negativos con dos decimales y rechazo de
aperturas futuras. Tenant, actor y procedencia se resuelven en el servidor.

Guardar base y cerrar comparten el bloqueo de jornada y transacción serializable.
El cierre compara la base revisada con la vigente: una corrección concurrente
no puede producir un snapshot con un importe obsoleto. Respuestas inciertas
se recuperan consultando el hecho guardado, sin duplicarlo.

## Evidencia ejecutada

```text
Backend Jest --runInBand --silent
Test Suites: 217 passed, 217 total
Tests:       1822 passed, 1822 total

node --test scripts/pos-reports.test.cjs
tests 10; pass 10; fail 0

node scripts/verify-onboarding-local.cjs --cash-opening-reports
Onboarding integration: 13 passed, 0 failed.

node scripts/verify-onboarding-local.cjs --grooming-transport --pet-grooming-sync --bookable-other-services
Onboarding integration: 63 passed, 0 failed.

Frontend ESLint completo: exit 0
Next build + TypeScript: exit 0
```

Los recorridos de Chrome usan PostgreSQL desechable con las 65 migraciones y
comprobación de esquema sin diferencias. Cubren apertura manual y sugerida,
cierre histórico desconocido, aislamiento, importes cero, concurrencia real,
recuperación de cierre tras perder respuesta y formulario móvil de 390 × 720.

Ejemplo ficticio verificado: ingresos 200000, gastos 10000 y participaciones
40000 + 15000, derivadas de servicios al 50% y 30%, dan reserva 55000 y saldo
135000. La base 30000 no incrementa los ingresos; el cierre conserva 25000
dejados para la siguiente jornada. Cambiar después un contrato a fijo no
altera esas comisiones. Excel se reabre con cuatro hojas e importes numéricos;
la impresión muestra el mismo desglose. También pasan los recorridos previos
de peluquería, cobro, sincronización de expediente y vacunación agendable.

Evidencia privada ignorada en `.cache/cash-opening-*.log` y capturas de
`.cache/onboarding-verification/`. Los contenedores propios temporales fueron
retirados por el harness. No se ejecutaron jobs, mensajes ni cobros reales.

## Publicación pendiente

El responsable pidió estos cambios antes de commit, push y despliegue. No se
ejecutó ninguna de esas acciones ni se aplicó la migración a producción.
Producción permanece en 2.54.0 con 64 migraciones. El lote incorpora capacidades
nuevas: corresponde evaluar una versión menor (candidata 2.55.0) cuando se
autorice su publicación, con coherencia entre código, documentación y salud.
No se registró una base, cierre, pago o consumo de inventario del centro real.
