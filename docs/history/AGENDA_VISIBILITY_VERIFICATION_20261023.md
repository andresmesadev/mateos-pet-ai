# Agenda: diez citas por página y canceladas ocultas

**Estado: candidato 2.55.2, verificado automáticamente, 23/10/2026.**
El responsable autorizó commit, push y despliegue. Publicación pendiente de CI
y comprobaciones productivas. La comprobación visual en navegador sigue
pendiente por la configuración de Work; no se presenta como aprobada.

## Alcance solicitado y solución

Inicio recortaba «Agenda de hoy» a ocho citas mediante `slice(0, 8)`, sin
permitir recorrer las restantes. Ahora presenta hasta **diez citas por página**,
con «Anterior», «Siguiente» y número de página cuando hay más de diez. El
contador se calcula sobre las citas del filtro seleccionado; cambiar de filtro,
día o establecimiento reinicia la página. Si una actualización reduce la lista,
se usa una página válida para no mostrar una última página vacía.

Las citas con estado `cancelled` se ocultan antes de contar y paginar en Inicio.
El mismo filtro se aplica al conjunto semanal y al mensual de Agenda, después
de combinar las actualizaciones de citas, cubriendo semana, día, mes y vista
por profesional. Cancelar una cita deja de ocupar espacio en esas vistas.

La exclusión es de presentación. No se borran citas, pagos ni historial; tampoco
se cambia la regla para ausencias (`no_show`) o citas completadas. No hay cambios
de backend, permisos, aislamiento de Tenant, precios, comisiones ni schema.
No se editaron datos reales para verificarlo.

## Evidencia

- `node --test scripts/agenda-display.test.cjs scripts/home-adaptability.test.cjs scripts/home-workspace.test.cjs scripts/contact-navigation.test.cjs`:
  **23 pruebas aprobadas, 0 fallidas**. Incluye 9/10/11/21 citas, recorrido sin
  pérdidas/duplicados, canceladas excluidas antes del conteo, estados conservados
  y lista que pasa de dos páginas a una.
- `node node_modules/eslint/bin/eslint.js .`, desde frontend: **exit 0**.
- `node node_modules/next/dist/bin/next build`, desde frontend: **compilación,
  TypeScript y generación de las 32 páginas aprobados**. Primer intento bloqueado
  por red al descargar Geist; repetición con acceso de red aprobada, sin cambios
  de código para sortearlo.
- `git diff --check`: sin errores de espacios.
- Se preparó un escenario aislado con datos ficticios y componentes reales.
  La herramienta respondió **«Local browser use is disabled in Work settings»**.
  No se ejecutó la comprobación visual ni se presenta como aprobada. No se
  usaron controles alternativos del navegador para eludir esa restricción.

Se eligió **patch 2.55.2**, sin cambios de schema. La publicación conservará
la ventana anterior e iniciará otra de 48 horas; este registro de verificación
previa no acredita por sí solo el despliegue.
