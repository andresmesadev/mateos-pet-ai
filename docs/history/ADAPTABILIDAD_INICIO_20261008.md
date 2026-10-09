# Inicio: adaptabilidad y continuidad de lectura

Fecha: 2026-10-08. Estado: implementado y comprobado localmente.

Se aplicaron los tres ajustes aprobados en `docs/history/designs/PROPUESTA_ADAPTABILIDAD_INICIO_20261008.md`.

Revisión posterior solicitada: [accesos plegables y prioridades paginadas](INICIO_ACCESOS_Y_PRIORIDADES_20261008.md), que sustituye la expansión de pendientes y alinea las tarjetas en columnas.

## 1. Orden según perfil y espacio

- Recepción, veterinarios y peluqueros encuentran la agenda antes de los pendientes.
- Administración mantiene primero las prioridades del establecimiento y conserva su sección de resultados.
- El orden del documento coincide con el orden visual y de lectura asistida.
- Las dos columnas aparecen cuando el contenido dispone de 880 px; celular y tablet conservan una columna.
- Los módulos y permisos existentes determinan las fuentes y acciones visibles.

## 2. Resumen que filtra la agenda

Las tarjetas «Por llegar», «En espera», «En atención» y «Terminadas» son botones. Al seleccionarlas se marca el filtro y se lleva el foco al listado de citas. «Todas las citas» restablece el conjunto y «Por revisar» conserva su función anterior.

Los totales siguen calculándose sobre la agenda autorizada completa, independientemente del filtro. El listado compacto conserva su límite de ocho citas y el acceso a la agenda completa. Los grupos vacíos muestran su estado vacío. Cuando falla la lectura, las tarjetas se deshabilitan; una primera lectura fallida muestra valores no disponibles, sin convertir el fallo en ceros.

## 3. Antigüedad, regreso y conexión

- Inicio muestra la hora de Colombia y la antigüedad de la consulta.
- Al volver a una pestaña visible se consultan de nuevo los datos que llevan dos minutos sin actualizarse; el cambio de día en Colombia también los considera antiguos.
- Recuperar conexión solicita una nueva consulta. Las solicitudes automáticas tienen un intervalo mínimo de 30 segundos para evitar repeticiones al cambiar de pestaña.
- Una ficha abierta, una confirmación o un campo editable activo pospone la actualización. Se indica que está pendiente y se vuelve a intentar al terminar la edición.
- El botón manual permanece disponible; durante una actualización o sin conexión se deshabilita.
- Una nueva lectura de agenda fallida conserva la última agenda cargada y la identifica expresamente como anterior. Los pendientes y resultados que no se pudieron comprobar mantienen su estado de error.

### Corrección detectada durante las pruebas

La comprobación periódica de permisos vaciaba el espacio de trabajo cuando el navegador estaba sin internet, cerrando incluso una ficha con texto sin guardar. Se conserva la pantalla ya cargada mientras el navegador declara que está sin conexión y se vuelven a consultar los permisos al recuperar internet. Una respuesta de rechazo del servidor sigue bloqueando la pantalla.

La actualización de sesión al cambiar de pestaña también se pospone mientras el navegador está sin conexión. Se comprobó que los borradores siguen separados por usuario y establecimiento y se limpian al cerrar sesión.

Estas medidas conservan la interfaz y el texto abierto; no permiten guardar operaciones sin conexión ni sustituyen la autorización del backend.

## Archivos principales

- `frontend/components/dashboard/home/journey.tsx`: orden de secciones, tarjetas y conservación identificada de la agenda anterior.
- `frontend/components/dashboard/home/workspace.tsx`: integración con las fuentes y permisos existentes.
- `frontend/components/dashboard/home/refresh-home.tsx`: antigüedad y ciclo de actualización.
- `frontend/components/dashboard/today-schedule.tsx`: filtros compartidos y sincronización con las tarjetas.
- `frontend/lib/home-adaptability.ts`: grupos de estados, orden y reglas de antigüedad.
- `frontend/components/dashboard/dashboard-access-provider.tsx` y `frontend/components/providers.tsx`: conservación de la pantalla durante una desconexión conocida y revalidación al regresar.

