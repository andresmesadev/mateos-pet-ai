# Operación

## Procedimientos actuales

- [Arranque limpio solo dashboard](DASHBOARD_ONLY_CLEAN_START_20261016.md): base nueva activa sin historial de pruebas, archivo anterior en solo lectura, WhatsApp pospuesto y revisión de servicios/personal.

- [Base local de desarrollo](LOCAL_DEVELOPMENT_DATABASE.md): PostgreSQL local, destino de conexión y datos ficticios.
- [Respaldo y restauración](DATABASE_BACKUP_AND_RESTORE.md): respaldo cifrado, verificación de integridad y recuperación.
- [Aplicación de la revisión de viabilidad](VIABILITY_IMPROVEMENT_EXECUTION_20261009.md): copia independiente y observación de estabilidad; implementación y ejecución se registran por separado.
- [Piloto interno](INTERNAL_PILOT_RUNBOOK.md): responsables, aceptación del frontend, incidentes y medición de uso y costes.
- [Preparación aplicada a la veterinaria propia](OWN_CLINIC_BETA_APPLICATION_20261016.md): empleados registrados, observación persistente iniciada y pendientes de apertura.
- [Acta y listas de jornada](OWN_CLINIC_STARTUP_WORKSHEET.md): decisiones, carga inicial, aceptación y conciliación para completar privadamente.
- [Observación persistente de salud](PERSISTENT_STABILITY_OBSERVATION.md): captura finita de 48 horas en la VPS, seguimiento y límites.
- Despliegue: ejecutar el procedimiento del repositorio en `scripts/deploy.sh` y comprobar la versión declarada, migraciones, respaldo y salud. Los informes de releases documentan lo que se ejecutó, sin autorizar otro despliegue.

## Controles que siguen abiertos

- [Beta operativa en la veterinaria propia — revisión del 16 de octubre](OWN_CLINIC_BETA_REVIEW_20261016.md): foco indicado por el responsable, puesta en marcha real, observación incompleta y separación entre dashboard, WhatsApp y comercialización.

- [Preparación de beta cerrada](CLOSED_BETA_READINESS_PLAN_20260919.md): evaluación fechada, con pendientes reales de observación/piloto. Sus cifras y versión inicial no describen automáticamente la instalación actual.
- [Matriz de agenda](CLOSED_BETA_AGENDA_MATRIX_20260926.md): casos reales del canal WhatsApp. No sustituir los casos pendientes por pruebas locales de otros canales.

## Antecedentes

El cambio de Neon a PostgreSQL y el procedimiento de cola 2.36.1 se archivaron en [operaciones históricas](../history/operations/README.md). Para la última publicación comprobada y los cambios locales, consultar [estado actual](../ESTADO_ACTUAL.md).
