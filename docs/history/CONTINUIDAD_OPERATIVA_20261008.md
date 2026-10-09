# Continuidad de trabajo y búsqueda móvil

Fecha: 2026-10-08. Estado: **los tres ajustes están implementados y verificados localmente**. Commit, push y despliegue siguen pendientes, junto con el conjunto de mejoras anterior.

## Qué cambió

### 1. Regresar con los filtros conservados

Inventario, Peluquería y Consultas veterinarias recuperan búsqueda, fecha, responsable, vista y estado aplicables al regresar o recargar. Los valores se reflejan en la URL y funcionan con Atrás/Adelante. Una entrada con filtros explícitos en la URL tiene prioridad sobre la selección anterior. «Limpiar filtros» devuelve cada módulo a su selección inicial.

Se validan fechas reales, opciones permitidas, áreas activas y profesionales. La selección se conserva durante 12 horas de inactividad en la pestaña, separada por usuario y establecimiento. Los listados consultan nuevamente al servidor; no se almacenan productos, citas ni expedientes.

También se corrigió el enlace «Ver historia» de Consultas para conservar el establecimiento al abrir el expediente.

### 2. Recuperar borradores de WhatsApp

El texto no enviado se conserva en la pestaña por usuario, establecimiento y conversación, durante un máximo de dos horas. Se muestra «Borrador recuperado» y una acción de descarte con confirmación. Solo se presenta el texto tras comprobar el acceso al chat.

Un envío fallido conserva el borrador. Un envío confirmado lo limpia, siempre que corresponda al mismo texto: una confirmación tardía no borra el nuevo borrador escrito después de salir y regresar. Cerrar sesión limpia este almacenamiento. No se envía nada automáticamente.

Si el navegador bloquea el almacenamiento, la escritura continúa en memoria y se informa que el borrador no se podrá conservar al salir. No se promete recuperación entre dispositivos ni después de cerrar la pestaña.

### 3. Búsqueda general en celular

El encabezado móvil incorpora un botón que abre el buscador de clientes y mascotas. Reutiliza el endpoint, permisos y resultados existentes. El diálogo tiene foco inicial, cierre con Escape, retorno del foco, selección por teclado y reintento ante errores. Los enlaces mantienen el establecimiento seleccionado.

La búsqueda desaparece cuando el perfil no tiene acceso a contactos. Se comprobó el diseño a 320 y 390 píxeles sin desbordamiento horizontal.

## Evidencia de comprobación

### Lint y compilación

Desde `frontend/`, usando Node.js 24:

```text
node node_modules/eslint/bin/eslint.js
Salida: sin errores ni advertencias. Código de salida: 0.

NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build
✓ Compiled successfully
Finished TypeScript
✓ Generating static pages using 11 workers (29/29)
Código de salida: 0.
```

La compilación utilizó `.next/verification`, independiente del servidor de desarrollo.

### Pruebas de validación y regresión

```text
node --test scripts/home-workspace.test.cjs scripts/product-unification.test.cjs scripts/whatsapp-workspace.test.cjs scripts/workspace-continuity.test.cjs
ℹ tests 27
ℹ pass 27
ℹ fail 0
ℹ skipped 0
Código de salida: 0.
```

Las ocho pruebas nuevas cubren fechas inválidas, permisos y módulos de inventario, profesionales, etapas incompatibles, aislamiento de usuario/establecimiento, caducidad, contenido corrupto, almacenamiento bloqueado y límites de borradores.

### Recorridos de navegador

Chrome con Playwright, frontend de producción y backend de contratos en memoria, en puertos de prueba 3031 y 3030. Los servidores de desarrollo del usuario permanecieron activos.

```text
node scripts/verify-workspace-continuity.cjs
PASS: inventory return, reload, explicit URL, clear, Back/Forward and tenant separation.
PASS: grooming date, staff, stage and search continuity; invalid options and clearing.
PASS: veterinary history search, week and professional restoration; invalid URL and clear.
PASS: 320/390px mobile search, focus return, keyboard pet selection, error/retry and tenant context.
PASS: mobile search entry disappears when contact access is revoked.
PASS: late confirmation does not erase a newer draft after leaving and returning.
PASS: WhatsApp recovery, reload, discard cancel/confirm, manual failure/success, TTL, tenant and sign-out/user separation; no automatic messages.
PASS: fresh backend reads and zero browser runtime errors.
Código de salida: 0.
```

El recorrido clínico también abrió «Ver historia», comprobó el establecimiento en destino y regresó conservando la búsqueda. Las pruebas de WhatsApp hicieron tres solicitudes manuales únicamente al backend simulado: un fallo, un envío confirmado y una confirmación diferida; ninguna solicitud automática ni mensaje real.

Se volvieron a ejecutar `verify-home-fixtures.cjs` y `verify-product-unification.cjs`, ambos con código de salida 0. Pasaron los 13 escenarios de Inicio y su comprobación de actualización, además de navegación antigua, guía por módulos, búsqueda, registro de propietario y mascota, cita, confirmaciones, resúmenes clínicos y de peluquería, y ayuda según perfil.

Capturas locales disponibles en `.cache/workspace-continuity/search-320.png` y `search-390.png`. Se inspeccionó visualmente la captura de 320 píxeles. Playwright utiliza el runtime de dependencias de Codex mediante `NODE_PATH`, como las comprobaciones de navegador existentes.

`git diff --check` terminó con código de salida 0.

## Revisión de arquitectura y alcance

Se reutilizan las entidades y autorizaciones existentes. Tenant conserva su función de aislamiento. Los endpoints autenticados del navegador continúan pasando por `proxyUrl`. No se añadieron tablas, migraciones, endpoints ni reglas de negocio; no se modificaron el motor conversacional, precios, comisiones ni estados de atención. La persistencia temporal es del adaptador de navegador y no sustituye PostgreSQL.

No se certifican con estos ensayos una nueva escritura real en PostgreSQL, una entrega de WhatsApp Cloud API, un dispositivo móvil físico ni una prueba manual con lector de pantalla. La navegación, foco y atributos accesibles se comprobaron en Chrome. Estas limitaciones no impiden los tres ajustes locales, pero deben distinguirse de una verificación de producción.

## Publicación y versión

Se evaluó el versionado: el conjunto introduce capacidades funcionales de frontend y corresponde a una próxima versión menor al publicarlo. La versión publicada anterior sigue siendo `2.44.0`; no se creó un tag ni se declaró disponible una nueva versión en la VPS. Antes del commit final de publicación se debe alinear la versión del código, documentación y salud, incluyendo el conjunto anterior pendiente.

Esta entrega preserva los cambios anteriores del workspace. No se realizó commit, push ni despliegue en esta solicitud.
