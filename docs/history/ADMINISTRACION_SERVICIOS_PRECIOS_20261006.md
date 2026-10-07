# Administración — Servicios y precios

Fecha: 2026-10-06. Mejora autorizada del catálogo, creación, edición, duración, precio y retiro de servicios existentes.

## Resultado

- Catálogo con búsqueda por nombre que admite tildes o escritura sin tildes, filtro por categoría y listas de Activos y Retirados con cantidades.
- Duración visible como **minutos** y precio base identificado como **COP**. Se conservan hasta dos decimales cuando existen, sin redondearlos a pesos enteros en la presentación.
- Nuevo servicio abre un formulario centrado. Edición utiliza el mismo formato, con etiquetas permanentes, ayudas y vista previa monetaria.
- Precio explícito obligatorio en el formulario: un campo vacío no se convierte silenciosamente en $0. Se permite escribir 0, con advertencia visible. Duración positiva en minutos enteros; nombre de hasta 100 caracteres.
- Categorías de creación compatibles con las áreas activas. Los servicios existentes de áreas desactivadas siguen visibles y se identifican como tales.
- Edición del nombre, duración y precio base, manteniendo la categoría existente. Solo se envían los atributos modificados.
- Cancelar con cambios pide descartarlos o continuar editando. Se informa a la navegación de Administración de cambios pendientes y guardado en curso.
- Guardado bloqueado sin cambios y protección inmediata contra solicitudes simultáneas. Durante las operaciones, los controles correspondientes se deshabilitan.
- Los errores permanecen en el formulario sin borrar lo escrito. Duplicados y problemas de sesión muestran instrucciones comprensibles.
- **Retirar** sustituye la palabra ambigua “Eliminar”: abre confirmación, conserva el servicio y su historial y permite reactivarlo desde Retirados.
- Mensajes de resultado visibles y estados vacíos con acción para limpiar filtros o crear el primer servicio.

## Decisión de diseño

Se conserva la identidad del dashboard: blanco para contenido, fondo suave, texto oscuro y teal para acciones, con `bg-card`, `bg-muted`, `text-foreground` y `bg-primary`. El catálogo utiliza filas con nombre a la izquierda y duración/precio/acciones reconocibles; la edición se separa en una hoja centrada. En móvil cada fila se distribuye verticalmente y los campos quedan en una columna.

La mayor claridad se concentra en dos decisiones prácticas: distinguir precio base de tarifa por mascota y retiro de borrado. No se agregan estadísticas ni funciones comerciales nuevas a esta pantalla.

## Dominio y arquitectura

Se reutiliza el contexto Servicios existente, sus rutas y casos de uso de creación, actualización, cambio de precio y desactivación. La reactivación utiliza el contrato existente. La resolución central de precios no se modifica ni se duplica.

El nuevo componente `frontend/components/dashboard/service-catalog.tsx` sustituye los formularios anteriores de Servicios en `settings-view.tsx`. Las exportaciones compatibles se mantienen. `settings-tabs.tsx` conecta la protección de cambios pendientes y operaciones en curso.

Es una mejora de interfaz y comprobación de capacidades ya implementadas, no un nuevo entregable de Fase 2. No hay nuevo esquema, migración, reglas de negocio, motor conversacional ni permisos.

El adaptador existente todavía admite omitir el precio materializándolo como 0; el formulario ahora exige una decisión explícita. No se promete una transacción nueva para la combinación de atributos y precio: el adaptador existente mantiene su ejecución de casos de uso. Las tarifas por mascota y citas anteriores no se editan desde esta pantalla.

## Evidencia automática final

### Frontend

Lint completo desde `frontend`, `node node_modules/eslint/bin/eslint.js .`:

```text
lint exit_code=0
```

Build aislado, `NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build --webpack`:

```text
build exit_code=0
Compiled successfully in 6.8s
Finished TypeScript in 4.5s
Generating static pages (29/29) in 3.3s
```

La salida de verificación no reemplaza la caché de desarrollo habitual.

### Backend

Las suites se ejecutaron individualmente con `node node_modules/jest/bin/jest.js <archivo> --runInBand`, desde `backend`.

