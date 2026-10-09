# Inicio: continuidad de la vista y fechas de seguimiento

Fecha: 2026-10-08. Estado: implementado y verificado localmente. Publicación pendiente.

## Cambios aplicados

### Recuperar la vista al regresar

Inicio recuerda el filtro de jornada y la página de «Necesita atención» al salir, regresar o recargar. Por ejemplo, recepción puede seleccionar «En espera», abrir una ficha y volver al mismo filtro.

- Preferencias en sessionStorage, separadas por usuario y establecimiento, con caducidad de 12 horas.
- Los enlaces con filtros explícitos tienen prioridad sobre lo guardado. Se conserva la compatibilidad con `review=1` y `review=0`.
- Los filtros se validan con los permisos y módulos actuales. La página se ajusta si la lista se reduce o cambia el tamaño disponible.
- Cerrar sesión o cambiar de usuario limpia las preferencias con el mecanismo compartido existente.
- Al regresar se consultan los datos actuales. Solo se guarda la selección de vista.

Se reutilizó `use-list-continuity`, añadiendo un argumento opcional para entradas heredadas. Sus demás consumidores conservan el comportamiento existente.

### Fechas de los seguimientos

Los ejemplos de «Seguimientos por revisar» muestran «Para hoy» o «Pendiente hace X días», junto con la fecha prevista. El cálculo usa días de calendario en hora de Colombia; admite fechas sin hora y timestamps con zona explícita.

Una fecha inválida aparece como «Fecha no disponible» y permanece visible para revisión. Los seguimientos futuros se excluyen de las prioridades pendientes. Se mantiene la selección breve de dos ejemplos y el enlace al módulo completo.

## Archivos principales

- `frontend/lib/home-adaptability.ts`: validación de preferencias y cálculo de fechas.
- `frontend/lib/use-list-continuity.ts`: compatibilidad opcional de enlaces de entrada.
- `frontend/components/dashboard/home/journey.tsx`: continuidad del filtro.
- `frontend/components/dashboard/home/attention-list.tsx`: continuidad y ajuste de página.
- `frontend/components/dashboard/home/workspace.tsx`: fecha y antigüedad de seguimientos.
- `scripts/home-adaptability.test.cjs`: comprobaciones unitarias adicionales.
- `scripts/verify-home-continuity.cjs`: recorrido completo de navegador aislado.

## Evidencia de verificación

### Comprobaciones estáticas y unitarias

```text
Frontend ESLint: exit 0; sin errores ni advertencias.
Build aislado de producción, NEXT_VERIFY_BUILD=1:
  Compiled successfully.
  Finished TypeScript.
  Generating static pages (29/29).
  Exit 0.

node --test scripts/home-adaptability.test.cjs scripts/home-workspace.test.cjs
  scripts/product-unification.test.cjs scripts/workspace-continuity.test.cjs
  scripts/whatsapp-workspace.test.cjs
Tests: 34. Pass: 34. Fail: 0. Exit 0.

git diff --check: exit 0; solo avisos LF/CRLF de Windows.
```

### Nuevo recorrido de navegador

`scripts/verify-home-continuity.cjs`, salida resumida, exit 0:

```text
PASS: filter and priority page return after leaving and reload; data is read again.
PASS: explicit entries and legacy review links override storage; Back/Forward and invalid parameters normalize.
PASS: preferences stay tenant-scoped and a shorter list corrects the saved page.
PASS: expired preferences reset; inactive agenda and follow-up modules do not restore forbidden views or reads.
PASS: follow-up examples show today, overdue age and date; future items stay out and invalid dates remain unavailable.
PASS: sign-out clears Home preferences and another user starts clean; zero business writes or browser errors.
```

### Regresiones por reutilizar el mecanismo compartido

Los siguientes recorridos también terminaron con exit 0:

- `verify-home-adaptability.cjs`: cuatro perfiles, pantallas de 320, 768 y 1440 px, filtros, totales, actualización, desconexión, formularios y revocación de permisos.
- `verify-home-fixtures.cjs`: 13 escenarios de perfiles, módulos, listas vacías, fallos y disponibilidad parcial.
- `verify-workspace-continuity.cjs`: Inventario, Peluquería, Consultas, búsqueda móvil y borradores de WhatsApp; navegación, caducidad, aislamiento y cierre de sesión.

No hubo errores de ejecución en el navegador ni escrituras de negocio durante el nuevo recorrido. Los servidores de prueba aislados fueron cerrados al terminar.

## Alcance y límites

Las comprobaciones de navegador usaron un backend de prueba controlado y el frontend compilado. No constituyen una validación nueva en la VPS. Se conservaron permisos y módulos existentes; no se añadieron entidades, migraciones, reglas de precios ni modificaciones de comisiones.

El alcance aprobado de Inicio queda completado localmente. Commit, push y despliegue siguen pendientes. Se evaluó el versionado: los cambios funcionales del conjunto deben reflejarse en su próxima publicación; esta tarea local no crea un tag oficial.
