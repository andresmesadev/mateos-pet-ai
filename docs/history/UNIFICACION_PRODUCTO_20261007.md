# Unificación del producto — implementación y comprobaciones

Fecha: 2026-10-07. Propuesta aceptada: [nueve mejoras de unificación](designs/PROPUESTA_UNIFICACION_PRODUCTO_20261007.md).

Estado: implementación local verificada. Esta entrega no incluye commit, push ni despliegue. La publicación anterior sigue documentada en [v2.44.0](RELEASE_2_44_0_VPS_20261007.md).

## Qué cambió

| Punto | Resultado |
| --- | --- |
| 1. Registro durante la cita | Recepción puede crear propietario y mascotas, o agregar una mascota al propietario seleccionado, sin salir de Nueva cita. Al volver se seleccionan los registros creados y se conservan servicio, fecha, profesional y hora válida. Se consulta otra vez la disponibilidad. Los formularios conservan los datos ante un error y protegen los cambios sin guardar. |
| 2. Puesta en marcha | Administración incluye una guía plegable que adapta servicios y horarios a las áreas habilitadas. Reutiliza las pestañas existentes y sus advertencias de cambios pendientes. Sus indicadores describen la última lectura; no certifican que el establecimiento esté completamente configurado. Inventario se enlaza únicamente con el permiso correspondiente. |
| 3. Ayuda contextual | Ayudas breves para recibir citas, registrar consultas, atender y entregar mascotas y confirmar cobros. Se muestran según las capacidades efectivas del usuario y la pantalla. Los enlaces conservan el establecimiento seleccionado. |
| 4. Pantallas principales | Clientes y mascotas, Administración, Punto de venta y Seguimiento de clientes son los destinos principales. Las entradas antiguas redirigen conservando establecimiento, caso y filtros. La búsqueda superior conserva el establecimiento tanto al seleccionar un resultado como al pulsar Enter. |
| 5. Contexto compartido | Agenda, registro clínico y notas de peluquería usan el mismo resumen de mascota, propietario, servicio, fecha, profesional y estado. El precio se presenta únicamente cuando la pantalla lo solicita y el permiso efectivo lo permite. Los expedientes siguen abriendo los formularios clínicos y de peluquería existentes. |
| 6. Confirmaciones y formularios | Las confirmaciones nativas se sustituyeron por diálogos del proyecto. Cancelar una confirmación o desmontar el componente no autoriza la operación. Se protegen los cambios de precio y los nuevos formularios; los errores de eliminación se presentan sin perder el listado. Se conserva la protección de salida de Administración y de la historia clínica. |
| 7. Limpieza | Se retiraron cuatro componentes sin consumidores: `home/operational-home.tsx`, `home/sections.tsx`, `daily-metrics-cards.tsx` y `services-manager.tsx`. La pantalla actual de Inicio, sus lectores compartidos y sus contratos se conservan. |
| 8. Terminología | El registro general utiliza establecimiento o negocio y ejemplos que incluyen veterinaria, peluquería y tienda. Las funciones clínicas conservan su terminología específica. |
| 9. Documentación | Se reconciliaron la introducción y las notas vigentes de Inventario en el modelo de dominio con los informes de publicación v2.42.0 y v2.43.0. Se preservó el contenido histórico. |

## Navegación

Se reutiliza `canonicalDashboardHref` para conservar parámetros, incluidos valores repetidos y caracteres reservados. Las selecciones de pestaña o vista del destino tienen prioridad sobre la selección antigua.

| Entrada anterior | Destino principal |
| --- | --- |
| `/dashboard/clients` | `/dashboard/contacto` |
| `/dashboard/pets` | `/dashboard/contacto?view=mascotas` |
| `/dashboard/services` | `/dashboard/settings?tab=localizacion` |
| `/dashboard/staff` | `/dashboard/settings?tab=usuarios` |
| `/dashboard/reports` | `/dashboard/pos?tab=reportes` |
| `/dashboard/revenue` | `/dashboard/pos?tab=historial` |
| `/dashboard/churn` | `/dashboard/recuperacion?tab=churn` |
| `/dashboard/opportunities` | `/dashboard/recuperacion?tab=oportunidades` |
| `/dashboard/reactivation` | `/dashboard/recuperacion?tab=reactivar` |

