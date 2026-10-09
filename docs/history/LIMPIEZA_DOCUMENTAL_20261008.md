# Limpieza documental — 8 de octubre de 2026

## Alcance

Solicitud: revisar exhaustivamente `docs`, identificar material que ya no corresponde al uso actual y limpiar su organización antes de publicar las mejoras del dashboard.

Se inventariaron **los 257 archivos preexistentes**, incluidos cambios locales pendientes de commit. La revisión combinó lectura automatizada de contenido y metadatos, hashes, referencias desde el repositorio, clasificación de todos los archivos y revisión dirigida de estados, procedimientos, aprobaciones y evidencia posterior. No se afirma haber recertificado cada regla del producto ni cada afirmación de los informes antiguos mediante una nueva prueba funcional.

## Cambios aplicados

| Tratamiento | Cantidad | Motivo |
| --- | --- | --- |
| Propuestas concluidas → `history/designs/` | 15 | Ya tienen evidencia de implementación; sus diagnósticos no deben parecer trabajo pendiente. Cada archivo enlaza su resultado. |
| Procedimientos concretos → `history/operations/` | 2 | Migración de Neon y preparación de cola 2.36.1; no son instrucciones actuales de arranque. |
| Diagramas → `history/diagrams/` | 4 | Dos parejas HTML/JSON del commit `a05410981f14b99b73601507e8d2df437144f1fe`. Se conservaron sus cuatro hashes originales. |
| Auditoría general de septiembre → `audits/` | 1 | Hallazgos fechados del backend 2.36.0, fuera de las guías principales. |
| Conservados en su ubicación | 235 | Fuentes rectoras, contratos aprobados, ADR, evidencia, guías operativas y pendientes reales. |
| Eliminados | **0** | No se encontraron duplicados exactos ni se demostró que las aprobaciones o la evidencia histórica carezcan de valor. |

También se corrigieron **16 enlaces absolutos de la estación de trabajo** a rutas relativas portables. Se actualizaron las referencias afectadas por los movimientos, dentro y fuera de `docs`.

## Estados reconciliados

- Las cinco etapas de excepciones de Agenda ahora distinguen diseño original e implementación, enlazando su cierre técnico.
- El Plan Maestro distingue roadmap completado de cierre formal de Fase 8; no se declara una fase nueva ni se inventa un cierre.
- Inventario deja de figurar únicamente como implementación local: se enlazan las publicaciones 2.42.0 y 2.43.0 documentadas.
- La conclusión del Plan Maestro utiliza los resultados de fases ya construidas, conservando su estrategia.
- La sección histórica de Fase 5 en `AGENTS.md` y `CLAUDE.md` deja de titularse “En curso”.
- Se documenta que existen dos ADR 011 y se exige identificarlos por título y enlace exacto. No se renumeran referencias históricas.
- El texto operativo del ADR de disponibilidad del equipo utiliza “hora de Colombia”, conservando `America/Bogota` como identificador técnico.

## Entradas y catálogo

- [Índice principal](../README.md) y [estado actual](../ESTADO_ACTUAL.md).
- Índices de Arquitectura, casos de uso, diseños técnicos, ADR, Operación, Historial, Auditorías y plantillas legales.
- [Catálogo de los 257 archivos originales](../CATALOGO_DOCUMENTAL.md), con clasificación y tratamiento por archivo.
- [Inventario JSON](../documentation-inventory.json): ubicación original/actual, categoría, resultado, tamaño y hashes antes/después.
- `scripts/check-docs.cjs`: validador de enlaces locales, rutas literales a documentos, portabilidad, integridad de ubicaciones del catálogo y duplicados exactos.
- `scripts/check-docs.test.cjs`: seis pruebas del analizador de enlaces y resolución de destinos.

## Conservaciones deliberadas

Los documentos de diseño técnico y casos de uso conservan contratos y aprobaciones. El SQL de diseño de Inventario sigue siendo leído por `scripts/validate-inventory-schema-draft.cjs`; no se elimina ni se mueve. Tampoco se sustituyen el schema ni las migraciones actuales por los borradores históricos.

Las capturas y resultados anteriores conservan su fecha y alcance. Menciones a Neon, horarios, versiones o pendientes dentro de antecedentes no se borran para aparentar que siempre se usó la arquitectura actual.

## Pendientes reales

La limpieza no cierra la observación y los casos de beta externa, no certifica un envío real de reactivación sin plantilla aprobada y no completa los marcadores legales con datos supuestos. Los detalles están centralizados en [estado actual](../ESTADO_ACTUAL.md). Las mejoras locales del dashboard siguen pendientes de commit, push y despliegue.

## Validación

Salida de `node scripts/check-docs.cjs`:

```json
{
  "documents": 273,
  "markdownFiles": 258,
  "checkedLinks": 641,
  "broken": [],
  "missingDocReferences": [],
  "nonPortableLocalLinks": [],
  "cataloguedOriginalFiles": 257,
  "catalogueErrors": [],
  "exactDuplicates": []
}
```

Salida de `node --test --test-reporter=tap scripts/check-docs.test.cjs`:

```text
# tests 6
# pass 6
# fail 0
```

`node --check` de ambos scripts: salida 0. ESLint del frontend: salida 0, sin mensajes. La revisión del diff encontró espacios al final de cinco líneas de estado; se corrigieron y se volvió a comprobar. `git diff --check`, con la configuración de finales de línea del repositorio, terminó con salida 0 y sin errores de formato. La verificación de los hashes del catálogo conserva los cuatro diagramas idénticos y localiza los 257 originales.

La comprobación no contacta producción ni envía mensajes; no modifica datos del aplicativo. El validador cubre destinos de archivos locales y referencias literales, no disponibilidad de sitios externos ni anclas internas. No se repitieron las pruebas funcionales del dashboard por una reorganización documental; su evidencia anterior permanece en el informe correspondiente.

## Versionado y publicación

Esta tarea modifica documentación y herramientas de verificación documental; no introduce capacidades de negocio, schema, migraciones ni una nueva publicación. No requiere bump propio. El backend conserva `2.44.0`; el versionado de las mejoras funcionales locales se evaluará al preparar su publicación.
