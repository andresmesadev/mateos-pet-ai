# Retrospectiva — Entregable 2.1 (Sistema Operativo de Servicios)

**Fecha:** 2026-07-01
**Propósito:** capturar qué funcionó del proceso de ingeniería de la Regla de Ejecución de la Fase 2, aplicado por primera vez de principio a fin — no una revisión de código.

---

## ¿Qué funcionó especialmente bien?

**Separar diseño de implementación dejó el código sin ambigüedad para escribir.** Cuando llegó el momento de programar, no hubo ninguna decisión de negocio pendiente por resolver en el camino — solo traducción. Eso se notó en la velocidad: la capa de dominio, aplicación e infraestructura completa se escribió en una sola sesión, sin retrocesos de diseño.

**El congelamiento del diseño (ADR 001) funcionó como punto de no retorno real, no simbólico.** Al implementar, cualquier tentación de "mejorar algo sobre la marcha" tenía un costo explícito: requería un ADR. Eso evitó la deriva silenciosa entre lo aprobado y lo construido — y cuando esa deriva ocurrió de todos modos (ver más abajo), el proceso la detectó en vez de dejarla pasar.

**La auditoría funcional posterior a la implementación encontró algo real.** No fue un trámite: detectó dos desviaciones genuinas entre el contrato aprobado y el comportamiento implementado (la consulta a Mascotas en Resolver Precio del Servicio, y el filtro de módulos faltante en Consultar Servicios Disponibles). Sin esa etapa, ambas habrían quedado como deuda invisible.

---

## ¿Qué decisiones del proceso demostraron aportar valor?

**Distinguir "esto requiere un ADR" de "esto es simplemente un error" evitó dos respuestas erróneas: sobre-formalizar correcciones triviales, y corregir en silencio decisiones que sí merecían quedar registradas.** Las dos desviaciones encontradas en la auditoría tenían naturaleza distinta, y tratarlas distinto fue lo correcto — una se resolvió con un ADR, la otra con una corrección directa porque el contrato ya era inequívoco.

**Pedir confirmación explícita antes de tocar la base de datos real evitó operar a ciegas sobre datos de producción.** No existe una base de desarrollo separada en este proyecto; el proceso de validación técnica incorporó un respaldo previo y una migración con verificación anti-huérfanos antes de aplicar el cambio irreversible. Eso no estaba en la Regla de Ejecución original, y debería estarlo.

**La migración expuso una regresión real en código de Fase 1 que nadie había tocado en este entregable.** Encontrarla durante la Validación Técnica —no después, en producción— confirmó que revisar el impacto de un cambio de esquema más allá del contexto que se está construyendo es necesario, no opcional.

---

## ¿Qué podríamos simplificar o mejorar sin perder calidad?

**Los puertos mínimos de lectura entre contextos (verificación de existencia, lectura de atributos) deberían anticiparse en la etapa de Arquitectura Técnica, no descubrirse durante la implementación.** En este entregable aparecieron dos veces como necesidad no prevista en el contrato funcional original (`TargetExistenceReaderPort` para Clientes/Mascotas). Vale la pena, en 2.2, preguntar explícitamente durante el diseño de casos de uso: "¿este caso de uso necesita leer un atributo de otro contexto para cumplir su propia regla de negocio?" — antes de llegar a la auditoría funcional.

**El esquema físico documentado en prosa (sin bloques Prisma) habría sido más difícil de validar que el que terminamos escribiendo con código Prisma real dentro del documento.** Mantener el código del esquema propuesto directamente en el documento de diseño, antes de aplicarlo, resultó más verificable que describirlo solo conceptualmente. Vale la pena mantener esa práctica, no simplificarla.

**El número de documentos por entregable (contrato, arquitectura, persistencia, esquema físico, ADRs, gate review, cierre, retrospectiva) es alto pero ninguno resultó redundante en este entregable.** No se identifica ningún documento de los generados que se pueda eliminar sin perder información que después se usó. Si algo se simplifica, debería ser la verbosidad dentro de cada uno, no la cantidad de etapas.

---

## ¿Qué aprendizajes deja este primer contexto construido bajo la nueva arquitectura?

**Un contrato funcional aprobado es una hipótesis fuerte, no una garantía.** Por más disciplina que tenga el diseño, la implementación es el primer momento en que la hipótesis se pone a prueba contra la realidad del dominio (en este caso, contra cómo está modelada hoy la mascota y sus atributos). El proceso no falló porque apareciera una desviación — falló si esa desviación hubiera pasado desapercibida.

**El dominio nuevo y el código legado conviven, y esa convivencia tiene costo real, no solo conceptual.** Construir `contexts/services/` con disciplina total no protegió automáticamente al resto del sistema; protegerlo requirió revisar explícitamente quién más dependía de lo que se estaba cambiando.

**El patrón ya es replicable.** La clasificación por responsabilidad, los Principios Permanentes de aplicación y de persistencia, y la estructura de carpetas no se van a rediseñar para el Entregable 2.2 — se van a aplicar. Eso es la señal más clara de que el proceso, aunque costoso la primera vez, ya pagó su inversión.

---

*Retrospectiva del Entregable 2.1 · Plataforma Operativa Inteligente · Mateos Pet*
