# Seguimiento de clientes: tres ajustes finales

Fecha: 5 de octubre de 2026. Estado: implementado y verificado localmente.

Propuesta aceptada: [customer-followup-next-adjustments.md](../architecture/customer-followup-next-adjustments.md). Continúa el [informe inicial](SEGUIMIENTO_CLIENTES_20261005.md).

## Cambios aplicados

1. **Pendientes por fecha.** Accesos Todos, Fechas pasadas, Hoy y Próximos 7 días. Las cantidades se calculan sobre todos los resultados que cumplen la búsqueda y el tipo, antes de paginar. Cada fila conserva su fecha exacta y añade una indicación relativa como Vence hoy o Dentro de 3 días.
2. **Último contacto.** Información destacada en cada cliente y en la revisión del envío. Filtros Todos, Sin contacto registrado y Con contacto registrado; este último admite fechas inicial y final opcionales. El rango es inclusive por días de Bogotá y rechaza una fecha inicial posterior a la final.
3. **Clientes con paginación real.** Búsqueda por propietario, mascota o teléfono en PostgreSQL antes de paginar, con 20 clientes por página. El propietario con más tiempo sin volver aparece primero, con identificador como desempate estable. La selección se conserva al cambiar de página o búsqueda; Limpiar selección permite retirarla explícitamente. Se mantiene el máximo de 500 destinatarios por envío.

## Integración y alcance

- Se reutilizan `PetNextAction`, `MedicalRecord`, `User.lastReminderSentAt` y el caso de envío existente. No hay nueva entidad ni migración.
- Las proyecciones de lectura viven en `dashboard-followup.service.js`, `dashboard-followup-dates.js` y `dashboard-inactive-clients.service.js`. El filtro de clientes usa SQL parametrizado y pertenencia del propietario y mascota al mismo establecimiento.
- `GET /api/dashboard/clients/inactive?page=1` devuelve datos y metadatos de paginación. Los consumidores antiguos que omiten `page` conservan su respuesta de array y su máximo anterior de 500; la pantalla actual usa el contrato paginado.
- Se conserva el criterio de inactividad de peluquería de más de 60 días basado en antecedentes `grooming`, incluido el tratamiento previo de fechas nulas. No se transforma en una recomendación clínica.
- Fechas pasadas excluye todo el día de hoy. Próximos 7 días comprende desde mañana hasta siete días después de hoy. La conversión utiliza el calendario de Bogotá existente en el dashboard.
- Un contacto registrado no acredita lectura del mensaje ni prohíbe un nuevo envío. La selección y confirmación siguen siendo explícitas. Los clientes enviados se retiran de la selección; los fallidos se conservan y su nombre permanece en el resultado.
- Se conserva el acceso administrativo y los permisos/módulos vigentes. El navegador utiliza el proxy autenticado existente.
- Las compilaciones de comprobación usan `NEXT_VERIFY_BUILD=1` y el directorio fijo `.next/verification`, evitando sobrescribir la salida del frontend de desarrollo abierto por el usuario. Next actualizó las inclusiones de tipos correspondientes en `tsconfig.json`. El arranque normal sigue usando `.next`.

## Evidencia de comandos

Desde `backend`, prueba dirigida:

```text
node node_modules/jest/bin/jest.js --runInBand --silent src/__tests__/dashboard-followup-dates.test.js src/__tests__/dashboard-followup.service.test.js src/__tests__/dashboard-inactive-clients.service.test.js
TARGETED EXIT 0
Test Suites: 3 passed, 3 total
Tests:       16 passed, 16 total
Time:        1.099 s
```

Suite completa, ejecutada por separado:

```text
node node_modules/jest/bin/jest.js --runInBand --silent
BACKEND EXIT 0 SIGNAL null
Test Suites: 166 passed, 166 total
Tests:       1302 passed, 1302 total
Time:        31.132 s
```

Una ejecución simultánea anterior de Jest y compilación terminó con código 9, sin resumen de Jest. La repetición separada terminó correctamente con la salida anterior.

Desde `frontend`:

```text
node node_modules/eslint/bin/eslint.js .
LINT EXIT 0 SIGNAL null

NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build --webpack
BUILD EXIT 0
✓ Compiled successfully in 14.6s
✓ Generating static pages using 11 workers (29/29) in 1638ms
```

La variable de compilación se estableció en el entorno de PowerShell antes del comando. El lint se repitió tras el último cambio de configuración y también terminó con código 0.

```text
git -c core.safecrlf=false diff --check
EXIT 0
```

## Recorrido en PostgreSQL y navegador

Entorno desechable:

```text
NEXT_VERIFY_BUILD=1 node scripts/serve-inventory-ui-local.cjs --seed-followups --seed-followup-pagination
PostgreSQL pagination verified: 524 clients, 27 pages, all-scope pet search,
contact filters 522/2, inclusive today contact=1, period counts=23/3/1/8.
```

- 524 clientes: primera página de 20 y página 27 de 4. Un cliente y su mascota que quedaban fuera del antiguo recorte se encuentran por búsqueda global. La búsqueda de un propietario de otro tenant devuelve cero resultados.
- Pendientes: Todos 23, Fechas pasadas 3, Hoy 1 y Próximos 7 días 8. El filtro Hoy muestra una fila con Vence hoy.
- Seleccionar un cliente en la primera página y otros 20 en la segunda conserva 21 destinatarios en la revisión, con sus nombres y vista previa personalizada.
- Contactos: 522 sin contacto registrado y 2 con contacto. Fechas de contacto desde/hasta 5 de octubre muestran exactamente un cliente, incluidos los contactos de ese día. Un rango 6 a 5 de octubre muestra el error y permite corregirlo.
- La herramienta de automatización al rellenar directamente un `input type=date` cambiaba solo su valor nativo sin emitir el cambio de React. La prueba se completó mediante teclado: los valores controlados y los resultados sí se actualizaron. No fue necesario modificar el manejador del producto.
- Se seleccionaron Beatriz y Ana desde búsquedas diferentes, y ambas aparecieron en la confirmación. El proveedor simulado devolvió un enviado y un fallido. Ana se retiró de la selección y su contacto se actualizó; Beatriz quedó seleccionada, identificada en el resultado fallido.
- Pantalla de 320 px: `scrollWidth=310`, sin desbordamiento horizontal, tanto en filtros de contacto con fechas como en Pendientes. El tamaño temporal se restableció.

Salida final del entorno:

```text
Private followup evidence: mock sends=2, done=1, dismissed=0, pending=22, contacted=3
Fixture evidence: products=0, movements=0, sales=0, returns=0, expenses=0, annulledExpenses=0
Private UI fixture removed.
EXIT 0
```

La acción realizada y las dos marcas de contacto anteriores forman parte de la siembra del fixture; el envío simulado añadió una marca. Se retiraron la base desechable, sus servidores y la pestaña de prueba. Los servicios del usuario se conservaron.

## Límites y publicación

- No se enviaron mensajes reales. La aceptación y entrega real por Meta siguen sin acreditarse mediante esta prueba.
- No se añadió persistencia de campañas ni garantía nueva de idempotencia entre solicitudes. Ante un resultado incierto se conserva la recomendación de revisar las conversaciones antes de repetir.
- La vista Según frecuencia habitual conserva su límite de 50 resultados. La paginación ampliada corresponde a Clientes sin visita de peluquería en más de 60 días.
- Los cambios anteriores de Inventario y Seguimiento se conservaron. No se hizo commit, push, tag ni despliegue en esta tarea. Antes de publicar corresponde evaluar el versionado del conjunto de mejoras.
