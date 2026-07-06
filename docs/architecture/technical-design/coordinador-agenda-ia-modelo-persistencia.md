# Entregable 3.5 — Coordinador de Agenda IA · Etapa 4: Modelo de Persistencia

**Estado:** Implementado y validado. Congelada.

---

## Sin agregados nuevos

Igual que Recepcionista IA (3.4), este es un entregable de orquestación pura (Etapa 1, Decisión 1): **no introduce ninguna entidad ni tabla nueva.** Reutiliza en su totalidad `DigitalEmployee`, `AgentTask`, `AgentDecision` (Empleados Digitales, 3.2). No usa `Escalation` — el flujo de recordatorios no tiene rama de escalamiento (Etapa 1, Decisión 5).

## Sin preguntas abiertas

La Etapa 3 no dejó preguntas pendientes — el diseño no introduce ninguna variación sobre el esquema ya congelado de 3.2.

## Extensión del seed operativo de 3.4

`scripts/seed-digital-employees.js` (3.4) amplía su lista de especializaciones aseguradas por tenant, añadiendo `"coordinador_agenda"` junto a `"recepcionista"` — extensión aditiva del mismo mecanismo, mismo criterio que la lista extensible `DEFAULT_EVENT_TYPES` de `seed-event-types.js` (3.0). No requiere migración de esquema.

## Invariantes que NO requieren esquema nuevo

- "Un Coordinador activo por tenant" no se fuerza con índice único — mismo criterio ya aceptado en 3.4 para Recepcionista (`DigitalEmployee` permite múltiples filas por `(tenantId, specialization)` sin unicidad, decisión de 3.2 no reabierta).
