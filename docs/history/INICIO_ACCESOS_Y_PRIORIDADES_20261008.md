# Inicio: accesos plegables y prioridades paginadas

Fecha: 2026-10-08. Implementado y verificado localmente.

## Cambios solicitados

### Más accesos

En móvil y tablet, los enlaces secundarios de Acciones rápidas quedan dentro de «Más accesos», cerrado inicialmente. Se abre y cierra con clic, Enter o Espacio. En escritorio (desde 1024 px), los enlaces se muestran directamente y el botón plegable se oculta. Conserva los enlaces autorizados, el establecimiento seleccionado y las tres acciones principales visibles. Se utiliza un único listado de enlaces para las dos presentaciones.

### Necesita atención

- La lista usa páginas numeradas, con anterior/siguiente y un indicador de posición.
- Celular y tablet muestran hasta tres tipos de pendientes por página.
- Cuando las dos tarjetas están en columnas, «Necesita atención» toma la altura real de «Agenda de hoy». Si la agenda cambia de tamaño al filtrar, la tarjeta se adapta.
- El tamaño de página disminuye cuando hay menos espacio. El contenido excepcionalmente largo puede desplazarse dentro de la lista, manteniendo el encabezado y los botones de página dentro de la tarjeta.
- En columnas, la agenda tiene una altura mínima de 430 px para que una agenda vacía permita leer los pendientes y usar la paginación.
- Los datos no disponibles se anuncian siempre mediante un aviso general; se puede llegar a cada revisión fallida desde sus páginas.
- Se conserva el orden de prioridad del perfil. La paginación recorre los tipos de pendiente ya cargados; cada enlace abre el listado completo de su módulo.

La corrección sustituye «Ver otros pendientes» y la expansión ilimitada de la lista. No modifica las fuentes, permisos ni reglas de negocio.

## Comprobaciones

```text
Frontend: node node_modules/eslint/bin/eslint.js
Exit code: 0; sin errores ni advertencias.

Frontend, NEXT_VERIFY_BUILD=1: node node_modules/next/dist/bin/next build
Compiled successfully
Finished TypeScript
Generating static pages: 29/29
Exit code: 0

node --test scripts/home-workspace.test.cjs scripts/home-adaptability.test.cjs scripts/product-unification.test.cjs scripts/workspace-continuity.test.cjs
tests 25
pass 25
fail 0
Exit code: 0

node scripts/verify-home-adaptability.cjs
PASS: admin, receptionist, vet y groomer en 320/768/1440 px.
PASS: filtros, foco, totales y grupos vacíos.
PASS: actualización diferida, reconexión y conservación del formulario.
PASS: permisos rechazados bloquean el espacio de trabajo.
Exit code: 0

node scripts/verify-home-fixtures.cjs
13 escenarios de perfiles/módulos, vacío, fallo y listas parciales: PASS.
Actualización manual, aislamiento y navegación: PASS.
Exit code: 0
```

Los escenarios de navegador incorporan comprobaciones de apertura/cierre por teclado del desplegable, recorrido completo de las páginas, posición de la paginación dentro del contenedor, igualdad de alturas en escritorio y espacio legible tras filtrar una agenda vacía. Se actualizó la regresión que antes comprobaba la expansión completa de pendientes para comprobar ahora que todos sean accesibles mediante páginas.

Se revisaron las capturas de escritorio y tablet. Capturas: `.cache/home-adaptability/`. Las pruebas usan Chrome y un backend simulado aislado en 3030/3031; no escriben datos reales ni envían mensajes.

## Comprobación de la corrección para escritorio

Tras la indicación de mostrar los enlaces directamente en escritorio:

```text
Lint: exit 0, sin errores ni advertencias.
Build: Compiled successfully; Finished TypeScript; 29/29 páginas; exit 0.
node --test scripts/home-workspace.test.cjs scripts/home-adaptability.test.cjs
tests 14; pass 14; fail 0; exit 0.
node scripts/verify-home-adaptability.cjs
Cuatro perfiles, 320/768/1440 px: PASS.
Plegable visible y operativo con teclado en móvil/tablet: PASS.
Botón oculto y enlaces visibles directamente en escritorio: PASS.
Filtros, reconexión, ficha abierta y permisos: PASS; exit 0.
git diff --check: exit 0; aviso LF/CRLF de Windows.
```

## Propuestas opcionales

El alcance actual puede cerrarse con estos ajustes. Dos mejoras opcionales concretas serían:

1. **Recordar el filtro de jornada y la página de prioridades al volver a Inicio**, separados por usuario y establecimiento, siguiendo la continuidad ya aplicada a otros módulos. Al cambiar los datos, validar la página y el filtro guardados.
2. **Mostrar la antigüedad de los seguimientos pendientes**: «vence hoy» o «vencido hace X días», calculada desde la fecha que ya devuelve el seguimiento. Esto ayuda a elegir qué caso abrir primero.

Son propuestas de presentación sobre capacidades existentes; no se implementaron en esta solicitud.

Actualización posterior: ambas fueron aceptadas e implementadas. Ver [el cierre de continuidad y seguimientos](CIERRE_INICIO_CONTINUIDAD_Y_SEGUIMIENTOS_20261008.md).

## Publicación

Cambios locales pendientes de commit, push y despliegue. El versionado corresponde a la próxima publicación del conjunto; esta corrección no crea un tag oficial ni cambia el esquema de datos.