## Evidencia de verificación

### Análisis estático y compilación

Desde `frontend`, ESLint terminó sin diagnósticos y con código de salida 0. La compilación aislada con `NEXT_VERIFY_BUILD=1` terminó con código 0, compilación correcta, comprobación TypeScript y generación de 29/29 páginas. Se usó `.next/verification` para conservar la caché del servidor de desarrollo del usuario.

`git diff --check`: sin errores al finalizar.

La búsqueda en todo el repositorio no encontró consumidores de los cuatro componentes retirados; las menciones restantes son documentación histórica y comprobaciones de su retiro. La búsqueda de `window.confirm` en `frontend` y `scripts` devolvió cero coincidencias. Se mantienen los avisos `beforeunload` exigidos por el navegador para cerrar o recargar con cambios pendientes.

### Pruebas automatizadas

Comando desde la raíz:

```text
node --test scripts/product-unification.test.cjs scripts/home-workspace.test.cjs scripts/pos-reports.test.cjs
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Las nuevas pruebas cubren navegación con contexto, ayudas según las capacidades reales de cuatro perfiles y siete combinaciones de módulos, permisos adicionales y conservación de contratos compartidos. Se incluyen las regresiones existentes de Inicio y Reportes.

### Recorridos en Chrome

`scripts/verify-product-unification.cjs` comprobó:

- Cinco entradas antiguas en navegador conservando establecimiento, caso y filtros.
- Guía de Administración en las siete combinaciones de áreas, sin desbordamiento horizontal móvil.
- Búsqueda superior con Enter conservando el establecimiento.
- Primera cita: creación de propietario y mascota, conservación del borrador, protección de salida y conservación del texto ante un fallo de guardado.
- Otra mascota para el mismo propietario, identidad bloqueada, nueva consulta de disponibilidad y una sola solicitud de creación de cita con identidad de establecimiento correcta.
- Cancelación de una eliminación sin emitir una escritura.
- Resumen compartido en cita, consulta y peluquería, incluido formulario clínico habilitado sin registro previo, sin errores de ejecución ni desbordamiento móvil.
- Cambio de precio: Escape, seguir editando y descartar; ninguna escritura al descartar.
- Ayudas para recepción, veterinario y peluquero según sus permisos efectivos y su establecimiento autenticado.

`scripts/verify-home-fixtures.cjs` comprobó 13 escenarios de Inicio: cuatro perfiles, todas las combinaciones de áreas para administración, vacío válido, fallo parcial y listas parciales. También pasó la actualización de la marca de consulta después de nuevas lecturas.

Ambos scripts usan backend de prueba en memoria y frontend aislado en puertos 3030/3031. Los guardados del recorrido son solicitudes verificadas contra ese backend; estas pruebas no certifican una escritura real nueva en PostgreSQL ni un envío de WhatsApp. Los servidores del usuario y los datos reales se conservaron.

Capturas locales ignoradas por Git: `.cache/product-unification/appointment-mobile.png`, `clinical-summary-mobile.png` y `grooming-summary-mobile.png`.

## Decisiones y límites

- La implementación reutiliza endpoints, casos de uso, capacidades y resolución de precios existentes. No introduce tablas, migraciones ni reglas nuevas de agenda o cobro.
- Se preservaron los lectores y tipos de `home/fetchers.ts`. La revisión automática rechazó ampliar la limpieza a esos lectores; se completó el retiro seguro de componentes sin uso, con comprobación de referencias en el repositorio completo.
- No se incorporó un certificado persistido de puesta en marcha. La guía informa lo leído y dirige a la configuración vigente.
- Se evaluó el versionado: el registro dentro de la cita es una capacidad funcional nueva y corresponde considerar una versión menor al publicar el conjunto. La versión publicada 2.44.0 se conserva en esta entrega local; no se creó un tag ni se declaró una nueva publicación.
- La revisión de esta entrega comprende los recorridos afectados y sus regresiones compartidas; no es una certificación nueva de todas las integraciones externas del producto.
