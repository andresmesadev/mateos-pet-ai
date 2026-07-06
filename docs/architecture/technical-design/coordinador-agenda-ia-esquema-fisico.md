# Entregable 3.5 — Coordinador de Agenda IA · Etapa 5: Esquema Físico

**Estado:** Implementado y validado. Congelada.

---

## Sin cambios al esquema físico

Consecuencia directa de las Etapas 1 y 4: **no hay modelos Prisma nuevos, ni columnas nuevas, ni índices nuevos.** Segundo entregable consecutivo de Fase 3 (junto con 3.4) que no toca `schema.prisma`.

## Plan de migración

**Ninguna migración de Prisma se genera para este entregable.**

## Seed operativo (no bloqueante)

`scripts/seed-digital-employees.js` (extendido, ver Etapa 4) inserta el Coordinador de Agenda IA a través del mismo caso de uso ya existente (`agents.registerDigitalEmployee`) — se ejecuta como paso operativo posterior al despliegue, igual que en 3.4.
