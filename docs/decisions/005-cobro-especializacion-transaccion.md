# ADR 005 — `Cobro` deja de ser una entidad independiente; `Transaction`/`Transacción` se convierte en la entidad oficial de ingreso

**Fecha:** 2026-07-01
**Estado:** Aceptado
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.3 — Sistema Operativo de Finanzas
**Naturaleza de este ADR:** reconciliación arquitectónica contra el Modelo de Dominio ya aprobado — no una corrección de implementación, no un cambio de opinión sobre el diseño. El Entregable 2.3 se apartó, durante sus Etapas 2 y 4, de una definición que `docs/architecture/domain-model-v1.md` ya establecía antes de que este entregable comenzara.

---

## Qué dice el Modelo de Dominio v1, y qué no consultamos a tiempo

`domain-model-v1.md`, sección 7 (`Finanzas`), ya definía, antes del inicio del Entregable 2.3:

> **Transacción** — Cada movimiento de dinero: un cobro por servicio, un gasto operativo, un ingreso adicional. Tiene monto, categoría, método de pago, quién la registró y si está vinculada a una cita.
> **Cobro** — La transacción específica del pago de un servicio. Vinculada a una cita completada.

Es decir: **`Cobro` nunca fue definido como una entidad hermana de `Transacción` — fue definido como su especialización**, "la transacción específica del pago de un servicio". Durante la Etapa 2 (Casos de Uso) y la Etapa 4 (Modelo de Persistencia) de este entregable, `Cobro` se diseñó como una entidad nueva e independiente, sin volver a consultar esta definición ya vigente. La auditoría de las entidades físicas de Fase 1 (`Transaction`, `TransactionItem`, `Expense`), realizada al inicio de la Etapa 5, expuso la inconsistencia.

## Qué representan realmente `Transaction` y `Cobro` (auditoría previa)

- **`Transaction`/`TransactionItem` (Fase 1, en producción):** registra una venta de mostrador — ítems de línea, método de pago, vínculo opcional y único a una cita (`appointmentId @unique`). Nace de una acción humana de caja, con `POST /transactions`.
- **`Cobro` (diseñado en la Etapa 2 de este entregable):** un hecho reactivo puro, sin ítems, originado únicamente por `CitaCompletada`, sin intervención humana.

La diferencia entre ambos no está en la naturaleza del hecho — los dos son "dinero que entró al negocio, atribuible a algo que el negocio entregó" — sino en el **origen** (evento del sistema vs. acción humana) y en un atributo accesorio (la itemización, útil para ventas de mostrador, irrelevante para un ingreso cuyo precio ya viene resuelto por Servicios). El origen y la itemización no son parte de la identidad conceptual del hecho, de la misma forma en que `Commission` no deja de ser una comisión válida por haberse generado automáticamente en vez de registrarse a mano.

## Decisión

**`Transaction` (renombrado conceptualmente a `Transacción`, consistente con el Modelo de Dominio) se convierte en la entidad física oficial de ingreso del negocio.** `Cobro` deja de existir como entidad independiente y pasa a ser un **origen** de `Transacción`, no una tabla propia.

- `Transacción` incorpora un campo de origen explícito (p. ej. `origin`: `"system_appointment_completed"` | `"manual_pos_sale"`), mismo patrón ya usado en el proyecto para distinguir procedencia sin crear tablas separadas (`Commission.priceSource`, `PriceRule.targetType`, `StaffAvailability.type`).
- Cuando el origen es `system_appointment_completed`, la fila nace sin intervención humana, reactivamente ante `CitaCompletada`, sin ítems (o con un ítem implícito único cuyo monto es el precio ya resuelto por Servicios).
- Cuando el origen es `manual_pos_sale`, la fila conserva exactamente el comportamiento ya existente de Fase 1: ítems de línea, método de pago, vínculo opcional a una cita.
- El caso de uso `Registrar Cobro al Completarse una Cita` (Etapa 2) se mantiene como intención de negocio, pero su resultado técnico deja de ser una tabla nueva — pasa a crear una `Transacción` con origen `system_appointment_completed`.

## Por qué esta decisión, y no las alternativas evaluadas

Se evaluaron tres alternativas explícitamente:
1. `Transaction` permanece como fuente oficial sin cambios — descartada: depende de que un humano recuerde generar el ticket, contradice el principio reactivo ya establecido desde 2.1.
2. `Cobro` se mantiene como entidad nueva y `Transaction` queda restringida al POS — descartada: deja fuera del `Cierre del Día` las ventas de mostrador sin cita asociada (una regresión funcional frente al arqueo de caja que Fase 1 ya ofrece), y duplica el mismo hecho económico bajo dos nombres sin necesidad.
3. **`Transaction` evoluciona para cubrir ambos orígenes, absorbiendo el rol de `Cobro`** — aceptada: es la única que coincide con la definición ya aprobada en el Modelo de Dominio v1, cierra la brecha de completitud del `Cierre del Día`, y no exige mantener dos entidades para el mismo concepto.

## Consecuencias — qué queda reabierto y qué no

**Se reabren formalmente, solo para reconciliar con esta decisión, sin reabrir ningún otro punto ya aprobado:**
- Etapa 2 (Casos de Uso) — `docs/architecture/use-cases/sistema-operativo-finanzas.md`: el caso de uso `Registrar Cobro al Completarse una Cita` se mantiene, con su salida técnica corregida.
- Etapa 3 (Arquitectura Técnica) — `docs/architecture/technical-design/sistema-operativo-finanzas.md`: el puerto de salida correspondiente pasa de `ChargeRepositoryPort` a `TransactionRepositoryPort` (compartido, no exclusivo de Finanzas).
- Etapa 4 (Modelo de Persistencia) — `docs/architecture/technical-design/finanzas-modelo-persistencia.md`: `Cobro` deja de listarse como entidad nueva; se reemplaza por la extensión de `Transacción` (Fase 1, reutilizada).

**No se reabre:**
- La Definición Funcional (Etapa 1) — el problema de negocio, el trabajo humano eliminado y los límites de contexto no cambian; solo cambia la traducción técnica de "Cobro" como intención de negocio.
- El resto de entidades y decisiones de las Etapas 3 y 4 (`Gasto`/`Expense`, `Cierre del Día`, `Período Financiero`, ausencia de Aggregate Root, snapshot congelado, partición del tiempo de `Período Financiero`).
- `Commission` (Staff, 2.2) no se modifica ni se fusiona con `Transacción` — sigue siendo el registro de Staff sobre el split de comisión; `Transacción` es el registro de Finanzas sobre el ingreso total. Esta coexistencia ya estaba prevista en el propio Modelo de Dominio v1 (`Cobro` con "el desglose de split si aplica").

## Qué no resuelve este ADR

No decide todavía si `Expense` (Fase 1) se extiende para representar `Gasto` — esa decisión ya fue confirmada por separado (auditoría previa a este ADR) y se documenta en la reconciliación de la Etapa 4, no aquí. Tampoco decide el mecanismo físico exacto (columnas, índices) de la extensión de `Transaction` — eso corresponde a la Etapa 5 (Esquema Físico), que se redacta después de esta reconciliación.

---

*ADR 005 · Plataforma Operativa Inteligente · Mateos Pet*
