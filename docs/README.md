# Documentación de Mateos Pet AI

Entrada de consulta. Revisión documental: 8 de octubre de 2026.

## Por dónde empezar

| Necesidad | Documento |
| --- | --- |
| Qué está publicado, qué está comprobado localmente y qué sigue pendiente | [Estado actual](ESTADO_ACTUAL.md) |
| Visión, principios y roadmap | [Plan Maestro](PLAN_MAESTRO.md) |
| Entidades, responsabilidades y unidad de aislamiento | [Modelo de dominio](architecture/domain-model-v1.md) |
| Proceso de diseño y aprobación | [Regla de ejecución](PHASE_2_EXECUTION_RULE.md) |
| Contratos y arquitectura aprobados | [Arquitectura](architecture/README.md) |
| Por qué se adoptó cada decisión | [Decisiones arquitectónicas](decisions/README.md) |
| Arranque local, respaldos y pruebas de beta | [Operación](operations/README.md) |
| Evidencia de implementación, pruebas y publicaciones | [Historial](history/README.md) |
| Auditorías de un momento concreto | [Auditorías](audits/README.md) |
| Plantillas legales y su estado | [Documentos legales](legal/README.md) |
| Inventario completo y clasificación de archivos | [Catálogo documental](CATALOGO_DOCUMENTAL.md) |

## Qué significa cada ubicación

- `architecture/`: modelo y contratos de diseño aprobados. Algunas especificaciones conservan su fecha de aprobación; las ampliaciones posteriores se consultan en sus ADR e informes.
- `decisions/`: decisiones identificadas por título, fecha y archivo.
- `operations/`: procedimientos de uso actual y controles de beta que aún tienen comprobaciones pendientes.
- `history/`: hechos y evidencia fechados. Un “pendiente” dentro de un informe antiguo describe su fecha, salvo actualización explícita.
- `history/designs/`: propuestas concluidas, con enlace a su implementación.
- `history/operations/`: procedimientos de migraciones o versiones anteriores.
- `history/diagrams/`: representaciones de un commit concreto, sin garantía de inventariar el código actual.
- `audits/`: hallazgos con fecha y alcance; no son una lista automática de tareas abiertas.

## Mantenimiento

Antes de crear otro documento, buscar una fuente existente para el mismo propósito. Actualizar una guía cuando cambie su procedimiento; conservar en el historial las pruebas y aprobaciones anteriores. Una capacidad implementada localmente no se anuncia como publicada sin evidencia de despliegue.

Después de mover o enlazar documentos, ejecutar desde la raíz:

```bash
node scripts/check-docs.cjs
node --test scripts/check-docs.test.cjs
git diff --check
```

El comprobador valida destinos de enlaces Markdown locales y rutas literales a documentos en archivos del repositorio, e identifica duplicados exactos. No comprueba páginas externas, anclas internas ni la vigencia semántica de cada afirmación; esa parte requiere revisión contra código, ADR y evidencia.
