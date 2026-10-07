# Equipo y accesos: disponibilidad integrada con Agenda

Fecha de comprobación final: 7 de octubre de 2026.
Estado: los tres ajustes aceptados están implementados y verificados localmente.

## Qué quedó aplicado

1. **Horario individual al asignar citas.** Nueva cita permite elegir un profesional. Los horarios ofrecidos consideran su jornada, las ausencias, la duración completa del servicio y las otras citas asignadas. El servidor vuelve a comprobarlo al guardar. También se comprueba al cambiar el responsable desde Agenda o Peluquería.
2. **Ausencias programadas e imprevistas.** En Administración → Equipo y accesos, cada integrante tiene el botón **Ausencias y citas**. Permite registrar inicio, fin y motivo opcional; las horas se muestran en hora de Bogotá. Las nuevas asignaciones se bloquean durante ese rango.
3. **Revisión y reemplazo de citas afectadas.** Ese mismo panel muestra las reservas futuras afectadas por la disponibilidad actual. Permite buscar un reemplazo compatible y disponible, confirmar la reasignación o abrir Agenda. Guardar un horario y desactivar un integrante llevan a esta revisión. Cambiar disponibilidad conserva las reservas; no las cancela automáticamente.

## Cómo usarlo

- Para definir la jornada: **Equipo y accesos → Horario → Guardar**. Después, revisar las citas afectadas que muestra el panel.
- Para vacaciones, permisos o novedades: **Ausencias y citas → Registrar ausencia → Guardar ausencia**.
- Si hay reservas afectadas: **Buscar reemplazo → Profesional disponible → Confirmar reasignación**.
- Para reservar con un profesional específico: **Nueva cita → Servicio → Profesional responsable → Fecha y horario**.

Las citas sin profesional siguen permitidas. Al asignarlas posteriormente, se verifica la disponibilidad. Las atenciones iniciadas y el historial cerrado se conservan. La lista de revisión incluye citas futuras pendientes, confirmadas y recibidas.

## Integración y límites del alcance

Se reutilizan StaffAvailability y los casos de uso existentes de Staff; no se agrega un modelo ni una migración para estos ajustes. La decisión está documentada en [ADR 011](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/decisions/011-equipo-disponibilidad-agenda.md).

Las franjas estructuradas son la fuente de verdad cuando existen. El JSON semanal anterior es el respaldo cuando no hay franjas. Guardar una semana sincroniza ambas representaciones y conserva las ausencias; restablecer elimina solamente la restricción semanal individual. Una semana vacía significa todos los días cerrados; sin restricción individual, el flujo de reserva sigue comprobando el horario del establecimiento.

El resolver respeta varias franjas por día; el editor semanal advierte que guardar desde él las sustituye por una sola franja diaria. Las ausencias registradas se conservan; esta tarea no incluye una interfaz para corregirlas o retirarlas.

Se conserva la capacidad de una reserva por turno de una hora y área ya existente. La duración del servicio se usa adicionalmente para verificar la ventana completa del profesional. Las capacidades específicas configuradas y el perfil limitan qué servicios puede prestar.

La comprobación y escritura de nuevas asignaciones usan un lock por profesional compartido con los cambios de disponibilidad. La reasignación también exige que la cita conserve su estado y responsable originales. Se corrigió el tratamiento de la eliminación explícita del responsable y del servicio, y se verifican segundos y milisegundos en el límite de cierre.

La integración solicitada se aplica al dashboard. La resolución de Staff utilizada por la API propia reutiliza la regla temporal común y conserva UTC como valor predeterminado de su contrato. No se añade una selección de profesional al flujo de reserva por WhatsApp.

## Evidencia real de verificación

### PostgreSQL: disponibilidad y Agenda

Comando ejecutado desde la raíz:

```text
node --test scripts/staff-agenda-postgres.test.cjs

✔ Disponibilidad: minutos, rango completo, franjas partidas y límites de ausencia
✔ Equipo + Agenda: reservas, ausencias, revisión, reasignación, concurrencia y tenant real
ℹ tests 2
ℹ pass 2
ℹ fail 0
ℹ duration_ms 13344.8272
Exit code: 0
```

