# Registro del primer administrador — verificación local

**16 de octubre de 2026, Colombia. Validación local previa de 2.49.0.** Después de esta revisión, el responsable autorizó commit, push y despliegue. La publicación en VPS y la nueva observación están documentadas en la [certificación productiva](RELEASE_2_49_0_VPS_20261016.md); las pruebas y límites de esta página corresponden al trabajo local anterior.

## Problema y resultado

«Crear mi cuenta» antes creaba solamente un Tenant, pedía un Phone Number ID de Meta y ofrecía planes con capacidades/precios estáticos. No creaba credenciales de administrador. El nombre del propietario se descartaba y la página final daba instrucciones de infraestructura, sin permitir un primer ingreso autónomo.

El recorrido ahora es **Tu negocio → Tu acceso → Revisar**: nombre, módulos explícitos, identificador autogenerado editable, nombre/correo/contraseña del administrador y resumen. La disponibilidad descarta respuestas antiguas. Contraseña de 12–128 caracteres, confirmación y opción de mostrarla. Navegación atrás conserva valores en memoria; no se guardan contraseñas en URL ni almacenamiento del navegador.

La operación crea Tenant, Staff administrador y StaffCredential con scrypt mediante una escritura anidada atómica. El login reutiliza NextAuth y el endpoint interno de Staff. No concede acceso global, capacidades de servicio o comisiones automáticas. Un conflicto revierte también el Tenant nuevo. Si falla el ingreso después del alta, se ofrece iniciar sesión sin repetir el registro. La pantalla final requiere una sesión y orienta a configuración, equipo/servicios y primera jornada.

No exige WhatsApp, no crea números ficticios ni ejecuta cobros. Se usa el plan gratuito existente; contratación posterior desde Facturación autenticada. El adaptador público del mismo origen no envía cookies o autoridad interna al backend. Rechaza origen ajeno y correo reservado del administrador de plataforma. El backend valida tipos, longitudes, módulos, correo y claves permitidas; nunca acepta Tenant/rol desde el formulario y proyecta explícitamente la respuesta pública. Hay límite de altas, además del límite público existente.

## Dominio, persistencia y compatibilidad

Diseño previo en las [cinco secciones](../architecture/self-service-administrator-registration.md) y aclaración del [modelo de dominio](../architecture/domain-model-v1.md). Se reutilizan entidades, permisos y hashing existentes; no se agrega contexto, Organización o rol. No se cambia el motor conversacional, resolución de precios o comisiones.

La migración `20261016170000_onboarding_optional_channel` permite `Tenant.phone = NULL` hasta conectar WhatsApp; conserva los identificadores existentes y su índice único. Ambos clientes Prisma se generaron. Una sesión Staff conserva su Tenant explícito aun con `SINGLE_TENANT_ID`; sigue requiriendo token interno, pertenencia, credencial activa y versión vigente. El administrador legado conserva el fallback. Se verificó tanto el camino permitido como el rechazo cross-tenant.

El nuevo registro **siempre crea un establecimiento separado**. No reclama el Tenant previo de Mateos Pet por nombre, correo ni contraseña. No se sustituyeron accesos reales ni se creó la cuenta definitiva del responsable.

## Evidencia ejecutada

Regresión backend con Node **24.19.0**, incluido en el runtime local de Codex:

```text
Test Suites: 195 passed, 195 total
Tests:       1575 passed, 1575 total
Snapshots:   0 total
Time:        37.607 s
```

Comando: `node node_modules/jest/bin/jest.js --runInBand --silent --json --outputFile=../.tmp/onboarding-regression.json`, desde backend. Las primeras ejecuciones con Node 24.15.0 terminaron prematuramente; una captura directa devolvió `-1073740791`. No se omitieron suites para obtener el resultado: la regresión completa terminó con código 0 usando 24.19.0. Las pruebas dirigidas de onboarding/resolveTenant también pasaron: 42 casos. Los mensajes de error de los escenarios negativos no son fallos de la suite.

Frontend:

```text
npm run lint: exit 0
next build: Compiled successfully
Finished TypeScript
Generating static pages (32/32)
Build: exit 0
```

Build aislado en `.next/verification`, con `NEXT_VERIFY_BUILD=1`, sin reemplazar la salida del servidor de desarrollo del responsable.

Prueba real: `scripts/verify-onboarding-local.cjs`, Node 24.19.0, Chrome aislado, Next en modo producción, Express real y contenedor PostgreSQL/pgvector local propio, sin volúmenes persistentes. Se aplicaron todas las migraciones desde vacío y `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` terminó en 0.

```text
Onboarding integration: 9 passed, 0 failed.
Local disposable data only; no jobs, messages or charges.
PASS own temporary PostgreSQL container removed
```

Las nueve comprobaciones cubren: migración/diff; respuestas antiguas de disponibilidad; confirmación de contraseña antes de escribir; creación y login NextAuth reales sin canal/pago; primer dashboard con instalación single-tenant y rechazo de Tenant ajeno; conflicto concurrente y rollback del alta; tamaños 320/390/768 y accesos anónimos/origen/correo reservado; recuperación de ingreso automático fallido y login manual desde móvil; revocación de sesión. La cuenta móvil se registra efectivamente y recupera el acceso mediante la pantalla de login, sin un segundo alta. Los datos de prueba se retiraron junto con el contenedor.

Capturas privadas, con datos ficticios, en `.cache/onboarding-verification/`: negocio/acceso/resumen en escritorio y móvil. Se inspeccionaron visualmente; se corrigió también el espacio entre palabras del encabezado al ocultar el salto de línea en móvil. No certifican lector de pantalla, zoom de navegador o correo real.

Protecciones existentes relacionadas:

```text
node --test scripts/page-request-policy.test.cjs scripts/operator-channel-authority.test.cjs scripts/operator-channel-reauth.test.cjs
tests 18
pass 18
fail 0
```

## Revisión y límites de publicación

El bump menor 2.48.0 → **2.49.0** refleja el alta administrativa utilizable y su compatibilidad con operación sin canal. Backend y lockfile coinciden; salud obtiene la versión del paquete. No se crea tag oficial ni se presenta la versión local como desplegada.

Condiciones de publicación: CI Linux, copia de seguridad y migración antes de servir el nuevo código, seguido del smoke autenticado en la VPS. El reinicio exige conservar incompleta la captura anterior y abrir una nueva ventana. Esa publicación se ejecutó posteriormente con autorización explícita; consultar su certificación vinculada arriba.

No se implementó proveedor de correo, verificación de propiedad o recuperación por email; escribir un correo no lo certifica. No se habilitó contratación pública ni se revisó aceptación legal para una beta comercial. Los límites del adaptador público se comparten por IP de salida del servidor Next; no se afirma capacidad de altas masivas. La primera jornada real mantiene sus requisitos operativos/documentales y la revisión de configuración de servicios/equipo.
