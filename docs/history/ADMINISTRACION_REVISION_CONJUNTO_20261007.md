# Administración — revisión del conjunto

Fecha: 7 de octubre de 2026.

**Resultado: revisión local completada, con los hallazgos corregidos. El conjunto está listo para preparar commit, push y despliegue.** La publicación y su comprobación en la VPS son el siguiente paso.

## Alcance revisado

| Sección | Aspectos comprobados |
| --- | --- |
| Datos del negocio | Guardado y lectura, teléfono de contacto separado del identificador de WhatsApp, validaciones y aislamiento entre establecimientos. |
| Áreas del negocio | Siete combinaciones de áreas, menú y acceso para cuatro perfiles, rechazo de selección vacía y conservación del historial. |
| Servicios y precios | Edición, precio base, conservación de tarifas por mascota, agrupación, retiro, reactivación y eliminación definitiva con confirmación y protección de antecedentes. |
| Horarios y disponibilidad | Minutos, herencia por área, días cerrados, excepciones de fecha única/rango y disponibilidad real sin modificar las citas existentes. |
| Equipo y accesos | Ficha, permisos, revocación, horarios, descansos, ausencias y sus correcciones auditadas, selección de servicios y revisión de citas afectadas. |
| Integración con Agenda | Disponibilidad del profesional durante toda la atención, rol y servicios compatibles, ausencias, reasignación y concurrencia. |

También se revisaron el proxy autenticado, las tres migraciones nuevas y los cambios en resolución de horarios, fechas y recordatorios. Los precios continúan resolviéndose mediante el servicio central existente. Las comisiones conservan su mecanismo de anulación y reemplazo.

## Hallazgos corregidos

### 1. Reasignación usando un servicio que había cambiado

Una solicitud de reasignación podía leer el servicio original y esperar el bloqueo del profesional nuevo. Durante esa espera, otra solicitud podía cambiar el servicio. La primera solicitud comprobaba la disponibilidad para el servicio anterior, pero podía guardar el profesional sobre el servicio nuevo.

Se corrigió en `backend/src/routes/dashboard/appointments.routes.js`: las escrituras de asignación comprueban también el servicio y la fecha leídos, junto con el estado y el profesional. Si la cita cambió, el servidor devuelve **409** y pide actualizar la agenda. La comprobación también cubre la asignación al iniciar una consulta y el cambio de servicio en una cita sin profesional.

Prueba real añadida a `scripts/staff-agenda-postgres.test.cjs`:

1. Bloquear temporalmente un especialista que solo atiende el servicio original.
2. Iniciar su reasignación y esperar hasta que lea la cita.
3. Cambiar el servicio con otra solicitud.
4. Liberar el bloqueo.
5. Comprobar **409**, conservación del servicio nuevo y del profesional válido anterior.

Salida obtenida:

```text
PASS: cambio simultáneo de servicio y profesional conserva la asignación válida
y rechaza la validación antigua con 409.
```

### 2. Pruebas anteriores sin el contrato de disponibilidad actual

La revisión ampliada detectó mocks incompletos en `appointmentPatch.test.js` y `veterinary-appointment-flow.test.js`. Se actualizaron con la transacción, el bloqueo y un profesional activo compatible. La prueba del precio ahora observa la escritura condicional y exige respuesta 200; sigue comprobando que asignar un servicio no copie automáticamente su precio base al precio final de la cita.

Las pruebas de rechazo por establecimiento ajeno, disputa por iniciar una consulta y conservación del precio continuaron pasando.

## Evidencia de verificación

### Suite completa del backend

Inventario obtenido mediante:

```text
node node_modules/jest/bin/jest.js --listTests --json --runInBand
167 archivos de pruebas
```

Los intentos iniciales de ejecución global no produjeron un informe final. El cierre utiliza el inventario completo ordenado y ejecutado en bloques disjuntos mediante:

```text
node node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath <archivos del bloque>
```

| Bloque | Suites aprobadas | Pruebas aprobadas | Código de salida |
| --- | ---: | ---: | ---: |
| 0.0 | 5 | 31 | 0 |
| 0.1 | 5 | 67 | 0 |
| 0.2 | 5 | 26 | 0 |
| 0.3 | 5 | 56 | 0 |
| 1 | 20 | 200 | 0 |
| 2 | 20 | 145 | 0 |
| 3 | 20 | 177 | 0 |
| 4 | 20 | 105 | 0 |
| 5 | 20 | 115 | 0 |
| 6 | 20 | 108 | 0 |
| 7 | 20 | 219 | 0 |
| 8 | 7 | 88 | 0 |
| **Total** | **167** | **1.337** | **Todos 0** |

Los bloques 1–8 contienen veinte archivos por bloque, salvo el último, de siete. Los primeros veinte archivos se ejecutaron en cuatro bloques de cinco. Incluyen las pruebas de todos los contextos, API pública, permisos, facturación, finanzas, clínica, comunicación y agenda.

