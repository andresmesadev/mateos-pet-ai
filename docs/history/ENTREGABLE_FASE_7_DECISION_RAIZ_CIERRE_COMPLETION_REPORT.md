# Decisión raíz del modelo de consumo de la API pública — Cierre de la Fase 7

**Fecha:** 2026-08-13
**Naturaleza:** entregable documental — decisión de producto con evidencia, sin cambios de código, schema, ni bump de versión. Mismo tipo de entregable que la formalización de la Fase 7 y que 6.1.
**Estado:** ✅ Completado. **La Fase 7 (Ecosistema) queda cerrada oficialmente.**

---

## Objetivo

Al formalizar la Fase 7 (2026-08-13, mismo día), quedó registrada una decisión raíz sin tomar: ¿quién consume la API pública construida en los diez entregables 7.1-7.10 — apps propias del equipo, integradores externos, o ambos? De esa decisión dependían directamente dos de las deudas del backlog (creación/expiración de `ApiKey`, política de CORS). Este entregable resuelve esa decisión con evidencia y cierra formalmente la fase.

## Auditoría de evidencia (Macroetapa 1)

Se buscó en `docs/PLAN_MAESTRO.md` y `docs/architecture/domain-model-v1.md` cualquier indicio de la intención original detrás de "Ecosistema":

- **`domain-model-v1.md` §11 (Canal):** modela "Portal del Cliente" como canal de primera clase, en la misma categoría que WhatsApp, Email y Dashboard — es decir, ya estaba concebido como un canal *propio de la plataforma*, no como una superficie para terceros.
- **Principio 8 del Plan Maestro** ("los canales son reemplazables") es un principio arquitectónico interno sobre desacoplar reglas de negocio de un canal específico — no una declaración de apertura a integradores externos.
- **Cero menciones en todo el proyecto** a un programa de partners, un marketplace de integraciones, o cualquier tercero real identificado como consumidor.

## Decisión adoptada: Opción C

Se presentaron tres opciones (A — solo apps propias, B — terceros también, C — apps propias hoy sin descartar terceros) con sus implicaciones. **El responsable del proyecto eligió la Opción C:** la API pública sirve hoy exclusivamente a canales propios del equipo (el Portal del Cliente ya construido en 7.1-7.10); la puerta a integradores externos queda conceptualmente abierta, pero sin ningún trabajo adicional mientras no exista un segundo consumidor real que lo justifique.

## Consecuencia sobre el backlog de la Fase 7

Con la Opción C, las siguientes deudas dejan de tener urgencia arquitectónica y se archivan como **backlog condicional** (se retoman solo si aparece un segundo consumidor real), no como trabajo pendiente de la fase:

- Creación y expiración de `ApiKey` vía API.
- Política de CORS para terceros.
- Alcance B de Trazabilidad (atribución por staff individual) — ya diferido por la ausencia de identidad multi-staff en el dashboard; ahora tampoco tiene un caso de uso multi-consumidor que lo urja.

Dos deudas quedan como backlog condicional independiente de esta decisión (no bloqueaban el cierre): vinculación `serviceId`↔`Appointment`, y la reincorporación de `resolve-service-price` al catálogo público.

## Qué se hizo

1. **`docs/PLAN_MAESTRO.md`** — sección FASE 7 actualizada: estado cambiado de "🚧 Formalizada" a "✅ Fase cerrada oficialmente"; nueva subsección "Decisión raíz resuelta" con la evidencia y la opción adoptada; backlog reorganizado entre "archivado por la decisión raíz" y "condicional independiente"; criterio de cierre marcado como cumplido.
2. **`CLAUDE.md`** — la regla de fases futuras actualizada para reflejar el cierre; el bullet de "Principio permanente de la Fase 7" marcado como histórico (fase cerrada), con la instrucción vigente hacia adelante de no construir creación/expiración de `ApiKey` ni CORS sin un segundo consumidor real.

## Validación

- `docs/PLAN_MAESTRO.md` y `CLAUDE.md` consistentes entre sí — mismo estado de cierre, misma decisión, mismas consecuencias sobre el backlog.
- Ningún archivo de código, test, schema o migración tocado.
- Sin bump de versión — mismo criterio que la formalización previa y que 6.1.

## Criterio de cierre cumplido

- ✅ Decisión raíz tomada explícitamente, con evidencia auditada antes de decidir, no por conveniencia.
- ✅ Backlog de la fase reclasificado en función de la decisión — condicional, no urgente.
- ✅ `docs/PLAN_MAESTRO.md` y `CLAUDE.md` actualizados y consistentes.
- ✅ Fase 7 declarada cerrada oficialmente.
- ✅ Sin cambios de código, schema, migraciones ni versión.
