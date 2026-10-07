# Administración — Áreas del negocio

Fecha: 2026-10-06. Alcance autorizado: mejorar la configuración existente de Veterinaria, Peluquería y Pet shop después de Datos del negocio.

## Cambios aplicados

- Tarjetas con nombre, descripción, funciones y equipo que utiliza cada área. Los identificadores existentes siguen siendo `veterinary`, `grooming` y `retail`.
- Estado guardado separado de la selección pendiente. Se explica qué se activará o desactivará y cómo quedará el espacio de trabajo.
- Guardar áreas solo se habilita con cambios válidos. Se exige al menos un área; se puede descartar la selección pendiente.
- Confirmación al desactivar áreas, con explicación de conservación del historial. No elimina citas, mascotas ni cuentas del equipo.
- Error de guardado visible, selección conservada para reintentar y protección contra envíos simultáneos.
- Protección al cambiar de sección con cambios pendientes; las pestañas se bloquean durante el guardado.
- Actualización del manifiesto de acceso y menú tras el guardado mediante `mateos-business-config-updated`. El backend continúa resolviendo las opciones según el perfil y las áreas activas.
- Confirmación de éxito distingue entre datos guardados y menú actualizado para el perfil actual.
- Diseño adaptable y casillas nativas utilizables con teclado.

## Dominio y alcance

Se reutilizan `Tenant.activeModules`, el adaptador de configuración, `business-config.service.js` y `effectiveAccess`. Es una mejora de presentación, guardado y verificación de capacidades existentes, sin entidad, regla de permisos ni esquema nuevo. No es un entregable nuevo de Fase 2. No se modificó el motor conversacional ni la resolución de precios.

Activar un área no concede permisos adicionales a un integrante. Las autorizaciones existentes del servidor siguen siendo obligatorias; esconder un enlace no sustituye ese control.

## Evidencia automática

### Frontend

`npm run lint`, ejecutado en `frontend`: código de salida 0, sin incidencias.

Build aislado con `NEXT_VERIFY_BUILD=1` y `node node_modules/next/dist/bin/next build --webpack`: código de salida 0.

```text
Compiled successfully in 7.4s
TypeScript: 5.7s
Generating static pages: 29/29
```

La salida aislada de verificación no sustituye la caché del servidor de desarrollo del usuario.

### PostgreSQL y navegación

`node --test scripts/business-areas-postgres.test.cjs scripts/settings-navigation.test.cjs`: código de salida 0.

```text
PASS: 7 combinaciones persistidas, 4 perfiles comprobados, tenant ajeno e historial intactos, selección vacía rechazada.
tests 7
pass 7
fail 0
duration_ms 11205.3747
```

Se probaron las siete combinaciones no vacías de áreas y los perfiles administrador, veterinario, peluquero y recepción. Se verificó persistencia mediante las rutas reales, aislamiento frente a otro establecimiento, conservación de una cita completada y notas de una mascota, y rechazo de selección vacía sin alterar la configuración previa. Los registros temporales de esta prueba se eliminaron al terminar.

### Suites de backend ejecutadas individualmente

Comando por archivo: `node node_modules/jest/bin/jest.js <archivo> --runInBand`, desde `backend`.

| Archivo | Evidencia real | Salida |
| --- | --- | --- |
| `src/__tests__/integration/dashboard-business-access.test.js` | `Test Suites: 1 passed, 1 total`; `Tests: 37 passed, 37 total`; `Time: 1.053 s` | 0 |
| `src/__tests__/integration/tenant-config-wiring.test.js` | `Test Suites: 1 passed, 1 total`; `Tests: 3 passed, 3 total`; `Time: 1.056 s` | 0 |
| `src/__tests__/integration/dashboard-tenant-profile.test.js` | `Test Suites: 1 passed, 1 total`; `Tests: 27 passed, 27 total`; `Time: 1.182 s` | 0 |

Total comprobado individualmente: 67 pruebas. La invocación conjunta inicial se interrumpió sin resumen completo; no se registra como aprobada. Los mensajes de validación negativa y servidor no disponible pertenecen a casos esperados de esas suites.

## Comprobación en navegador

Se utilizó un establecimiento temporal exclusivo en `mateos_dev`, con API y frontend en loopback 3120/3121. El adaptador de configuración y PostgreSQL fueron reales; el manifiesto de acceso utilizó `effectiveAccess` real y la autenticación fue específica del entorno de comprobación. No se enviaron mensajes ni se ejecutaron trabajos de producción.

1. Sin cambios, guardar permaneció deshabilitado.
2. Desmarcar las tres áreas mostró la validación y bloqueó guardar.
3. Seleccionar solo Pet shop y cambiar de pestaña mostró la confirmación de cambios pendientes; continuar editando conservó la selección.
4. La confirmación de desactivación identificó Veterinaria y Peluquería. Cancelarla mantuvo la configuración y menú anteriores.
5. Un fallo 503 simulado en el primer guardado mostró el error y conservó la selección. El menú anterior permaneció intacto.
6. Reintentar guardó Pet shop y mostró “Áreas guardadas. El menú se actualizó para tu perfil.” El menú dejó de mostrar Agenda, Consultas veterinarias y Peluquería, conservando las herramientas disponibles para el administrador.
7. Recargar mantuvo Pet shop y la pestaña de Áreas del negocio.
8. Descartar una nueva selección restableció Pet shop y deshabilitó guardar.
9. Reactivar Veterinaria y Peluquería guardó y recuperó sus opciones en el menú. Se comprobó nuevamente al recargar.
10. Tecla Espacio alternó la casilla de Veterinaria. A 375 px las tarjetas quedaron en una columna, ancho del documento 365 px y ancho de tarjetas 283,2 px, sin desbordamiento horizontal. Se restableció el tamaño del navegador.

Comprobación independiente posterior: `node scripts/verify-administration-local.cjs verify-areas`, código 0:

```text
PASS: las tres áreas reactivadas están persistidas en PostgreSQL local; identidad y canal del establecimiento temporal conservados.
```

Se cerraron exclusivamente los procesos temporales identificados. `cleanup` y `cleanup-check` terminaron con código 0:

```text
PASS: disposable tenant removed; existing business data unchanged.
PASS: no queda ningún establecimiento temporal de esta comprobación.
PASS: puerto temporal cerrado 3120
PASS: puerto temporal cerrado 3121
```

## Publicación y siguiente bloque

Cambios comprobados localmente. Este bloque no añadió migraciones. La migración de teléfono de contacto del bloque anterior sigue pendiente de publicación junto con el conjunto de Administración. No se realizó commit, push, despliegue ni tag en esta tarea; el versionado se evaluará antes de publicar el cierre autorizado del conjunto.

Siguiente bloque propuesto: **Servicios y precios**, revisando claridad del catálogo, edición y estados sin duplicar la resolución de precios existente.
