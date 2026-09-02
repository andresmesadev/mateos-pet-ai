# ADR 010 — Reconciliación Arquitectónica: el principio "motor conversacional intocable" frente a una carencia funcional real de memoria

**Fecha:** 2026-09-02
**Estado:** Aceptado (2026-09-02) — el responsable del proyecto eligió la **Opción A+B combinada** (recomendación de este ADR)
**Fase:** posterior al cierre de la Fase 7 (Ecosistema, v2.32.0) — ninguna fase activa cubre este trabajo hoy
**Origen:** informe comparativo externo (`Mateos Pet AI vs. Sancho Agent IA`, 2026-09-01), hallazgos verificados línea por línea contra el código real antes de este ADR
**Naturaleza de este ADR:** reconciliación entre el principio institucionalizado desde el Entregable 3.4 ("el motor conversacional no se reescribe") y una carencia funcional real y verificada (D-M1) cuya corrección exige editar exactamente los archivos protegidos por ese principio.

---

## La contradicción, con evidencia

**Lo que declara la fuente oficial:** desde el Entregable 3.4 (`docs/history/ENTREGABLE_3_4_COMPLETION_REPORT.md`) y reafirmado como Principio Permanente en las Fases 5 y 7 (`CLAUDE.md`), `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js` y `availability-db.service.js` son intocables salvo Reconciliación Arquitectónica explícita. El único precedente de excepción real es el Entregable 4.3 Alcance B, que la evitó por completo difiriendo el trabajo en vez de cruzar la línea.

**Lo que muestra el código, verificado el 2026-09-02:**

1. `openai.service.js:117-124` y `:237-251` — cada llamada a OpenAI (análisis de intención y generación de respuesta) manda únicamente `{ role: "system" }` + `{ role: "user" }`. El historial de `Message`, que ya existe y ya se persiste, nunca se lee para construir el prompt.
2. `openai.service.js:232` — `generateReply` retorna `null` cuando no hay contexto semántico de RAG, cayendo a plantillas de reglas. Un cliente nuevo sin historial embebido recibe solo respuestas de plantilla.
3. `whatsapp.service.js:104` — `value?.messages?.[0]` procesa solo el primer mensaje del batch de Meta; el resto se descarta en silencio.
4. Ausencia total de `wamid`/`providerEventId` en el backend — cero deduplicación de webhooks reintentados por Meta.

**La tensión real:** corregir (1) y (2) —la carencia de mayor impacto en calidad conversacional percibida— exige editar `openai.service.js`, uno de los archivos nominalmente protegidos. (3) y (4) también viven en `whatsapp.service.js`, igualmente protegido.

## El matiz que decide la reconciliación

El principio "motor conversacional intocable" nunca prohibió mejorar el motor — prohibió **reescribirlo** sin pasar por diseño formal, para no repetir migraciones DDD a medio terminar. La memoria correcta del propósito original (Entregable 3.4): evitar que un Empleado Digital nuevo obligara a tocar lógica conversacional ya probada en producción, no congelar esa lógica para siempre contra correcciones necesarias.

D-M1 no es una funcionalidad nueva de negocio ni un rediseño — es una carencia dentro del propio motor: el historial ya se persiste, ya existe la tabla, y la corrección es leerlo y pasarlo al prompt. Es exactamente el tipo de cambio que el precedente de 4.3 Alcance B evitó (`isBusinessDay`/`isWithinBusinessHours` sí exigían lógica de negocio nueva por tenant); esto no exige lógica de negocio nueva, exige completar una lectura que falta.

## Alternativas

### Opción A — Abrir un entregable formal que sí cruza la línea, con las 5 etapas de diseño como salvaguarda

Se declara explícitamente que la corrección de D-M1 (y del resto del bloque de contención: D-E4, D-E5, D-F4, D-F2) requiere tocar el motor conversacional, y se ejecuta como un entregable con las cinco etapas (definición funcional → casos de uso → arquitectura técnica → modelo de persistencia → esquema físico), igual que cualquier entregable de Fase 2, más una Validación Técnica con grep exhaustivo de que ningún otro comportamiento del motor cambió. El principio "intocable" se reinterpreta explícitamente como "no se reescribe sin diseño formal", no como "nunca se edita".

### Opción B — Envolver sin tocar, siguiendo el patrón del Adaptador (Entregable 3.4)

En vez de editar `openai.service.js` directamente, construir una capa nueva (p. ej. `conversation-context.service.js`) que arme el historial y lo inyecte, y modificar `openai.service.js` en el punto mínimo posible (una línea que reciba `history` en vez de reconstruirlo). El motor legado se toca lo mínimo indispensable; la lógica nueva vive fuera.

### Opción C — Diferir de nuevo, igual que 4.3 Alcance B

Registrar D-M1 como deuda diferida explícita y no tocar el motor. Preserva el principio sin excepciones, pero dado que D-M1 es —según la propia evidencia— el techo permanente de calidad conversacional del producto, diferir indefinidamente tiene costo real y creciente a medida que el volumen de clientes reales crece.

## Recomendación fundamentada: Opción A, ejecutada con la disciplina de Opción B

1. El precedente de 4.3 Alcance B difirió porque el trabajo exigía **lógica de negocio nueva** (horarios por tenant). D-M1 no la exige — exige leer una tabla que ya existe. Diferirlo de nuevo (Opción C) no protege nada que valga la pena proteger; solo pospone la mayor ganancia de calidad del plan completo.
2. Editar sin diseño (saltarse la Opción A) repetiría exactamente el error que el ADR 006 corrigió en la Fase 2: implementar antes de congelar el diseño.
3. La ejecución debe minimizar la superficie tocada: un `context-builder.service.js` nuevo (inspirado en el patrón, no en el código, de `context_builder.py` de Sancho — función pura, sin acceso a BD, presupuesto de caracteres determinista) que se inyecta en `openai.service.js` en el punto mínimo, en vez de reescribir el archivo. Esto es Opción A y B combinadas, no una tercera alternativa.

**Orden propuesto si se acepta (no se ejecuta con este ADR):**
1. Aceptación explícita del responsable del proyecto sobre esta reconciliación.
2. Entregable formal — nombre y numeración a definir (posible Fase 8, o entregable puente previo a declarar una fase nueva) — cubriendo el bloque completo de "Contención" del informe externo (D-E5, D-E4, D-F4, D-F2) más D-M1, con sus cinco etapas.
3. Validación Técnica con grep exhaustivo confirmando que ningún flujo del motor cambió su comportamiento observable salvo lo diseñado.
4. Cierre con `ENTREGABLE_<x>_COMPLETION_REPORT.md`, nota de reconciliación en `CLAUDE.md` y bump de versión.

## Qué NO decide este ADR

- No implementa ninguna corrección todavía.
- No define el nombre ni número de la fase/entregable que ejecutará el trabajo — eso se decide junto con la aceptación de una opción.
- No incluye las Fases 2 y 3 del plan de remediación del informe externo (locks, cola durable, FSM) — quedan fuera de este ADR, a evaluar por separado una vez resuelto este bloque.
- No adopta código de Sancho — solo su patrón de diseño, reescrito en Node/Prisma.
