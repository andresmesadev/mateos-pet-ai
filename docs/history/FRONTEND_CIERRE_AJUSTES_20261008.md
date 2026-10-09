# Ajustes finales del frontend — 8 de octubre de 2026

## Resultado y alcance

El usuario aprobó ejecutar los cuatro bloques del [diagnóstico profundo](../architecture/FRONTEND_CIERRE_REVISION_PROFUNDA_20261008.md). Se corrigieron los tres bloques funcionales y se ejecutó la comprobación automática del cuarto. **El cierre manual de accesibilidad sigue pendiente:** no se certifican zoom real de Chrome ni lectura con un lector de pantalla.

Trabajo local, sin commit, push ni despliegue en esta ronda. La última publicación documentada continúa siendo [2.44.0](RELEASE_2_44_0_VPS_20261007.md). Las pruebas con escrituras utilizaron exclusivamente simulaciones o una base PostgreSQL desechable; no se enviaron mensajes externos ni se ejecutaron jobs de negocio.

Las correcciones afectan adaptadores existentes y no crean entidades, migraciones, reglas contables, perfiles ni permisos. Se conserva Tenant como única unidad de aislamiento, ADR 007 para el ingreso de servicios y el resolutor único de precios. Se preservó el resto del trabajo local previo.

## 1. Guardados y resultado incierto

- La revisión del método de pago consulta el cobro por ID antes de enviar. Una respuesta HTTP 200 incompleta ya no anuncia éxito: se valida identidad, importe y datos confirmados del registro.
- Ante un resultado incierto se conserva método y nota y se ofrece **Comprobar resultado**. Esta acción hace GET, sin repetir POST. Cerrar y reabrir el diálogo en la misma vista conserva el intento; si el pago ya está registrado, se recupera sin un segundo envío.
- El formulario limita la espera y vuelve a permitir cerrar o comprobar. El proxy cubre tanto la recepción de cabeceras como el cuerpo de la respuesta con un plazo de 15 segundos; el cliente de estos recorridos espera hasta 20 segundos.
- El fin de la espera no revierte ni demuestra cancelación del comando del servidor. La comprobación previa evita reintentar a ciegas; no se declara una nueva garantía de idempotencia durable para liquidaciones.

Archivos principales: `frontend/lib/dashboard-request.ts`, proxy autenticado y `review-payment-dialog.tsx`. El historial administrativo reutiliza el mismo diálogo para revisar un cobro sin salir de la lista.

## 2. Caja y pagos de fechas anteriores

- Caja consulta páginas de 10 a 50 registros y busca en todo el conjunto filtrado. Los totales incluyen todas las páginas y se leen junto con el conteo y la página en una transacción `RepeatableRead`.
- **Pendientes de todas las fechas** incluye cobros de servicios antiguos. `pendingCount` alimenta también la tarea de Inicio; ya no se depende de las primeras 200 filas.
- Recepción puede revisar esos cobros y comprobar su resultado posteriormente. Las ventas manuales históricas, los reportes y la consulta ordinaria de fechas anteriores mantienen sus restricciones administrativas.
- Liquidar el método del cobro de ayer conserva su importe, la cantidad de cobros asociados a la cita y el cierre diario congelado. No se contabiliza una venta nueva.
- Se detectaron y corrigieron dos fallos durante la verificación: el proxy ocultaba parámetros de negocio repetidos y la nueva consulta de Caja usaba `tenant` donde el proxy requiere `tenantId`. Ahora los validadores reciben los parámetros repetidos y el administrador consulta el establecimiento seleccionado.

Contrato actualizado en [Espacio de trabajo POS](../architecture/pos-workspace.md). Implementación en `operational-cash-page.js`, lectura financiera compartida, rutas existentes y `operational-cash.tsx`.

## 3. Seguimientos clínicos y edición del precio

