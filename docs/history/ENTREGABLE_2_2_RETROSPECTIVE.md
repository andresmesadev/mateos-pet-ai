# Retrospectiva — Entregable 2.2 (Sistema Operativo de Staff)

**Fecha:** 2026-07-01
**Propósito:** capturar qué funcionó del proceso de ingeniería en su segunda aplicación completa — no una revisión de código.

---

## ¿Qué funcionó especialmente bien?

**Verificar el código real antes de diseñar una decisión, en lugar de asumirlo.** El ADR 003 partía de la sospecha de que `availability-db.service.js` (311 líneas) estaba involucrado en la disponibilidad del staff. Revisar el código antes de escribir el ADR mostró que no era así: el campo `Staff.availability` se usaba en exactamente dos lugares, con una forma mucho más simple de lo anticipado. El ADR resultante fue más acotado, más seguro y más fácil de implementar que el que se habría escrito sobre una suposición.

**La migración aditiva resultó categóricamente más segura que la de reemplazo.** En 2.1, eliminar `Service.category` rompió silenciosamente siete archivos de Fase 1. En 2.2, agregar `generatesCommission` con `@default(true)` no rompió ninguno. La diferencia no fue suerte: fue una elección deliberada de diseño (columna aditiva con valor por defecto razonable, en vez de modificar el significado de un campo existente) que vale la pena mantener como criterio por defecto cuando el dominio lo permite.

**El error de invocación durante la migración (ejecutar el script de 2.1 por accidente) se autocontuvo.** La transacción explícita `BEGIN`/`COMMIT` dentro del propio archivo SQL hizo que el error de "tabla ya existe" abortara limpiamente, sin dejar cambios a medias. Esto confirma que envolver cada migración en una transacción explícita no es una formalidad — es la razón por la que un error de operador no se convirtió en un incidente.

---

## ¿Qué decisiones del proceso demostraron aportar valor?

**Tratar las tres desviaciones de la Validación Funcional según su naturaleza real, no de forma uniforme.** Dos eran inconsistencias de documentación entre etapas del mismo entregable (corregibles con texto), una era un ADR genuino (una dependencia nueva entre contextos), y una era un defecto de implementación real. Resolver cada una con la herramienta correcta —en vez de, por ejemplo, escribir un ADR para las tres "por consistencia"— evitó tanto la sobre-formalización como la corrección silenciosa.

**Auditar la consistencia interna del propio entregable, no solo contrato-contra-código.** Dos de las tres desviaciones de este entregable no eran discrepancias entre el contrato y la implementación: eran discrepancias entre la Arquitectura Técnica (Etapa 3) y el Esquema Físico (Etapa 5), ambas ya aprobadas, del mismo entregable. La Validación Funcional las encontró porque comparó la implementación contra *todos* los documentos aprobados, no solo contra el contrato funcional. Sin esa comparación cruzada, ambas habrían quedado sin detectar indefinidamente.

---

## ¿Qué podríamos simplificar o mejorar sin perder calidad?

**Verificar la consistencia entre Arquitectura Técnica y Esquema Físico debería ocurrir al cierre de la Etapa 5, no esperar a la Validación Funcional.** En este entregable, el Esquema Físico prometió "doble protección completa, mismo patrón que `PriceRule`" para `StaffCapability`, pero la Arquitectura Técnica (etapa anterior) nunca había anticipado el error de dominio que esa promesa implicaba. Sería razonable agregar, al cierre de la Etapa 5, una verificación explícita: "¿todo lo que el Esquema Físico promete ya está reflejado en la lista de errores de la Arquitectura Técnica?" Esto habría detectado la inconsistencia dos etapas antes.

**El patrón de "verificar el código real antes de decidir" debería ser un paso explícito de cualquier ADR que involucre código de Fase 1, no una buena práctica implícita.** Funcionó bien en el ADR 003 porque se hizo deliberadamente; vale la pena que la Regla de Ejecución lo mencione como parte de la etapa de Casos de Uso o Arquitectura Técnica cuando un entregable toca una entidad que ya existe físicamente.

**Ningún documento de los generados resultó innecesario.** Igual que en la retrospectiva de 2.1, no se identifica ningún documento que se pueda eliminar sin perder información que después se usó — incluyendo los dos ADRs, que en ambos casos cambiaron el resultado final de forma real, no cosmética.

---

## ¿Qué aprendizajes deja este segundo contexto construido bajo la nueva arquitectura?

**El patrón ya no se diseña: se aplica, y eso libera atención para lo que sí es nuevo.** La clasificación por responsabilidad, los Principios Permanentes, la doble protección de invariantes, la estructura de carpetas — ninguno de esos se discutió en este entregable; se heredaron directamente de 2.1. Eso dejó la atención disponible para lo genuinamente nuevo de este contexto: reutilizar entidades de Fase 1 en vez de partir de cero, y decidir con cuidado qué pertenece al agregado `Staff` y qué queda fuera de él a propósito (`Commission`, `Settlement`).

**Reutilizar una entidad existente exige más disciplina que crear una nueva, no menos.** Crear `ServiceCategory` o `StaffAvailability` desde cero permite diseñar su forma libremente. Reutilizar `Staff` y `Commission` exigió primero entender exactamente qué código ya dependía de su forma actual, antes de tocar nada — el mismo nivel de rigor que crear algo nuevo, aplicado en la dirección contraria.

**El proceso sigue pagando su costo inicial.** Segunda vez de principio a fin, segunda vez sin sorpresas que obligaran a romper el diseño congelado durante la implementación. Las únicas desviaciones encontradas se manejaron exactamente como el proceso prevé: con análisis explícito, no con corrección silenciosa.

---

*Retrospectiva del Entregable 2.2 · Plataforma Operativa Inteligente · Mateos Pet*
