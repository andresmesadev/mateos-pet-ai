# Historia longitudinal y correcciones de consultas

Fecha: 2026-09-30. Alcance autorizado: mantenimiento de Consultas veterinarias; no redefine una fase cerrada ni incorpora prescripciones o nuevos canales.

## 1. Definición funcional
Consultar el expediente completo sin salir de la atención. Corregir una consulta conservando el contenido anterior y dejando constancia de quién, cuándo y por qué.

## 2. Casos de uso
- Veterinario y administrador leen todos los registros de la mascota en su establecimiento, por fecha, con filtros y detalle completo.
- El veterinario modifica únicamente consultas asignadas a su identidad; el administrador conserva su acceso existente.
- Una modificación de una consulta finalizada exige motivo. Todo cambio a un registro de consulta existente conserva ambas versiones. Guardar sin cambios no genera una corrección.
- La versión enviada por el editor debe coincidir con la vigente. Un conflicto devuelve 409 sin sobrescribir contenido.
- Los endpoints genéricos de edición y eliminación no pueden saltarse la trazabilidad de registros vinculados a citas.

## 3. Arquitectura técnica
Reutilizar GET de registros por mascota y su aislamiento. Un servicio de guardado coordina registro y revisión en la misma transacción. La identidad proviene exclusivamente del actor autenticado. GET de revisiones verifica mascota, registro y tenant antes de leer. No existen endpoints de edición o eliminación de revisiones.

Decisiones diferidas: firma clínica, auditoría retroactiva, notas rectificatorias para registros independientes sin cita, paginación de servidor del expediente. No afirmar que una revisión es una firma legal ni inferir autor individual en registros antiguos.

## 4. Persistencia
`MedicalRecord.version` inicia en 1. `MedicalRecordRevision` guarda recordId, versión reemplazada, before/after JSON con los campos clínicos, motivo, actorType/actorStaffId/actorName/actorEmail y fecha. La identidad se copia para conservarla aunque cambie la ficha del profesional. Las revisiones no se modifican. La FK impide eliminar un registro que tiene revisiones.

## 5. Esquema físico
Migración aditiva: versión, tabla de revisiones, unicidad (recordId, version), índice (recordId, createdAt), FK restrictiva. El guardado usa actualización condicional por versión y una transacción serializable; los conflictos no dejan revisiones huérfanas. Migración local y prisma generate antes de verificar. La VPS requiere desplegar esta migración junto al código.

## Validación local
- `prisma migrate deploy`: migración 20260930173000 aplicada en mateos_dev (127.0.0.1:5433); `prisma generate` correcto; `prisma migrate status`: 38 migraciones, esquema actualizado.
- Backend: `npm test -- --maxWorkers=1 --workerIdleMemoryLimit=256MB --silent`: 147 suites y 1117 pruebas aprobadas. Cubre motivos, versiones desactualizadas, colisiones de guardado, permisos, pertenencia al tenant y bloqueo de edición/eliminación genéricas.
- `node scripts/verify-clinical-revisions-local.js`: creación real de revisión, contenido anterior/nuevo y reversión atómica verificados en PostgreSQL; los datos originales permanecen intactos.
- Frontend: lint y compilación aprobados. En navegador: filtros de historia, carga de revisiones y motivo obligatorio para consulta finalizada comprobados sin modificar una historia existente.
- Las correcciones no se editan ni se eliminan desde la API. Eliminar un propietario con consultas vinculadas también se bloquea para conservar el expediente.
- No se ejecutó despliegue en la VPS ni se reconstruyeron correcciones históricas.
