# Inicio — tres ajustes finales aplicados

Fecha: 7 de octubre de 2026.

## Resultado

1. **Pendientes ordenados por perfil.** Administrador ve primero unidades vencidas y tareas operativas; recepción ve WhatsApp, cobros y entregas autorizadas; veterinario ve historias clínicas; peluquero ve entregas. La clasificación ordena las tareas que ya están autorizadas, sin agregar permisos ni cambiar estados.
2. **Hora de consulta junto a Actualizar Inicio.** Se muestra «Consultado a las … · hora de Colombia», con fecha ISO accesible en el elemento `time`. La hora se registra al terminar las lecturas del servidor y cambia al actualizar. Si falla una fuente habilitada, se muestra «Actualización parcial», incluso cuando esa fuente es la identidad del establecimiento, la agenda o los resultados financieros. Un módulo desactivado o una lista vacía válida no produce ese aviso.
3. **Lista compacta en móvil.** Por debajo de 640 px se presentan tres tipos de pendientes, más todos los avisos de fuentes no disponibles. «Ver otros pendientes» expande el resto y «Mostrar menos pendientes» vuelve a compactarlo. El contador corresponde a tipos ocultos, no a pacientes o productos. En escritorio se muestran todos los tipos y el botón de expansión no aparece.

El control móvil funciona con teclado y expone `aria-expanded` y `aria-controls`. Las filas ocultas no quedan disponibles para la navegación por teclado mientras están contraídas.

Se completó la desactivación de la precarga de enlaces de Inicio: la comprobación al alternar móvil y escritorio detectó lecturas anticipadas de pantallas no abiertas. Los enlaces conservan sus destinos y el establecimiento seleccionado.

## Archivos principales

- `frontend/lib/home-workspace.ts`: orden por perfil y detección de lecturas faltantes.
- `frontend/components/dashboard/home/attention-list.tsx`: expansión móvil y avisos siempre visibles.
- `frontend/components/dashboard/home/refresh-home.tsx`: hora de consulta, estado parcial y actualización.
- `frontend/components/dashboard/home/workspace.tsx`: integración con las fuentes existentes.
- `frontend/app/dashboard/page.tsx`: botón de actualización integrado junto a la hora de consulta.
- `frontend/components/dashboard/today-schedule.tsx`: enlaces de navegación sin precarga.

## Evidencia de comprobación

### Lint y compilación

Desde `frontend`:

```powershell
& 'C:/Program Files/nodejs/node.exe' node_modules/eslint/bin/eslint.js
$env:NEXT_VERIFY_BUILD='1'
& 'C:/Program Files/nodejs/node.exe' node_modules/next/dist/bin/next build
```

ESLint terminó con código 0, sin diagnósticos. Salida de compilación:

```text
✓ Compiled successfully in 932ms
Finished TypeScript in 2.8s
✓ Generating static pages using 11 workers (29/29)
```

La compilación de comprobación utiliza `.next/verification`, separada del frontend de desarrollo.

### Pruebas automatizadas

Desde la raíz:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test scripts/home-workspace.test.cjs scripts/pos-reports.test.cjs
```

Salida real:

```text
✔ El orden del perfil conserva exclusivamente las tareas recibidas y no modifica el listado original
✔ Actualización parcial distingue fallos autorizados, módulos desactivados y lecturas vacías válidas
ℹ tests 20
ℹ pass 20
ℹ fail 0
```

### Navegador

Chrome con Playwright, backend simulado de solo lectura y frontend de producción separado. Los 13 escenarios de perfiles, combinaciones de módulos, vacío, fallos y listas parciales finalizaron correctamente.

Comprobaciones añadidas:

- Primera tarea según el perfil y ausencia de tareas no autorizadas.
- Tres tipos visibles inicialmente en móvil; todos los errores visibles.
- Expansión con Espacio y contracción con Enter.
- Contador de tipos ocultos y estado accesible del control.
- Todas las tareas visibles en escritorio y control móvil ausente.
- Hora de consulta presente, estado parcial correcto y nueva hora después de actualizar.
- Conservación del establecimiento seleccionado, sin errores del navegador ni desbordamiento horizontal.

Salida relevante:

```text
PASS refresh: consultation timestamp advances after server reads
PASS fixture admin/veterinary+grooming+retail
PASS fixture receptionist/veterinary+grooming+retail
PASS fixture vet/veterinary+grooming+retail
PASS fixture groomer/veterinary+grooming+retail
PASS fixture admin/veterinary+grooming+retail: … partial failure
```

`git diff --check` terminó con código 0. Los avisos de normalización LF/CRLF corresponden a la configuración de Git en Windows.

## Estado

Los tres ajustes están implementados y comprobados localmente. La revisión de Inicio puede darse por cerrada. No se realizó commit, push ni despliegue en esta solicitud.
