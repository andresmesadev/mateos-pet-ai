# Agrupación y limpieza del catálogo — 2026-10-06

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../ADMINISTRACION_SERVICIOS_GRUPOS_ELIMINACION_20261006.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Petición explícita: agrupar Peluquería/Veterinaria y permitir borrar definitivamente después de retirar. Refinamiento del catálogo existente; no se abre un entregable de la Fase 2 cerrada ni se modifica su comando de desactivación.

## Contrato y diseño

- Administración ve grupos Peluquería, Veterinaria y Otros servicios, conservando búsqueda, categoría y estado.
- Retirar sigue siendo reversible. Eliminar definitivamente es otro comando, exclusivo de administración, con establecimiento autenticado y confirmación del nombre actual.
- Solo se elimina un servicio inactivo sin citas (de cualquier estado), reglas de precio (incluso inactivas) ni capacidades de personal (incluso revocadas). No hay eliminación en cascada ni borrado de eventos de auditoría.
- Esta excepción solicitada modifica la regla histórica de conservar todo servicio: la conservación sigue siendo obligatoria cuando existen referencias. Citas, historia, comisiones y precios anteriores permanecen intactos.
- Adaptador HTTP → caso de uso Servicios → puerto de eliminación atómica. La persistencia comprueba referencias sin acoplar casos de uso de otros contextos.
- PostgreSQL bloquea la fila del servicio mientras comprueba y elimina. La creación de StaffCapability, que carece de FK deliberadamente, toma un bloqueo compartido y revalida su existencia en la misma transacción para evitar referencias huérfanas concurrentes. Las FK existentes protegen citas y precios.
- TransactionItem conserva descripción/precio como instantáneas y no referencia Service; no se modifica. Los eventos existentes conservan su carga original.
- Esquema físico sin cambios; no requiere migración ni regeneración de Prisma.

## Decisiones diferidas

No se permite borrar servicios utilizados ni purgar tarifas, personal, citas o auditoría. No se introduce un evento nuevo en el catálogo de eventos cerrado.

## Validación

Pruebas con establecimientos temporales: activo rechazado, nombre incorrecto rechazado, referencias protegidas, aislamiento entre establecimientos, eliminación física de servicio retirado sin referencias y comprobación de UI/lint/build.
