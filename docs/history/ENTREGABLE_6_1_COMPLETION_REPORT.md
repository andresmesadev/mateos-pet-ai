# Cierre del Entregable 6.1 — Reconciliación del Modelo de Establecimiento

**Fecha:** 2026-07-27
**Fase:** Fase 6 — Operación Multi-Establecimiento Real (primer entregable del roadmap interno: 6.1 → 6.6)
**Estado:** ✅ Macroetapas 1-3 completadas. Pendiente únicamente la Macroetapa 4 (Cierre Oficial: commit, tag, push — sin bump de versión, ver "Versionado" abajo).
**Naturaleza del entregable:** exclusivamente documental. No introduce, modifica ni elimina ningún caso de uso, entidad, campo de schema, migración ni comportamiento funcional.

---

## Antecedente — decisión de dominio previa (Organización vs. Establecimiento)

Antes de iniciar la Macroetapa 1 de este entregable, se resolvió formalmente una pregunta de dominio que bloqueaba el inicio de la Fase 6: si el sistema requería introducir una entidad "Organización" (agrupando múltiples Establecimientos bajo una misma cuenta) o si la unidad de aislamiento debía seguir siendo el Establecimiento (`Tenant`) actual. Tras una auditoría dedicada (evidencia de dominio, código y producto), se adoptó oficialmente la **Opción A**: el Establecimiento (`Tenant`) permanece como única unidad de aislamiento; "Organización" fue descartada por ausencia total de evidencia funcional. Esta decisión quedó registrada en `docs/PLAN_MAESTRO.md` (sección Fase 6, "Decisión arquitectónica previa") y en `CLAUDE.md`, y es la premisa sobre la que se construyó el diseño de 6.1.

## Objetivo del entregable

Cerrar la deuda heredada del Entregable 4.2 (que difirió explícitamente "el Contexto Negocio completo — Establecimiento, Módulo, Configuración del Negocio" a 4.3) y no resuelta por 4.3 (que solo entregó su Alcance A): reconciliar formalmente el Modelo de Dominio (`domain-model-v1.md` §1) con la implementación real (`Tenant`), determinando el estado exacto de cada campo declarado y su disposición (implementado, redundante, diferido a otro entregable ya existente, o backlog sin fecha) — sin asumir que la reconciliación requiere necesariamente cambios de código.

## Auditoría (Macroetapa 1) — hallazgos clave

- El renombramiento físico `Tenant`→`Establecimiento` es descartado por evidencia: 432 ocurrencias en 115 archivos de `backend/src`, más el contrato HTTP (`X-Tenant-Id`), la forma de la sesión, y componentes completos del frontend — un cambio completamente desproporcionado sin ningún valor funcional.
- **"Tipo de negocio"** (declarado en el dominio) es redundante con `activeModules` (4.3, Alcance A) — el mecanismo ya implementado cumple la misma función con mayor precisión.
- **Zona horaria / horarios de atención**: brecha real, ya reconocida y explícitamente asignada al Entregable 6.2 (no a 6.1) — evita el solape identificado en la auditoría crítica de la Fase 6.
- **País / moneda**: sin ningún consumidor ni requisito funcional evidenciado en ningún entregable cerrado — backlog arquitectónico transversal, sin fecha.
- **Mensajes de bienvenida**: no pertenece al Contexto Negocio — reasignado conceptualmente al backlog del contexto Comunicación (3.1, que ya difirió "Plantilla de Mensaje").
- **Conclusión de la auditoría:** ningún campo pendiente justifica una modificación de schema en este entregable. El único trabajo real y necesario es documental.

## Implementación (Macroetapa 2)

**Único archivo modificado:** `docs/architecture/domain-model-v1.md` §1 (Contexto: Negocio) — nueva subsección "Reconciliación con la implementación (Entregable 6.1, Fase 5 → Fase 6, 2026-07-27)", que:
- Declara formalmente que `Tenant` **es** la implementación de Establecimiento — sin entidad `Establecimiento` separada ni `Organización` superior.
- Resuelve campo por campo el estado real de cada elemento declarado en el dominio, con su disposición exacta (implementado / redundante / diferido a 6.2 / backlog / reasignado a Comunicación).

**Checkpoint de contradicción:** sin hallazgos — la implementación coincidió exactamente con el diseño congelado en la Macroetapa 1, sin ampliación de alcance.

## 1. Validación Técnica

