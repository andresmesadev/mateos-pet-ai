# Administración: Datos del negocio y navegación

Fecha: 2026-10-06. Implementado y comprobado localmente. Corresponde al primer bloque de la propuesta aprobada; las demás secciones de Administración conservan sus formularios y se revisarán por separado.

## Cambios

- Formulario único para nombre, descripción, correo y dirección del establecimiento. La dirección salió de Servicios.
- Grupos Identificación del negocio, Datos de contacto y Ubicación, con etiquetas asociadas, campos obligatorios/opcionales, validación, estado de guardado y errores visibles.
- Un solo botón Guardar datos del negocio. Campos bloqueados durante el envío y bloqueo inmediato de doble envío. Un fallo conserva los datos escritos; el éxito confirma los valores devueltos por el servidor.
- Navegación principal: Datos del negocio, Áreas del negocio, Servicios y precios, Horarios y disponibilidad y Equipo y accesos. Importar clientes y mascotas se presenta como herramienta aparte; sus instrucciones iniciales ahora anuncian el CSV de Mateos Pet que realmente exige el componente.
- Se retiró de la navegación la pantalla informativa Perfil fiscal, que solo anunciaba “Próximamente”. No se incorporó facturación electrónica.
- Selección conservada mediante `?tab=…`, manteniendo el parámetro `tenant`. Los identificadores anteriores de secciones siguen funcionando; una sección desconocida vuelve a Datos del negocio.
- Navegación por teclado con flechas, Inicio/Fin y activación con Enter; panel asociado a la pestaña seleccionada.
- Aviso para seguir editando o descartar al cambiar de sección o abrir un enlace del dashboard con cambios pendientes en Datos del negocio. Se añadió protección `beforeunload` durante cambios/guardado.
- Ruta de navegación unificada a Administración.

## Hallazgo que cambió la solución del teléfono

El formulario anterior permitía editar `phone`, pero el adaptador no lo persistía. La revisión completa reveló que **`Tenant.phone` también se usa como identificador de recepción de WhatsApp**, mediante `getTenantByPhone(parsed.phoneNumberId)` en el motor y en el adaptador de la recepcionista.

Por tanto, habilitar su edición como teléfono de contacto habría podido romper la resolución de mensajes entrantes. La versión final:

- Identifica el dato como Identificador del canal de WhatsApp y lo muestra de solo lectura.
- No lo envía al guardar el formulario.
- Rechaza expresamente intentos de modificarlo mediante el endpoint de perfil.
- Conserva su valor en PostgreSQL y no modifica el motor conversacional ni el esquema.

La primera comprobación exploratoria del teléfono se realizó exclusivamente sobre un establecimiento temporal y se descartó. La comprobación final certifica el canal intacto. Un teléfono de contacto independiente no quedó implementado: necesita separarse de este identificador antes de poder ofrecer edición real.

## Evidencia de comandos

### Lint

Comando: `npm run lint`, desde `frontend/`.

```text
> frontend@0.1.0 lint
> eslint
exit_code: 0
```

### Pruebas de backend

Comando: Node 24, Jest `--runInBand`, sobre `dashboard-tenant-profile`, `tenant-config-wiring`, `tenant.service`, `whatsapp.service.escalation` y `whatsapp.service.voice-fallback`.

```text
Test Suites: 5 passed, 5 total
Tests:       28 passed, 28 total
Snapshots:   0 total
Time:        1.537 s
exit_code: 0
```

Incluyen guardado por establecimiento autenticado, ignorar `tenantId` del body, limpieza de opcionales, rechazo de tipos/valores inválidos, protección del identificador de WhatsApp y rechazo sin establecimiento. El log de error de tasa de comisión corresponde al caso de validación negativo esperado de la suite existente.

### Pruebas de navegación

Comando: `node --test scripts/settings-navigation.test.cjs`.

```text
tests 6
pass 6
fail 0
duration_ms 423.5165
exit_code: 0
```

Verifican cancelación de `beforeunload` con cambios, ausencia de aviso sin cambios, confirmación antes de cambiar de sección/enlace, conservación de `tenant` y bloqueo de navegación durante guardado. La prueba de eventos comprueba el comportamiento del handler; Chrome decide la presentación del diálogo nativo. La recarga automatizada no permitió certificar visualmente ese diálogo, por lo que no se afirma esa comprobación visual.

### Compilación de la versión final

Comando: `NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build --webpack`, desde `frontend/`, con salida aislada en `.next/verification`.

```text
Compiled successfully in 5.5s
Finished TypeScript in 4.9s
Generating static pages (29/29) in 1649ms
exit_code: 0
```

### PostgreSQL local

Comando: `node scripts/verify-administration-local.cjs verify`.

```text
PASS: nombre, correo, descripción y dirección persistidos; identificador de WhatsApp conservado en PostgreSQL local.
exit_code: 0
```

El script ejecutó el adaptador real de perfil y el frontend compilado en puertos privados 3120/3121, con un establecimiento temporal nuevo en `mateos_dev`. No inició jobs ni envió mensajes. El cierre produjo:

```text
PASS: disposable tenant removed; existing business data unchanged.
```

La comprobación independiente `node scripts/verify-administration-local.cjs cleanup-check` terminó con código 0 y `PASS: no queda ningún establecimiento temporal de esta comprobación.` Los puertos 3120/3121 quedaron sin procesos escuchando.

## Recorrido en Chrome

- Error de guardado simulado: mostró el mensaje y mantuvo el borrador.
- Cambio de sección con cambios: mostró el diálogo; Seguir editando mantuvo los campos; Descartar y salir recuperó los datos persistidos al regresar.
- Enlace a Inventario con cambios: solicitó confirmación antes de salir.
- Guardado y recarga: nombre, descripción, correo y dirección conservaron los valores guardados; identificador del canal permaneció sin cambios y en solo lectura.
- Selección de Servicios y precios y recarga: `tab=localizacion` siguió seleccionada y conservó el establecimiento de la URL.
- Teclado: flecha derecha enfocó Áreas del negocio y Enter la activó.
- Nombre vacío: el navegador bloqueó el envío y mostró “Completa este campo”.
- Móvil a 375 px: ancho del documento 365 px, formulario 332,8 px y contacto en una columna; sin desbordamiento horizontal. Se restableció el tamaño del navegador.

## Alcance y publicación

La protección de cambios corresponde en este bloque al formulario Datos del negocio. Los formularios de las otras secciones todavía requieren su revisión individual.

No hay migraciones, commit, push ni despliegue en esta tarea. No se crea una versión/tag oficial: el versionado del conjunto de mejoras de Administración se evaluará antes de publicar su cierre. La prueba local temporal fue eliminada; la VPS no recibió cambios.

Siguiente bloque acordado: Áreas del negocio.

## Ampliación posterior: teléfono de contacto

Después del cierre de este primer bloque, el usuario autorizó el teléfono de contacto independiente. Se añadió `Tenant.contactPhone` y su migración aditiva local; `Tenant.phone` continúa protegido. La frase anterior sobre ausencia de migraciones corresponde al bloque original. La evidencia actualizada de la ampliación está en [ADMINISTRACION_TELEFONO_CONTACTO_20261006.md](ADMINISTRACION_TELEFONO_CONTACTO_20261006.md).

## Revisión posterior: Áreas del negocio

El segundo bloque extendió la protección de cambios pendientes y guardado a Áreas del negocio. Los otros formularios siguen sujetos a su revisión individual. Implementación y evidencia en [ADMINISTRACION_AREAS_20261006.md](ADMINISTRACION_AREAS_20261006.md).