### Administración: PostgreSQL local y navegación

```text
node --test scripts/business-areas-postgres.test.cjs
            scripts/business-contact-phone-postgres.test.cjs
            scripts/business-hours-postgres.test.cjs
            scripts/service-catalog-postgres.test.cjs
            scripts/settings-navigation.test.cjs
            scripts/staff-agenda-postgres.test.cjs
            scripts/team-administration-postgres.test.cjs

ℹ tests 14
ℹ pass 14
ℹ fail 0
Exit code: 0
```

La lista anterior corresponde a una sola invocación con los siete archivos. Se comprobaron rutas Express y PostgreSQL reales. La prueba de eliminación definitiva ejercita el proxy Next, Express y la base. Las comprobaciones de navegación cubren borradores, descarte, bloqueo durante guardado, recarga y conservación del establecimiento seleccionado.

Salidas relevantes:

```text
PASS: 7 combinaciones persistidas, 4 perfiles comprobados,
tenant ajeno e historial intactos, selección vacía rechazada.
PASS: perfil guardado y recargado, canal intacto, tenant ajeno intacto,
omisión, vaciado y CHECK verificados.
PASS: PostgreSQL conserva 10:20/10:30; disponibilidad y construcción
real de citas conservan sus minutos.
PASS: proxy Next real → Express → PostgreSQL: DELETE conserva confirmName
y elimina; validación, permisos, aislamiento, tarifas, historia y concurrencia protegidos.
PASS ADR 018: corrección y anulación auditadas, autor autenticado,
concurrencia 200/409, historial intacto, franjas con descanso,
servicios seleccionados/vacíos/por perfil, capacidades revocadas conservadas,
resolver canónico y tres perfiles sin permisos administrativos.
PASS: establecimientos e integrantes temporales eliminados.
```

Se emplearon establecimientos, integrantes y citas de prueba identificados y eliminados al terminar. Los actores de las rutas se inyectaron para comprobar permisos; esta evidencia no certifica el inicio de sesión de todos los empleados en producción.

### Frontend, esquema y revisión estática

```text
# Desde frontend
node node_modules/eslint/bin/eslint.js .
Exit code: 0, sin errores ni advertencias.

NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build
✓ Compiled successfully in 1214ms
Finished TypeScript in 4.5s
✓ Generating static pages using 11 workers (29/29)
Exit code: 0

# Desde la raíz
node node_modules/prisma/build/index.js validate
The schema at prisma\schema.prisma is valid
Exit code: 0

node node_modules/prisma/build/index.js migrate status
46 migrations found in prisma/migrations
Database schema is up to date!
Exit code: 0

git diff --check
Exit code: 0

node scripts/verify-administration-local.cjs cleanup-check
PASS: no queda ningún establecimiento temporal de esta comprobación.
Exit code: 0
```

La compilación utilizó el directorio de verificación separado. Se comprobaron sintácticamente los cuarenta archivos JavaScript nuevos o modificados del backend, sin errores. La búsqueda en todo el frontend encontró **cero llamadas cliente a `apiUrl` para endpoints autenticados**; el onboarding público conserva su excepción autorizada.

La evidencia visual del recorrido de Equipo y accesos, incluidos formularios en móvil, está en [Equipo: ajustes finales](EQUIPO_AJUSTES_FINALES_20261007.md). No se repitió ese recorrido visual en esta revisión; la corrección nueva afecta a escrituras del servidor y se comprobó mediante las rutas y PostgreSQL.

## Publicación preparada

**Versionado evaluado y aplicado:** incremento menor a **2.44.0**, por las capacidades funcionales nuevas de Administración. Backend, lockfile y endpoint de salud coinciden. Publicación y verificaciones de la VPS documentadas en el [informe de release](RELEASE_2_44_0_VPS_20261007.md).

Migraciones incluidas en el conjunto, ya aplicadas localmente:

1. `20261006180000_business_contact_phone`: columna nullable de contacto y restricción de formato; conserva el identificador del canal.
2. `20261006224500_fix_agenda_exception_patterns`: corrige las expresiones regulares de las restricciones de excepciones; conserva sus registros.
3. `20261007170000_staff_absence_correction_service_scope`: alcance de servicios, metadatos de anulación, vínculo de reemplazo y restricciones; conserva el comportamiento anterior mediante el valor predeterminado `auto`.

Publicación completada: versión, commit, push, CI aprobado, respaldo cifrado verificado, despliegue y tres migraciones aplicadas. Se certificaron salud 2.44.0, sesión real de administrador y lecturas autenticadas de las cinco secciones y agenda. Los guardados y permisos por perfil están verificados en PostgreSQL local y CI; no se modificó configuración de clientes reales ni se certificó login de todos los empleados en producción.

**No quedan hallazgos funcionales bloqueantes conocidos en el alcance revisado.** Administración está publicada; evidencia y límites en el [informe de release](RELEASE_2_44_0_VPS_20261007.md).