- El fallo al cargar seguimientos aparece explícitamente. **Reintentar seguimientos** vuelve a consultar esa sección conservando el borrador clínico; no se representa un fallo de lectura como una lista vacía confirmada.
- La gestión de seguimientos se bloquea mientras no se conoce su estado. Los datos de la consulta se conservan.
- El campo del precio de la cita se bloquea durante el guardado, junto con un bloqueo inmediato de envíos concurrentes. Un rechazo mantiene el precio escrito y permite corregirlo.
- La respuesta del precio también se valida antes de cerrar el editor y anunciar la actualización.

Archivos: `vet-record-sheet.tsx` y `appointment-detail-dialog.tsx`. Sin cambios al modelo de versiones de historia clínica ni al resolutor de precios.

## 4. Evidencia automática

### Compilación, lint y pruebas

Comandos ejecutados con Node local y código de salida **0**:

```text
# En frontend, compilación aislada; NEXT_VERIFY_BUILD=1
node node_modules/next/dist/bin/next build --webpack
Compiled successfully in 5.4s
Finished TypeScript in 2.8s
Generating static pages (29/29)

# En frontend
node node_modules/eslint/bin/eslint.js .
# Sin diagnósticos

# En backend
node node_modules/jest/bin/jest.js --runInBand
Test Suites: 167 passed, 167 total
Tests:       1337 passed, 1337 total
Snapshots:   0 total

# En raíz
node --test scripts/product-unification.test.cjs scripts/workspace-continuity.test.cjs scripts/pos-cash.test.cjs scripts/pos-history.test.cjs scripts/operational-cash-query.test.cjs
tests 25
pass 25
fail 0
cancelled 0
skipped 0
```

`node --check` de los cuatro adaptadores backend modificados terminó sin diagnósticos. El backend no declara un comando de lint; se ejecutaron su suite completa, comprobación de sintaxis y pruebas de integración real.

### Recuperación de fallos

Comando `node scripts/audit-dashboard-closure.cjs`, código **0**:

```text
PASS: HTTP 200 with an incomplete payment never announces success; checking an unconfirmed charge restores the retained draft.
PASS: A persisted payment with a lost response survives close/reopen and is recovered by GET without a second POST.
PASS: A request exceeding the client deadline unlocks the dialog, retains its values and requires a result check.
PASS: Followup failure is explicit; retrying only that section preserves the clinical draft.
PASS: Appointment price freezes during save and remains in the editor after a rejected response.
Closure acceptance checks: 5 passed, 0 failed. Fixture-only writes; no business data or outgoing messages.
```

### Regresión visual y perfiles

Comando `node scripts/verify-general-dashboard.cjs`, código **0**, sobre la compilación corregida:

```text
PASS: 17 module/section screens at 320 px, no horizontal overflow, HTTP 500 or browser runtime errors.
PASS: 17 module/section screens at 768 px, no horizontal overflow, HTTP 500 or browser runtime errors.
PASS: 17 module/section screens at 1440 px, no horizontal overflow, HTTP 500 or browser runtime errors.
PASS: receptionist available screens and finance privacy follow authenticated capabilities.
PASS: vet available screens and finance privacy follow authenticated capabilities.
PASS: groomer available screens and finance privacy follow authenticated capabilities.
PASS: cash failure is explicit and retry restores the screen, with no business writes.
PASS: zero business writes, zero external messages and all business-data reads tenant-scoped.
```

Son 51 comprobaciones de pantallas para administración, además de recorridos por rol y recuperación de la carga de Caja. La primera ejecución detectó la selección incorrecta de Tenant; el resultado anterior corresponde a su repetición después de corregirla.

En esta misma ronda también pasó `node scripts/verify-general-dashboard.cjs --secondary-forms-only`: 18 grupos de comprobaciones de formularios financieros, con tamaños de 320/768/1440 px, foco, etiquetas, errores accesibles, bloqueo de envíos, contraste AA y reflujo equivalente al 200 %. Esa prueba automática no equivale a la lectura humana con tecnología asistiva.

