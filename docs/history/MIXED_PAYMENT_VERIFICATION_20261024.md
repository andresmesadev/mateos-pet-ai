# Pago mixto y base compacta — verificación local

24/10/2026. Solicitud del responsable tras revisar 2.57.1. Preparado localmente,
sin commit, push, despliegue ni cambios sobre datos del centro. Producción
permanece en 2.57.1. Diseño en [ADR 032](../decisions/032-pago-mixto-efectivo-transferencia.md).

## Resultado funcional

- En Cobrar, la base ocupa una sola línea de lectura con su valor. Registrar o
  actualizar la base continúa en Caja diaria y con sus permisos existentes.
- Efectivo + transferencia permite indicar las dos partes. Deben ser positivas
  y sumar el total; cambio y valor exacto usan solamente la parte en efectivo.
- Venta manual, checkout de cita y liquidación de obligación conservan un solo
  cobro y su reparto. El reintento mantiene sus importes y un pago ya confirmado
  no admite otro reparto. Un cierre previo bloquea reclasificar un cobro antiguo.
- El comprobante e historial muestran ambos importes. Caja, arqueo y reportes
  atribuyen cada parte a su medio; los totales globales cuentan una sola venta.
  Las etiquetas explican que los contadores por medio no se suman como ventas.
- Filtrar por efectivo o transferencia encuentra también comprobantes mixtos.
  El total de comprobantes encontrados sigue siendo su importe completo; las
  tarjetas por medio muestran la parte de dinero correspondiente.
- Borrador y solicitud incierta conservan partes, clave y cuerpo congelado.
  El fingerprint incluye ambos importes normalizados. Gastos siguen usando un
  solo medio. Resolución de precio y reglas de comisión permanecen intactas.

## Persistencia y prueba con PostgreSQL

Migración aditiva `20261024195000_mixed_cash_transfer_payment`: columnas
Transaction.cashAmount y transferAmount DECIMAL(10,2), nullables, con CHECK de
positividad/suma para mixed y nulidad para el resto. No tiene backfill ni cambia
registros históricos. Prisma generate y validate correctos.

Se creó una base aislada `pos_mixed_test` en un contenedor PostgreSQL local,
puerto 127.0.0.1:55442. Las **66 migraciones** se aplicaron correctamente.
`scripts/mixed-payment-postgres.test.cjs`: **1 test, 1 pass, 0 fail**. Comprueba:

- Rechazo por la BD de suma incorrecta, parte cero y método incompatible.
- Persistencia real de venta manual y checkout sobre la obligación existente.
- Dos liquidaciones concurrentes devuelven el mismo pago y un solo evento.
- Rechazo de un segundo reparto diferente después de pagar.
- Arqueo y reporte reales: cuatro cobros suman 160.000; efectivo 70.000 y
  transferencia 90.000. Los tres mixtos no duplican el ingreso.
- Anulación excluida de ingresos, conservando sus importes; filtro por método
  encuentra las partes; el parser real del frontend acepta el reporte.

Los datos de este ensayo son fixtures aislados, no datos del centro. El
contenedor temporal fue detenido y retirado al concluir. La integración se
incluye automáticamente en el job administration-postgres existente. Su guard
solo admite el destino temporal explícito o mateos_dev en CI sobre loopback.
La advertencia de pg sobre consultas concurrentes en un cliente no falló las
aserciones; no se declara una revisión visual ni una prueba de todas las rutas
de inventario nuevas con pago mixto. El workflow de stock no cambió.

## Evidencia de comandos

- Helpers de `scripts/*.test.cjs`, excluyendo PostgreSQL: **191 tests, 191 pass,
  0 fail**; incluye pagos mixtos, recibo, borradores, arqueo, reporte y base.
- `npm run lint` en frontend: `eslint`, salida 0.
- `npm run build` en frontend: `Compiled successfully`, TypeScript correcto,
  `Generating static pages (32/32)`, salida 0.
- `npx prisma validate`: `The schema ... is valid`.
- Backend final: **220 suites passed / 1.865 tests passed**, salida 0, 35,87 s.
  Ejecuciones dentro del aislamiento de Windows terminaron con código
  -1073740791 sin resumen, incluso al agrupar archivos. La prueba HTTP local
  dashboard-rate-capacity aislada pasó fuera de ese entorno, seguida del conjunto
  completo sin exclusiones. Se conservan los logs locales de los intentos y el
  resultado final en `.cache/pos-mixed-jest-final.json`. Los errores que aparecen
  en el log de tests corresponden a escenarios de proveedores y Prisma simulados;
  el resumen final no contiene fallos de aserciones.
- Revisión del repositorio completo: agrupaciones por método en SQL/Prisma,
  arqueo, métricas, DTO, métodos de cobro, filtros, parsers y exportación cubiertos.
  No se cambian precios ni comisiones. Diff sin errores de espacios.
- Revisión visual pendiente: navegador local deshabilitado en esta sesión.

## Publicación posterior

El versionado se evaluó como capacidad funcional nueva para una siguiente
versión menor; el bump/tag se realizará con la publicación autorizada. Este
documento no certifica despliegue ni estabilidad de esta variante en producción.
Aplicar primero la migración aditiva. Después de recibir pagos mixtos, una
reversión debe conservar soporte de lectura del reparto: no borrar columnas,
restaurar una base antigua ni reasignar los importes a un solo medio.
