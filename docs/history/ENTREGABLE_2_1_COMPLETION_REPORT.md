# Cierre del Entregable 2.1 — Sistema Operativo de Servicios

**Fecha de cierre:** 2026-07-01
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Estado:** ✅ Completado
**Proceso aplicado:** `docs/PHASE_2_EXECUTION_RULE.md` (las ocho etapas, completas)
**Gate Review previo:** `docs/history/ENTREGABLE_2_1_GATE_REVIEW.md`

---

## Qué problema resolvía este entregable

Al cierre de la Fase 1, el dominio del negocio era soberano en sus reglas de precio y comisión, pero el catálogo de servicios seguía siendo una tabla plana: un campo `category` de texto libre, sin reglas administrables, sin jerarquía de precio más allá de un acuerdo por mascota, y sin ningún caso de uso propio que coordinara su gestión. Cualquier canal que quisiera crear, modificar o consultar un servicio tenía que tocar la base de datos directamente — exactamente el problema que la Fase 2 se propuso resolver: "los canales orquestan más de lo que deberían".

El Entregable 2.1 fue, además, la primera prueba real de un proceso de construcción explícito (la Regla de Ejecución de la Fase 2): diseñar antes de programar, congelar antes de implementar, auditar antes de cerrar.

---

## Qué capacidades incorpora ahora la Plataforma Operativa Inteligente

- **Un catálogo de servicios administrable** mediante tres casos de uso de Administración (Crear, Actualizar, Desactivar Servicio), con reglas de validación propias y sin dependencia de ningún canal.
- **Una jerarquía de precio completa y extensible**: mascota acordada > cliente acordado > raza/tamaño > precio base del catálogo — implementada como una función de dominio pura (`price-resolution.rules.js`) que crece agregando fuentes, no reescribiéndose.
- **Una única vía autorizada para cambiar precio** (`Cambiar Precio`), separada deliberadamente de la edición de atributos descriptivos, con un invariante crítico protegido en dos niveles: validación de aplicación y un índice único parcial en base de datos.
- **Una consulta de catálogo que respeta los módulos activos del establecimiento** — un servicio cuya categoría deja de estar habilitada deja de aparecer como disponible, sin necesidad de desactivarlo manualmente.
- **Tres entidades nuevas del dominio persistidas**: `ServiceCategory` y `PriceRule` (nuevas), y `Service` migrado de un campo de texto libre a una relación real con su categoría.

Concretamente, esto elimina trabajo humano que antes era manual o inexistente: ya no hace falta tocar la base de datos para administrar el catálogo, y el precio acordado por raza o por cliente —que antes no tenía dónde vivir— ahora tiene un lugar único y auditable.

---

## Qué decisiones arquitectónicas importantes quedaron establecidas

Este entregable no solo construyó código: dejó establecidos varios estándares que rigen el resto de la Fase 2 y, potencialmente, toda la plataforma.

- **Clasificación de casos de uso por responsabilidad** (Administración, Operación, Resolución, Consulta) — criterio de diseño permanente para 2.2 y 2.3.
- **Cuatro Principios Permanentes de la arquitectura de aplicación**, entre ellos: los contextos se comunican por eventos de dominio, nunca por llamadas directas; los contratos de los casos de uso son estables y los adaptadores se adaptan a ellos, no al revés.
- **Tres Principios Permanentes del modelo de persistencia**: el esquema representa al dominio pero nunca lo sustituye; el Aggregate Root es el único responsable de la consistencia de sus entidades internas; el modelo evoluciona por extensión, nunca por ruptura.
- **Un Principio Permanente del esquema físico**: todo invariante crítico del dominio se protege en dos niveles — aplicación y base de datos — nunca en uno solo.
- **ADR 001** — formalizó el congelamiento del diseño como punto de no retorno antes de implementar.
- **ADR 002** — formalizó que un caso de uso de Resolución puede consultar otro contexto a través de un puerto mínimo de lectura de atributos, sin conocer su modelo interno, cuando el propio dominio lo exige (la jerarquía de precio por raza no podía resolverse de otra forma).

---

## Qué aprendimos durante su construcción

**El contrato funcional, por más cuidadoso que sea, no siempre anticipa todo lo que la implementación necesita.** La auditoría funcional posterior a la implementación encontró dos desviaciones reales entre lo aprobado y lo construido — no errores de código, sino brechas de diseño. Tratarlas con disciplina (una mediante ADR, porque era una decisión arquitectónica legítima; la otra mediante corrección directa, porque el contrato ya la exigía con claridad) demostró que el proceso de la Fase 2 no es burocracia: es lo que permite distinguir entre "esto necesita una decisión" y "esto es simplemente un error".

**Una migración de esquema nunca es local.** Cambiar `Service.category` de texto a relación rompió, en silencio, cinco archivos de código de Fase 1 que nadie había tocado en este entregable — incluyendo lógica financiera sensible (clasificación de comisiones en el cierre del día). Esto confirma por qué el Plan Maestro insiste en que el dominio es soberano: cuando el dominio cambia, todo lo que dependía de su forma física debe revisarse explícitamente, no asumirse intacto.

**La disciplina de diseño-antes-de-código no ralentizó la implementación; la hizo predecible.** Una vez aprobadas las cinco etapas, escribir el código fue mecánico: cada archivo tenía un lugar ya decidido, cada error de dominio ya tenía nombre, cada evento ya tenía un consumidor previsto.

---

## Qué habilita para el Entregable 2.2

El Entregable 2.2 (Staff como Sistema Operativo) depende explícitamente de este entregable: necesita `ServiceCategory` para aplicar la regla de comisión correcta a cada servicio prestado. Esa entidad ya existe, persistida y administrable.

Más allá de la dependencia de datos, el Entregable 2.1 deja un patrón replicable: la clasificación por responsabilidad, los Principios Permanentes de aplicación y de persistencia, la doble protección de invariantes críticos, y el propio proceso de las ocho etapas — todo eso ya no se diseña de nuevo para 2.2. Se aplica.

---

*Cierre del Entregable 2.1 · Plataforma Operativa Inteligente · Mateos Pet*
