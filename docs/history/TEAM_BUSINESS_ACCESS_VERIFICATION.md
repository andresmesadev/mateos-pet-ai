# Integración de perfiles y módulos — verificación local

Solicitud aprobada: integrar los perfiles y permisos propuestos para las combinaciones de Veterinaria, Peluquería y Pet shop. Implementación y pruebas: 2026-10-01; cierre documental local: 2026-10-02. Versión del backend: `2.41.0`.

## Resultado funcional

- Administración → Áreas del negocio: selección de los tres módulos; siete combinaciones no vacías. Caja permite cobros de servicios sin Pet shop; las nuevas ventas de productos requieren retail.
- Administración → Gestión de usuarios: Administrador, Recepción y caja, Veterinario/a y Peluquero/a. Habilitaciones cerradas de Caja operativa y ajuste de precio de cita abierta.
- Recepción tiene Caja por defecto, datos básicos de clientes/mascotas y Agenda; no accede a historias clínicas, comisiones, egresos, cierre ni informes administrativos.
- Veterinarios y peluqueros operan su área y escriben sus propias atenciones. Una atención sin profesional puede ser tomada por quien la inicia. El administrador conserva gestión y atención con la misma identidad; puede figurar como responsable y autor de una consulta.
- Inicio, navegación, Caja y formularios reflejan permisos efectivos del servidor. La revocación se aplica en la siguiente petición. Los endpoints también verifican módulos, propiedad y Tenant.
- Alertas operativas compartidas se almacenan aparte de notas clínicas históricas. Los nuevos cobros y ajustes guardan la identidad autenticada; no se atribuyen autores a datos históricos desconocidos.
- Desactivar un área conserva antecedentes administrativos y bloquea nuevas operaciones. La reprogramación conserva el recorrido existente de cancelación y nueva reserva validada; PATCH de fecha no simula una reprogramación exitosa.

## Evidencia ejecutada

```text
backend: npm test -- --runInBand --silent --json --outputFile=<archivo temporal>
success: true
Test Suites: 155 passed, 155 total
Tests: 1204 passed, 1204 total

frontend: npm run lint
exit_code: 0; sin errores ni advertencias

frontend: npm run build
Compiled successfully
Finished TypeScript
Generating static pages (28/28)
exit_code: 0

node --test scripts/contact-profile-utils.test.cjs scripts/contact-navigation.test.cjs scripts/whatsapp-workspace.test.cjs
tests 15; pass 15; fail 0

node scripts/verify-team-access-local.cjs --keep
PASS: 4 live profiles; operational privacy; grooming assignment/notes;
authenticated cash/price snapshots; live grants/revocation; expired session denied

node scripts/verify-team-access-local.cjs --cleanup
Disposable local fixtures removed
```

La matriz automatizada cubre cuatro perfiles por siete combinaciones, permisos adicionales, fallo cerrado, lectura clínica privada, revocación y restricciones por Tenant/profesional/área. El recorrido HTTP real usa exclusivamente Docker local y datos sintéticos. La comprobación visual verificó Inicio de recepción, acceso a Caja, bloqueo de Administración mediante URL directa y los controles de módulos/permisos administrativos. No se enviaron mensajes por WhatsApp ni se modificó la VPS.

## Persistencia y entrega

Migración aditiva `20261001193000_team_business_access` aplicada en PostgreSQL local y cliente Prisma regenerado. La comprobación posterior a la limpieza encontró cero Staff, clientes, mascotas, citas, ventas y servicios con el prefijo sintético de prueba. El negocio local conserva sus módulos originales: Veterinaria y Peluquería. No se borraron datos reales. `git diff --check` terminó con código 0.

Comprobación del servicio el 2026-10-02: el worker local apareció inicialmente stale tras la pausa del equipo. Se solicitó recarga al proceso local mediante la fecha de modificación de su entrada, sin cambiar su contenido. Verificación posterior de `/api/health`: HTTP 200, status ok, versión 2.41.0, database ok e inboundWorker ok.

El diseño de las cinco etapas está en `docs/architecture/team-business-access.md`, y su reconciliación está en `docs/architecture/domain-model-v1.md`. Se evaluó versionado: es una capacidad funcional nueva y corresponde la versión menor `2.41.0` en package y lock del backend. No se creó tag ni commit de cierre en esta solicitud. Commit, push y despliegue permanecen pendientes; al publicar debe aplicarse la migración y regenerarse Prisma en producción antes de iniciar la versión nueva.
