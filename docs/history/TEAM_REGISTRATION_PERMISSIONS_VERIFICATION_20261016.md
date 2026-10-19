# Validación local: alta del equipo con permisos

Fecha: 2026-10-16. Alcance confirmado por el responsable: «todos los servicios» significa acceso completo al dashboard conservando el título Veterinario/a.

Diseño previo y reconciliación: [Alta de integrantes con permisos](../architecture/team-registration-permissions.md).

## Resultado funcional

- Nuevo integrante permite elegir permisos adicionales o «Acceso completo al dashboard» antes de guardar la ficha.
- El acceso completo puede retirarse desde Perfil y permisos; conserva las habilitaciones individuales elegidas previamente.
- Staff.role sigue siendo `vet` y conserva su regla de comisión. Inicio y barra lateral muestran Veterinario/a. El servidor deriva la autoridad administrativa del permiso vigente, sin conceder superadministración.
- Se guarda ficha y permisos mediante el mismo INSERT de Registrar Staff. Los permisos desconocidos se rechazan antes de escribir.
- Las credenciales se habilitan por separado desde Acceso. No se crean cuentas reales ni se envían correos.
- Compatibilidad de servicios, horarios, precios y comisiones permanecen sin cambios.

## Evidencia ejecutada

Runtime: Node 24.19.0. Comandos desde backend y frontend respectivamente:

```text
node node_modules/jest/bin/jest.js --runInBand --silent
Test Suites: 196 passed, 196 total
Tests:       1586 passed, 1586 total
```

Después de conservar el snapshot de auditoría con la autoridad efectiva existente, se repitieron los tests de acceso afectados:

```text
Test Suites: 2 passed, 2 total
Tests:       42 passed, 42 total
```

```text
node node_modules/eslint/bin/eslint.js .
Exit code: 0

NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build
Compiled successfully
Finished TypeScript
Generating static pages (32/32)
Exit code: 0
```

Verificación HTTP, PostgreSQL y Chrome reales, desde la raíz:

```text
node scripts/verify-onboarding-local.cjs --team-permissions
Onboarding integration: 12 passed, 0 failed.
PASS own temporary PostgreSQL container removed
```

La prueba reutiliza el registro autónomo para obtener una sesión administradora real y luego crea una veterinaria desde el formulario, habilita su credencial y entra por NextAuth. Comprueba título profesional, administración, facturación sin llamar a Stripe, aislamiento del establecimiento, bloqueo de la vista global, retirada de administración en sesión abierta, conservación de Caja, rechazo de autoescalamiento y bloqueo por credencial revocada. Comprueba también que el alta certifique StaffRegistrado.

El contenedor PostgreSQL se crea con nombre/etiqueta aleatorios y almacenamiento temporal; se aplican todas las migraciones desde vacío y se verifica que no exista drift. No utiliza la base de desarrollo habitual ni la VPS. No arranca jobs, envía mensajes ni cobra pagos. Capturas de pantalla locales reproducibles: `.cache/onboarding-verification/07-team-permissions-desktop.png`, `08-team-permissions-mobile.png`, `09-veterinarian-admin-access.png`. Se verificaron anchos de 320, 390 y 768 px sin desbordamiento horizontal.

## Estado de publicación y versión

Mejora validada en local, pendiente del commit, push y despliegue conjunto acordado con el responsable. Sin migración de esquema. Versionado evaluado: corresponde un incremento funcional al preparar esa publicación; no se crea un tag ni se cambia la versión desplegada 2.49.0 durante este lote local.
