# ADR 032 — un cobro con efectivo y transferencia

24/10/2026. Requerimiento explícito del responsable: clientes que pagan una
parte en efectivo y otra por transferencia. Continúa Finanzas/POS; no abre una
fase ni introduce crédito, abonos posteriores o una segunda entidad de cobro.

## 1. Función

Ofrecer Efectivo + transferencia al registrar la venta o pagar una cita. Las
dos partes son positivas y suman exactamente el total en centavos. El efectivo
recibido para calcular cambio cubre solo la parte en efectivo. La base de caja
se muestra como un valor compacto; su edición permanece en Caja diaria.

## 2. Casos y reglas

Un operador autorizado registra una única operación pagada, con sus artículos,
stock y comisiones existentes. El comprobante muestra ambas partes. Caja,
arqueo y reportes atribuyen cada importe a su medio sin duplicar el ingreso.
Anular conserva las partes y excluye el cobro de ambas sumas. Reintentar con la
misma clave conserva el reparto; otra combinación es otro contenido y se rechaza.
Cobros ya pagados y cierres históricos no se reescriben.

## 3. Arquitectura

Validación única del reparto en Finanzas, usada por venta manual, checkout y
liquidación de cobro pendiente. Reutilizar el workflow transaccional existente
y su idempotencia. El adaptador HTTP no acepta totales distintos al calculado.
Las lecturas expanden el reparto a efectivo/transferencia; el número general
de cobros sigue contando la operación una sola vez. Los contadores por medio
pueden incluir un mismo cobro en dos medios y no deben sumarse como ventas.

### Decisiones arquitectónicas diferidas

Combinaciones con tarjeta/otros, crédito, abonos en fechas distintas y devolución
parcial de dinero quedan fuera del alcance. Gastos conservan un solo medio.

## 4. Persistencia

Transaction sigue siendo el único ingreso. paymentMethod admite mixed y guarda
cashAmount/transferAmount como snapshot decimal nullable en esa misma fila.
Single-method existentes mantienen ambas columnas nulas; su total corresponde
al medio existente. No se recalcula ni migra información histórica.

## 5. Esquema y validación

Dos columnas DECIMAL(10,2) nullables y CHECK: mixed implica dos partes positivas
cuya suma es total; cualquier otro medio exige columnas nulas. Migración aditiva,
sin backfill. Regenerar Prisma. Ensayar límites, suma exacta, ambos caminos de
cobro, reintentos y anulaciones, sumas por medio, borradores, comprobante y
regresiones. No usar datos de producción para ensayos.

Las cinco etapas concretan el requerimiento autorizado. No cambia resolución
de precio ni reparto de comisión, y el aislamiento sigue siendo Tenant.

Implementación local verificada: [evidencia y límites](../history/MIXED_PAYMENT_VERIFICATION_20261024.md).
La migración y este comportamiento todavía no se han publicado en producción.