Incluye creación con profesional, filtrado de horarios, ausencias programadas e imprevistas, búsqueda real de reemplazos, reasignación, rechazo de perfiles incompatibles, aislamiento entre establecimientos, permisos de recepción, retiro del equipo, restablecimiento sin perder ausencias, concurrencia y conservación de fecha y estado.

### PostgreSQL: administración del equipo

```text
node --test scripts/team-administration-postgres.test.cjs

PASS: altas y cambios reales; horario 09:15–15:10 y reset; validación antes de escribir;
permisos por rol; acceso revocado; sin hashes expuestos; aislamiento entre establecimientos.
✔ Equipo: ficha, horario con minutos, permisos, acceso y aislamiento en PostgreSQL
ℹ tests 1
ℹ pass 1
ℹ fail 0
Exit code: 0
```

### Regresión de rutas y permisos

Desde backend:

```text
node node_modules/jest/bin/jest.js --runInBand --testPathPatterns='dashboard-manual-appointment|staff-tenant-wiring|veterinary-access|business-access|grooming-access'

Test Suites: 4 passed, 4 total
Tests:       51 passed, 51 total
Exit code: 0
```

```text
node node_modules/jest/bin/jest.js --runInBand --testPathPatterns='public-api.*wiring'

Test Suites: 5 passed, 5 total
Tests:       59 passed, 59 total
Exit code: 0
```

El mensaje de configuración `offline` en la prueba de permisos corresponde al escenario deliberado de servidor indisponible; la suite pasa.

### Frontend y sintaxis

```text
Desde frontend: node node_modules/eslint/bin/eslint.js .
Output: sin errores ni advertencias de ESLint
Exit code: 0
```

Build de producción verificado el 6 de octubre, con los mismos componentes finales:

```text
NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build
Compiled successfully
Finished TypeScript
Generating static pages (29/29)
Exit code: 0
```

La compilación usa `.next/verification` para aislarla del servidor de desarrollo. Se verificó sintaxis con `node --check` en los once archivos de backend de esta integración: todos pasaron. `git diff --check` terminó con código 0; solo mostró avisos de normalización LF/CRLF.

## Recorrido completo en navegador

Se utilizó un establecimiento temporal y datos ficticios en PostgreSQL local, con frontend y API de prueba en los puertos 3121/3120.

1. Abrir **Ausencias y citas** del veterinario de prueba.
2. Registrar ausencia programada que cruza una consulta futura.
3. Comprobar **Citas por revisar (1)** y conservar la reserva confirmada.
4. Buscar reemplazo, seleccionar otro veterinario y confirmar.
5. Comprobar el aviso **Cita reasignada** y **Citas por revisar (0)**.
6. Leer la reserva en PostgreSQL: responsable reemplazado, fecha `2099-01-05T15:30:00.000Z`, estado `confirmed` y servicio original conservados.
7. Comprobar pantalla móvil de 390 px: ancho de documento 390 px, diálogo de 358,4 px y sin desbordamiento horizontal.

### Ausencia y reserva afectada

![Ausencia guardada y cita afectada](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/EQUIPO_AUSENCIA_CITA_AFECTADA_20261006.png)

### Reasignación completada

![Cita reasignada y revisión sin pendientes](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/EQUIPO_CITA_REASIGNADA_20261007.png)

### Vista móvil

![Panel de ausencias en pantalla móvil](C:/Users/andre/Desktop/Proyectos/mateos-pet-ai/docs/history/EQUIPO_AUSENCIAS_MOVIL_20261007.png)

## Limpieza y entrega

Los scripts eliminaron sus propios establecimientos y filas de prueba con comprobación de marcadores. Resultado final:

```text
node scripts/verify-administration-local.cjs cleanup
PASS: disposable tenant removed; existing business data unchanged.

node scripts/verify-administration-local.cjs cleanup-check
PASS: no queda ningún establecimiento temporal de esta comprobación.
Exit code: 0
```

No se enviaron mensajes ni se probaron integraciones externas durante este recorrido. Los cambios están en el proyecto local; este ajuste todavía no tiene commit, push ni despliegue en la VPS.