- `git diff --stat -- backend/src prisma/` → **vacío**. Cero cambios de código, cero cambios de schema, cero migraciones nuevas.
- No aplica ejecución de tests (ningún archivo de código fue tocado); no aplica `prisma generate`/`migrate status` (ningún cambio de schema).

## 2. Validación Funcional / de Contenido Documental

- La reconciliación quedó documentada **únicamente** en `docs/architecture/domain-model-v1.md` — el lugar correcto según la jerarquía documental del proyecto (el Modelo de Dominio es la fuente de verdad conceptual). `docs/PLAN_MAESTRO.md` y `CLAUDE.md` no duplican el contenido de la reconciliación: solo referencian la decisión arquitectónica previa (Organización descartada), que es un antecedente distinto y ya cerrado en la sesión anterior, sin contradicción entre los tres documentos — verificado por lectura cruzada.
- El modelo de dominio mantiene una única definición de Establecimiento: `domain-model-v1.md` §1 no declara ninguna entidad adicional: la nueva subsección refuerza, no reemplaza, la definición original de la entidad.

## 3. Grep exhaustivo — ausencia de referencias activas a "Organización"

Grep de "organizaci" (insensible a mayúsculas) sobre `docs/` y `backend/src` confirma:
- `domain-model-v1.md:73` y `PLAN_MAESTRO.md:429` — únicas menciones relevantes, ambas citando explícitamente "Organización" como **la alternativa descartada**, nunca como entidad activa o vigente.
- Las demás coincidencias (`sistema-operativo-servicios.md`, `PHASE_2_EXECUTION_RULE.md`) son usos genéricos de la palabra ("organización del código/la solución"), sin relación con una entidad de dominio.
- **Cero referencias activas a una entidad "Organización" en todo el repositorio.**

## 4. Validación de ausencia de cambios de código/schema/contratos

Confirmado por `git diff --stat` (vacío sobre `backend/src` y `prisma/`): ningún caso de uso, puerto, adaptador, ruta, contrato HTTP, modelo de datos o migración fue creado, modificado o eliminado por este entregable.

## 5. Validación Arquitectónica

- Principio Permanente de la Fase 6 respetado: no se modificó ninguna regla de negocio, no se tocó el motor conversacional, no se introdujo ninguna entidad de agrupación superior al Establecimiento.
- Sin Reconciliación Arquitectónica necesaria — ninguna contradicción real apareció en ninguna macroetapa.
- El entregable queda registrado oficialmente como una **reconciliación documental derivada de evidencia técnica** (auditoría exhaustiva de código + dominio + producto), con trazabilidad explícita para las fases futuras: cualquier necesidad futura de país/moneda, catálogo real de Módulo, o mensajes de bienvenida ya tiene su disposición documentada (backlog o contexto correcto), evitando que se reabra esta discusión sin evidencia nueva.

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo. La implementación de la Macroetapa 2 coincidió exactamente con el diseño congelado en la Macroetapa 1.

## Estado final

El Contexto Negocio queda reconciliado formalmente entre dominio e implementación: `Tenant` es, sin ambigüedad, Establecimiento. El Entregable 6.2 (Agenda Multi-Establecimiento) puede iniciar su propia Macroetapa 1 sabiendo exactamente qué campos del dominio le corresponde resolver (horarios de atención, zona horaria) sin solaparse con este entregable.

## Versionado

**No aplica bump de versión.** Este entregable no introduce ninguna capacidad funcional nueva ni cambio de comportamiento — es una reconciliación puramente documental. Consistente con la regla del proyecto ("todo cierre oficial evalúa el versionado... si el cierre introduce capacidades nuevas o cambios funcionales relevantes, se realizará el bump correspondiente"): al no haber ninguno, no corresponde bump. La versión oficial del proyecto permanece en `2.16.0`.

## Criterio de cierre cumplido (Macroetapas 1-3)

- ✅ Reconciliación entre `domain-model-v1.md` y la implementación real completada y documentada en el lugar correcto.
- ✅ Única definición de Establecimiento (`Tenant`) en todo el modelo de dominio, sin entidad Organización activa.
- ✅ Cero cambios de código, schema, migraciones o contratos públicos — verificado por `git diff --stat` y grep exhaustivo.
- ✅ Entregable registrado explícitamente como reconciliación documental derivada de evidencia técnica, con trazabilidad para fases futuras.
- ✅ Principio Permanente de la Fase 6 respetado — sin Reconciliación Arquitectónica necesaria.
- ⏳ Macroetapa 4 (commit, tag, push) — pendiente de autorización explícita. Sin bump de versión.
