# Operación

## Procedimientos actuales

- [Base local de desarrollo](LOCAL_DEVELOPMENT_DATABASE.md): PostgreSQL local, destino de conexión y datos ficticios.
- [Respaldo y restauración](DATABASE_BACKUP_AND_RESTORE.md): respaldo cifrado, verificación de integridad y recuperación.
- Despliegue: ejecutar el procedimiento del repositorio en `scripts/deploy.sh` y comprobar la versión declarada, migraciones, respaldo y salud. Los informes de releases documentan lo que se ejecutó, sin autorizar otro despliegue.

## Controles que siguen abiertos

- [Preparación de beta cerrada](CLOSED_BETA_READINESS_PLAN_20260919.md): evaluación fechada, con pendientes reales de observación/piloto. Sus cifras y versión inicial no describen automáticamente la instalación actual.
- [Matriz de agenda](CLOSED_BETA_AGENDA_MATRIX_20260926.md): casos reales del canal WhatsApp. No sustituir los casos pendientes por pruebas locales de otros canales.

## Antecedentes

El cambio de Neon a PostgreSQL y el procedimiento de cola 2.36.1 se archivaron en [operaciones históricas](../history/operations/README.md). Para la última publicación comprobada y los cambios locales, consultar [estado actual](../ESTADO_ACTUAL.md).
