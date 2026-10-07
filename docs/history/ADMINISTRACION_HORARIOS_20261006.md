# Administración — Horarios y disponibilidad

Fecha: 2026-10-06. Estado: implementado y verificado localmente.

## Resultado

Disponible en Administración → Horarios y disponibilidad:
http://localhost:3001/dashboard/settings?tab=agenda

- Horario habitual con días abiertos/cerrados, etiquetas de apertura y cierre y hora de Bogotá.
- Copiar el lunes a los días abiertos conserva los días cerrados.
- Veterinaria y peluquería pueden heredar el horario habitual o configurar uno propio.
- Solo se muestran los editores de áreas activas; la configuración de áreas inactivas se conserva.
- Los días sin configuración mantienen su comportamiento vigente. Abrir el formulario no guarda ni materializa valores predeterminados.
- Validación antes de guardar, deshacer cambios, aviso de cambios pendientes y protección al cambiar de sección.
- Fallos de conexión conservan el borrador y permiten reintentar. Guardar actualiza el perfil del servidor para que las pestañas muestren los valores confirmados.
- Fechas especiales con alcance, cierre/apertura, fecha única o rango, motivo, revisión de citas afectadas, edición y confirmación para eliminar.
- La revisión de citas se invalida al editar el borrador; no queda un resultado antiguo al cambiar el alcance.
- Enlace a Equipo y accesos para gestionar la disponibilidad individual.

## Correcciones detectadas durante la comprobación

### Una fecha especial sin fecha final significa un solo día

La consulta anterior interpretaba un final nulo como un intervalo indefinido. Esto podía mantener un cierre después de su fecha y bloquear la creación de excepciones posteriores.

Se corrigió exclusivamente el predicado de intervalos en
`backend/src/services/agenda-exception.service.js`.
La consulta respeta ahora el día único y los extremos inclusivos de un rango.
Mantiene el aislamiento por establecimiento y la prioridad de la excepción del área sobre la global.

### Restricciones SQL rechazaban fechas y horas válidas

La prueba contra PostgreSQL reprodujo un error 500 al crear una fecha válida:
`AgendaException_dates_check` contenía barras duplicadas en su expresión regular.
La restricción de horas tenía el mismo problema.

La migración aditiva
`20261006224500_fix_agenda_exception_patterns` reemplaza ambas expresiones por clases `[0-9]`.
Fue aplicada a PostgreSQL local mediante `prisma migrate deploy`.
No cambia columnas, entidades ni datos de citas.
Debe aplicarse también en la VPS en el próximo despliegue autorizado.

Estas son correcciones del comportamiento ya diseñado en las etapas de Excepciones de Agenda, no una nueva capacidad de dominio. El motor de disponibilidad y el motor conversacional mantienen su implementación.

## Evidencia real

### Lint frontend

Comando: `node node_modules/eslint/bin/eslint.js .`, desde frontend.

```text
LINT EXIT 0
```

### Compilación aislada

Comando: `NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build --webpack`.
Salida en `.next/verification`, independiente del servidor de desarrollo.

```text
✓ Compiled successfully in 5.1s
Finished TypeScript in 2.7s
✓ Generating static pages using 11 workers (29/29)
exit_code: 0
```

### Regresión backend

Jest, con `--runInBand`:

- unit/availability.service.test.js
- unit/availability-db.service.test.js
- unit/agenda-exception.service.test.js
- integration/dashboard-tenant-profile.test.js

```text
Test Suites: 4 passed, 4 total
Tests:       81 passed, 81 total
Snapshots:   0 total
Time:        1.725 s
EXIT 0
```

### PostgreSQL y adaptadores reales

Comando: `node --test scripts/business-hours-postgres.test.cjs`.

La prueba ejecuta las rutas Express reales con establecimientos temporales y el resolvedor de disponibilidad vigente. Comprueba persistencia, herencia, apertura/cierre, días cerrados, festivos, preview sin guardar, fecha única, rango inclusivo, solapamiento, prioridad del área, edición, eliminación, aislamiento y conservación íntegra de una cita existente.

```text
PASS: horarios vacíos no materializan valores; herencia, deshacer, copia, días cerrados y validación comprobados.
✔ horarios: herencia, validación y copia conservan días cerrados
PASS: guardar/leer horarios, límites, herencia por área, festivos, preview, fecha única/rango, edición, eliminación, aislamiento e historial en PostgreSQL real.
✔ PostgreSQL y rutas reales: guardar horarios, resolver disponibilidad y conservar citas
tests 2
pass 2
fail 0
EXIT 0
```

### Recorrido del navegador

Contra frontend de producción temporal y rutas reales en 3121/3120:

1. Horario inicial sin cambios; domingo cerrado.
2. Hora de apertura posterior al cierre: error y guardado bloqueado.
3. Cambio de pestaña con borrador: diálogo; seguir editando conserva el formulario.
4. Horario propio de peluquería con días heredados.
5. Primer guardado falla intencionalmente con 503: borrador conservado.
6. Reintento correcto; valores confirmados siguen visibles al cambiar de pestaña y volver.
7. Preview de una fecha; cambiar alcance oculta el preview anterior.
8. Guardar cierre de un día; aparece en fechas configuradas.
9. Edición y cancelación; diálogo para eliminar y cancelación.
10. Lectura de PostgreSQL confirma lo guardado desde la interfaz.
11. Vista de 390 px y escritorio de 1536 px: sin desbordamiento horizontal; campos y acciones legibles.
12. Carga correcta de ambos formularios en el servidor del usuario, localhost:3001.

La eliminación efectiva se verificó en la prueba de rutas con registros temporales. En el navegador se comprobó el diálogo y su cancelación.

```text
PASS: horario habitual, horario propio de peluquería, herencia de días y fecha especial guardados desde la interfaz en PostgreSQL.
EXIT 0
PASS: disposable tenant removed; existing business data unchanged.
PASS: no queda ningún establecimiento temporal de esta comprobación.
EXIT 0
```

## Límites y siguiente apartado

La restricción inicial a horas completas fue sustituida, a solicitud del responsable, por la corrección de precisión documentada en `ADMINISTRACION_HORARIOS_MINUTOS_EQUIPO_20261006.md`: el editor y la disponibilidad ahora conservan HH:mm.
Bogotá sigue siendo la zona horaria vigente.
Los cambios no cancelan ni reprograman citas automáticamente.
No se enviaron mensajes ni se cambió el horario real del establecimiento durante las pruebas.
Este lote sigue local, sin commit, push ni despliegue.

Siguiente apartado: **Equipo y accesos**.