| Suite | Pruebas | Salida | Tiempo |
| --- | --- | --- | --- |
| `integration/dashboard-services-price-tenant-wiring.test.js` | `4 passed, 4 total` | 0 | 1.065 s |
| `integration/dashboard-pet-agreed-price.test.js` | `6 passed, 6 total` | 0 | 4.181 s |
| `unit/price-resolver.service.test.js` | `2 passed, 2 total` | 0 | 0.431 s |

Cada ejecución informó `Test Suites: 1 passed, 1 total`.

### PostgreSQL real

`node --test scripts/service-catalog-postgres.test.cjs`, salida 0:

```text
PASS: CRUD real, precio base actualizado, tarifa por mascota e historia intactas, rechazo de duplicados/precio negativo y aislamiento entre establecimientos.
tests 1
pass 1
fail 0
duration_ms 11348.7645
```

La prueba actualizó un servicio de $55.000 a $63.000, verificó que la resolución sin tarifa específica utilizaba $63.000 y que una mascota con tarifa acordada seguía en $40.000. La cita completada y la regla de precio específica permanecieron idénticas. Se comprobaron creación, duplicado 409, precio negativo 400 sin mutar atributos, retiro 204, reactivación 200 y rechazo 404 de actualización/retiro sobre otro establecimiento. Los datos temporales se limpiaron al terminar.

La primera ejecución de esta nueva prueba reveló un dato obligatorio ausente en su propia cita de prueba (`petName`); se corrigió la preparación incluyendo nombre y tipo de mascota y se obtuvo el resultado final anterior.

## Recorrido en navegador

Se ejecutó contra un establecimiento temporal exclusivo en PostgreSQL local y las rutas reales de Servicios, con frontend/API aislados en loopback 3121/3120. No se ejecutaron trabajos de producción ni se enviaron mensajes.

1. Buscar “bano” encontró “Baño”; filtrar Veterinaria dejó solo la consulta.
2. Nuevo servicio abrió el formulario centrado. Precio vacío bloqueó enviar con “Completa este campo”.
3. Nombre duplicado mostró el aviso con orientación a consultar Retirados. Cambiar el nombre permitió crear el servicio.
4. Editar sin cambios dejó Guardar cambios deshabilitado.
5. Un 503 simulado en la primera edición mostró el error y mantuvo nombre, duración y precio para reintentar. El siguiente guardado persistió nombre nuevo, 50 minutos y $63.000.
6. Cancelar una edición pendiente pidió confirmación; Seguir editando conservó lo escrito y Descartar cambios dejó el servicio anterior intacto.
7. Retirar pidió confirmación. Cancelarla conservó el servicio activo; confirmar lo movió a Retirados sin borrarlo.
8. Reactivar lo devolvió a Activos. Recargar conservó la creación y los cambios del servicio.
9. Una búsqueda sin coincidencias mostró el estado vacío y Limpiar filtros recuperó el catálogo.
10. A 375 px, ancho del documento 365 px; formulario centrado en x=16, ancho 343,2 px y altura 651,2 px, sin desbordamiento horizontal. Se restableció el tamaño del navegador.

Comprobación independiente posterior, `node scripts/verify-administration-local.cjs verify-services`, salida 0:

```text
PASS: creación, edición, retiro y reactivación comprobados en PostgreSQL local; cuatro servicios temporales conservados.
```

Se cerraron exclusivamente los procesos temporales identificados. `cleanup` y `cleanup-check` terminaron con salida 0:

```text
PASS: disposable tenant removed; existing business data unchanged.
PASS: no queda ningún establecimiento temporal de esta comprobación.
```

## Comprobación final en el servidor habitual

Se abrió `http://localhost:3001/dashboard/settings?tab=localizacion` con la sesión administradora existente. El catálogo real cargó 13 servicios activos. Las etiquetas accesibles finales de Duración (minutos) y Precio base (COP) se encontraron de forma inequívoca. Una escritura de prueba de `1000.50` mostró `$ 1.000,50`; se descartó sin enviar ni guardar ningún servicio real.

## Estado de publicación

Comprobado localmente. No se realizó commit, push, despliegue ni tag en esta tarea. La migración de teléfono de contacto del bloque anterior sigue formando parte del conjunto pendiente de publicación de Administración. El versionado se evaluará antes del cierre publicado.

Siguiente bloque propuesto: **Horarios y disponibilidad**, revisando horarios generales, por área, fechas especiales y claridad de los cambios sobre citas existentes.
