# ADR 001 — Congelamiento del diseño del Entregable 2.1 (Sistema Operativo de Servicios)

**Fecha:** 2026-06-30
**Estado:** Aceptado
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.1 — Sistema Operativo de Servicios

---

## Contexto

Conforme a la `docs/PHASE_2_EXECUTION_RULE.md`, ningún entregable de la Fase 2 puede comenzar su implementación sin haber completado y aprobado, en orden, sus primeras cuatro etapas de diseño: definición funcional, casos de uso, arquitectura técnica y modelo de persistencia. La etapa 5 (esquema físico) es la última etapa de diseño antes de la implementación.

Para el Entregable 2.1 se completaron y aprobaron explícitamente, en sesiones sucesivas:

1. **Definición funcional** — implícita en el propósito documentado del Entregable 2.1 dentro del Plan Maestro (sección Fase 2, roadmap interno).
2. **Casos de Uso** — `docs/architecture/use-cases/sistema-operativo-servicios.md`.
3. **Arquitectura Técnica** — `docs/architecture/technical-design/sistema-operativo-servicios.md`, incluyendo los cuatro Principios Permanentes de la capa de aplicación.
4. **Modelo de Persistencia** — `docs/architecture/technical-design/servicios-modelo-persistencia.md`, incluyendo los tres Principios Permanentes del modelo de persistencia.

## Decisión

Se declara **congelado** el diseño de las cuatro etapas anteriores del Entregable 2.1. Este es el punto de no retorno: el diseño documentado en los tres documentos listados arriba es la versión oficial sobre la cual se construirá la etapa 5 (esquema físico) y, después, la implementación.

"Congelado" significa que estas cuatro etapas no se reabren por conveniencia de implementación. Solo pueden modificarse mediante una **decisión arquitectónica explícita**, registrada como un nuevo ADR que reemplace o enmiende a este, nunca mediante un ajuste silencioso introducido al escribir el esquema físico o el código.

Si durante la etapa 5 o la implementación se descubre que alguna de las cuatro etapas congeladas tiene un defecto o una omisión, el camino correcto es detener el avance, registrar la decisión de reabrir esa etapa específica, corregirla, y solo entonces continuar — no parchear el problema en una capa inferior para evitar tocar el diseño congelado.

## Consecuencias

- La etapa 5 (esquema físico: Prisma, claves, índices, restricciones, migraciones) puede comenzar.
- Cualquier cambio futuro a los contratos de los casos de uso, a la arquitectura técnica o al modelo de persistencia del contexto `Servicios` requiere un ADR propio que justifique por qué se reabre el diseño congelado.
- Este ADR no congela el Plan Maestro, el Modelo de Dominio ni los Principios Permanentes del producto — esos documentos siguen siendo, como siempre, de mayor jerarquía que cualquier diseño de un entregable específico.

---

*ADR 001 · Plataforma Operativa Inteligente · Mateos Pet*
