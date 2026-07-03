# ADR 008 — El día financiero es el día civil del negocio en su zona horaria

**Fecha:** 2026-07-02
**Estado:** Aceptado (2026-07-02) — congelado
**Origen:** Hallazgo A1 de la auditoría v2.1.0; precondición del Entregable Puente "Exposición del Sistema Operativo" (ADR 006)

---

## Decisión 1 — Definición

El "día" de todos los hechos financieros oficiales (`DailyClose`, el bucketing de `Transaction` y `Expense`, los límites de `FinancialPeriod`) es el **día civil local del establecimiento**, según la zona horaria de su configuración regional (contexto Negocio, Modelo de Dominio §1). Mientras el establecimiento no tenga una zona configurada, se utiliza `America/Bogota` como **valor operativo por defecto — no como una constante del dominio**. El concepto pertenece a Negocio; Finanzas lo consume, no lo define.

## Decisión 2 — Representación

`DailyClose.date` y `FinancialPeriod.periodStart`/`periodEnd` almacenan la **fecha civil como etiqueta canónica** (`YYYY-MM-DDT00:00:00Z` como representación del date key), no el instante del inicio del día local. Los límites de consulta (qué transacciones y gastos pertenecen a ese día) se calculan con la zona IANA en el momento de generar el hecho — nunca con offsets fijos. `@@unique([tenantId, date])` significa exactamente: un cierre por fecha civil por tenant.

## Decisión 3 — Estabilidad

Un cambio en la zona configurada aplica **solo hacia adelante**: nunca reinterpreta hechos ya congelados. El día del cambio puede resultar más corto o más largo; la unicidad por fecha civil lo absorbe sin duplicados.

## Decisión 4 — Convergencia y fuente única

`lib/timezone.js` es la **única fuente** para el cálculo de límites del día. `dayBounds` (contexto Finanzas, hoy UTC) y `bogotaDayStart` (dashboard, hoy offset fijo `-5h`) son no-conformes y convergen a esta regla en el Entregable Puente. Ningún cierre oficial existe aún en la base de datos, por lo que no hay hechos históricos que migrar — razón adicional para fijar esta regla antes de exponer `generateDailyClose`.

## Qué NO decide este ADR

- No añade todavía el campo de zona horaria a `Tenant` — llega con multitenancy, o cuando un tenant lo necesite; mientras tanto rige el default operativo.
- No implementa nada.