## Evidencia ejecutada

### Lint

En `frontend`:

```text
node node_modules/eslint/bin/eslint.js
Exit code: 0
Sin errores ni advertencias.
```

### Compilación aislada

En `frontend`, con `NEXT_VERIFY_BUILD=1`:

```text
node node_modules/next/dist/bin/next build
Compiled successfully
TypeScript: completado
Generating static pages: 29/29
Exit code: 0
```

### Pruebas unitarias

```text
node --test scripts/home-workspace.test.cjs scripts/home-adaptability.test.cjs scripts/product-unification.test.cjs scripts/workspace-continuity.test.cjs scripts/whatsapp-workspace.test.cjs
tests 31
pass 31
fail 0
Exit code: 0
```

Incluyen grupos de estados, orden por perfil, fechas inválidas, frontera de antigüedad, cambio de día en Colombia, permisos, módulos, navegación y separación de borradores.

### Navegador

Ejecutados con Chrome y Playwright, usando un backend de prueba en memoria y un frontend de producción aislado en los puertos 3030/3031:

```text
node scripts/verify-home-adaptability.cjs
PASS: admin, receptionist, vet, groomer; 320/768/1440 px.
PASS: four day filters, empty groups, unchanged totals, focus and all-appointments reset.
PASS: stale return refreshes reads and rapid focus changes do not duplicate requests.
PASS: open unsaved price postpones refresh, retains input and refreshes after confirmed close without writes.
PASS: hidden page defers and refreshes when visible.
PASS: offline state blocks reads; connection restoration requests fresh data.
PASS: failed read labels retained agenda, disables unverifiable cards, and successful retry restores them.
PASS: offline focus and visibility preserve an unsaved form; reconnect defers Home refresh.
PASS: online permission revocation blocks the workspace; cached access never overrides rejection.
PASS: first failed read shows unavailable values, never a false zero.
Exit code: 0
```

Regresiones ejecutadas después:

```text
node scripts/verify-home-fixtures.cjs
13 escenarios de perfiles/módulos, vacío, fallo y listas parciales: PASS.
Actualización de la fecha de consulta, teclado, aislamiento y navegación: PASS.

node scripts/verify-product-unification.cjs
Entradas anteriores, guía por módulos, búsqueda, alta de cliente/mascota/cita,
confirmaciones, fichas y ayuda por perfil: PASS.

node scripts/verify-workspace-continuity.cjs
Inventario, peluquería, consultas, búsqueda móvil 320/390 px,
borradores de WhatsApp, respuesta tardía y cierre de sesión: PASS.
PASS: fresh backend reads and zero browser runtime errors.
Exit code conjunto: 0
```

Se actualizó el selector del escenario de actualización parcial para comprobar el nuevo mensaje completo. Se revisaron visualmente las capturas de recepción a 320 px y administración a 1440 px. Las capturas de los cuatro perfiles están en `.cache/home-adaptability/`.

`git diff --check`: salida 0; únicamente avisos de normalización LF/CRLF del entorno Windows.

## Alcance y publicación

La modificación pertenece a los adaptadores de presentación y lectura de capacidades existentes. No añade entidades, reglas clínicas, cambios de precio, comisiones ni migraciones. Se conserva el aislamiento por establecimiento y el uso del proxy autenticado desde el navegador.

Las pruebas de navegador utilizan datos simulados: comprueban la interfaz y sus contratos, sin escribir en PostgreSQL ni enviar mensajes reales. No sustituyen una comprobación posterior en la VPS.

Inicio queda completado para estos tres ajustes. El commit, push y despliegue del conjunto local siguen pendientes. Se evaluó el versionado: estos cambios funcionales deben incluirse en la próxima publicación; este informe no crea una versión ni un tag oficial.