### Integración real

`node scripts/verify-dashboard-integration.cjs` usa autenticación Next, proxy, rutas Express y PostgreSQL con una base nueva y desechable. Comprueba 202 pendientes, páginas hasta la 21, búsqueda del cobro de ayer, revisión en el formulario, importe conservado y cierre diario idéntico.

La matriz usa cuatro perfiles y siete combinaciones no vacías de veterinaria, peluquería y tienda: 28 consultas de capacidades y **140 lecturas protegidas**. Retirar el permiso de caja con el formulario abierto impide el comando y conserva el valor ingresado. También se comprueban identidad, aislamiento, rechazo de ventas manuales históricas para recepción y cobros de otro establecimiento.

Resultado final, código **0**:

```text
PASS 202 pending charges are paginated with complete totals; reception finds yesterday without gaining historical reports
PASS Reception reviews an old service through the real form; original income and the frozen daily close remain identical
PASS Real HTTP permission matrix: 4 roles × 7 module combinations, 140 protected reads
PASS Cash permission removed while a form is open blocks the operation server-side and retains the entered value
PASS Cross-tenant IDs/body/forged identity are rejected; query cannot override the authenticated tenant; missing authentication rejected
PASS Frontend, authenticated proxy, real Express routes and PostgreSQL completed without browser errors
Integration checks: 11 passed, 0 failed. Disposable database only; no jobs or outgoing messages.
PASS disposable database removed
```

Una repetición completó los escenarios pero falló al cerrar el pool de la base desechable. Se corrigió la propiedad explícita del pool en el harness y su liberación mediante el adaptador; la repetición final anterior terminó correctamente y eliminó la base sin forzar desconexiones. Los puertos de pruebas 3030/3031 quedaron libres y los servicios del usuario 3000/3001 continuaron escuchando. Esta incidencia del harness no se presenta como una prueba aprobada.

## Límites y entrega

Validación documental final: `node scripts/check-docs.cjs`, código **0**, con 281 documentos, 266 archivos Markdown y 722 enlaces comprobados; cero enlaces rotos, referencias faltantes, enlaces locales no portables, errores de catálogo y duplicados exactos. `git diff --check` de los archivos afectados terminó con código **0**, sin errores de whitespace; Git solo informó conversiones LF/CRLF configuradas. La consulta de control encontró **0 bases desechables restantes**. Los componentes cliente afectados continúan usando `proxyUrl`, sin llamadas directas a `apiUrl` para recursos autenticados.

- La prueba manual de zoom real y lector de pantalla no se pudo ejecutar: el helper de control de Windows falló al iniciarse en dos intentos con `trusted Node process exited unexpectedly`. No se modificó la seguridad de Windows ni se sustituyó por una ejecución no autorizada. Faltan esas dos comprobaciones humanas antes de declarar cerrado todo el bloque de accesibilidad.
- Para completar ese criterio: usar zoom real de Chrome al 200 %, recorrer por teclado Caja y los diálogos de pago/precio/consulta, y comprobar con Narrador o NVDA los nombres de campos, errores, estado de carga, orden de foco y regreso al control que abrió el diálogo. Es una comprobación pendiente, no un resultado inferido de las capturas.
- La revisión de versión se evaluó: no se crea un cierre oficial, commit final ni tag en esta ronda. `2.44.0` identifica la publicación documentada; el conjunto local deberá evaluar y aplicar su incremento antes del commit/tag oficial, sin discrepancia con el endpoint de salud.
- Estos resultados no certifican la VPS, un piloto externo ni los envíos reales de WhatsApp pendientes en [Estado actual](../ESTADO_ACTUAL.md).
- El trabajo funcional autorizado está implementado y comprobado localmente; quedan la comprobación manual indicada y la publicación cuando el usuario la solicite.
