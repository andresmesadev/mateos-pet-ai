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

El diseño de las cinco etapas está en `docs/architecture/team-business-access.md`, y su reconciliación está en `docs/architecture/domain-model-v1.md`. Se evaluó versionado: es una capacidad funcional nueva y corresponde la versión menor `2.41.0` en package y lock del backend.

## Publicación autorizada y verificada (2026-10-02)

- Commit funcional `fc68b3609a4fef30d4ed9da119127f4a96e27dd1`, subido a `origin/main`.
- CI de GitHub completado con éxito: https://github.com/andresmesadev/mateos-pet-ai/actions/runs/37032261555.
- Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261002T161051Z`; checksum verificado. Imágenes anteriores conservadas con etiquetas `rollback-2.40.0-20261002` para backend y frontend. La migración es aditiva y permite recuperar esas imágenes conservando columnas nuevas; ante regresión funcional se detiene la entrega y se restablecen los servicios anteriores sin eliminar datos.
- `scripts/deploy.sh` finalizó con código 0 en `/home/ubuntu/mateos-pet-ai`. Migración aplicada y cliente Prisma generado durante la construcción de la imagen.
- Contenedores backend/frontend en ejecución; PostgreSQL healthy. Endpoint público `https://bot.nexoweb.co/api/health`: HTTP 200, versión 2.41.0, database/openai/inboundWorker ok. Login público de frontend: HTTP 200.
- `scripts/verify-team-access-vps.cjs` verificó sin escritura: política de cuatro perfiles por siete combinaciones, manifiesto y endpoints administrativos, módulos actuales y todas las columnas nuevas.
- La VPS tiene cero credenciales individuales activas de equipo: no se afirma que se hayan probado cuatro inicios de sesión profesionales allí. Esos accesos, revocación y sesiones vencidas sí se comprobaron con cuentas sintéticas locales retiradas al terminar. No se crearon cuentas ni se modificaron permisos de usuarios reales durante el despliegue.

### Corrección detectada en el smoke test público

Una petición sin cookies al dashboard devolvió 200 después de sustituir el export directo de `auth` por un callback personalizado. En esta integración de NextAuth, `authorized: false` no ejecuta la redirección predeterminada cuando existe ese callback. Se restableció inmediatamente la imagen previa de frontend para recuperar el gate anterior (307 a login), sin revertir la migración ni el backend.

La corrección exige sesión explícitamente al inicio de `frontend/proxy.ts`, antes de llamar APIs de servidor, tanto para `/dashboard` como para `/print`. Se añadió `scripts/verify-dashboard-session.cjs`: sin cookies, prueba Inicio, Administración, Caja y PDF, exige redirección a login con callback y comprueba que login siga disponible. Local: las cinco comprobaciones pasaron; lint y build posteriores con código 0.

Corrección `855159d3870db70cbbad929636ac797b852e65b4` subida y desplegada; `scripts/deploy.sh` terminó con código 0 a las 16:20 UTC del 2026-10-02. CI completado con éxito: https://github.com/andresmesadev/mateos-pet-ai/actions/runs/37033174030. La prueba contra el dominio público del frontend corregido y la verificación de permisos en VPS finalizaron con código 0:

```text
PASS: /dashboard without a session redirects to login (307)
PASS: /dashboard/settings without a session redirects to login (307)
PASS: /dashboard/pos without a session redirects to login (307)
PASS: /print/pets/session-guard-probe without a session redirects to login (307)
PASS: public login remains available (200)
PASS: deployed policy for four profiles and seven module combinations; administrator endpoints
INFO: no active individual team credentials in production; live team sign-ins were verified with disposable local accounts
PASS: migration applied and all new columns available; existing business modules preserved
```

Estado final: frontend y backend en ejecución, PostgreSQL healthy; salud del backend con status ok y versión 2.41.0. Se cierra la entrega tras verificar la imagen corregida en producción.
