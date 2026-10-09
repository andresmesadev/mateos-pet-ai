# Estructura unificada de formularios

Fecha: 8 de octubre de 2026. Estado: implementado y verificado localmente; pendiente de commit, push y despliegue.

## Alcance aprobado y aplicado

| Ajuste | Resultado |
| --- | --- |
| Secciones claras | Registro de propietario: contacto, mascotas e información adicional. Cita: cliente y mascota, servicio y profesional, fecha y hora. Producto: identificación, áreas de uso, costos y precio, existencias y reposición. |
| Estructura común | Encabezado fijo, un cuerpo desplazable y botones visibles de Guardar/Crear y Cancelar. Diseño comprobado a 320, 768 y 1440 px, con 608 px de alto. |
| Etiquetas y unidades | Etiquetas permanentes; COP, kg y unidades explícitos. Los datos secundarios opcionales se presentan en una sección plegable. Las alertas de manejo de la mascota permanecen visibles. |
| Validación y guardado | Errores junto al campo; foco en el primer error según su orden visual. Si el campo está en una sección plegada, se abre. Los fallos de guardado conservan los datos y permiten reintentar. |

Las secciones clínicas y de peluquería existentes se conservaron. El registro de una mascota y el formulario simple de cliente también usan la estructura común. El formulario simple de cliente es un componente sin consumidor actual: su verificación fue estática, sin atribuirle un recorrido real de navegador.

## Integración

- [Componentes de estructura](../../frontend/components/dashboard/form-layout.tsx): contenedor, encabezado, cuerpo, pie, secciones, campo e información adicional.
- [Validación compartida](../../frontend/components/dashboard/form-feedback.tsx): orden visual de errores, foco y apertura de secciones opcionales.
- [Citas](../../frontend/components/dashboard/new-appointment-dialog.tsx): selecciona un cliente real, valida sus mascotas y conserva el resto de la cita al actualizar horarios tras un conflicto 409.
- [Ficha del cliente](../../frontend/components/dashboard/client-sheet.tsx): edición como formulario, teléfono requerido, correo válido si se proporciona, pie fijo y fallo persistente al guardar.
- [Propietario y mascotas](../../frontend/components/dashboard/new-owner-pets-sheet.tsx), [mascota](../../frontend/components/dashboard/new-pet-sheet.tsx) y [cliente simple](../../frontend/components/dashboard/new-client-sheet.tsx): secciones, estructura común y campos adicionales opcionales.
- [Productos](../../frontend/components/dashboard/inventory/product-form.tsx): validación del formato monetario existente, mínimo entero de unidades, áreas requeridas y protección de cambios sin guardar. Los campos con movimientos asociados siguen bloqueados.
- [Operaciones de inventario](../../frontend/lib/use-inventory-operation.ts): la confirmación identifica la operación por su clave original. Recuperar una operación de otra pestaña no marca el borrador actual como guardado. El mecanismo de persistencia, consulta y reintento conserva las claves y el contenido enviados.
- [Estado de inventario](../../frontend/components/dashboard/inventory/operation-status.tsx): el formulario de producto lleva el foco al resultado persistente; las demás pantallas conservan su comportamiento mediante una opción desactivada por defecto.

No se modificaron modelos, migraciones, precios de dominio, permisos ni rutas del backend. Se mantuvieron el proxy autenticado, la selección del establecimiento y las claves que evitan duplicar operaciones. Las comprobaciones usan un backend simulado en memoria: no cambian PostgreSQL ni envían mensajes.

## Evidencia de ejecución

### Lint y compilación

Desde `frontend/`:

```text
node node_modules/eslint/bin/eslint.js
Exit code: 0; sin errores ni advertencias.

NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build
Next.js 16.3.6
Compiled successfully in 1941ms
Finished TypeScript in 8.0s
Generating static pages (29/29) in 618ms
Exit code: 0
```

La compilación utiliza el directorio de verificación aislado, sin detener los servicios de desarrollo del usuario.

### Navegador: estructura y recorridos

```text
node scripts/verify-general-dashboard.cjs --forms-only
PASS: 320px owner/pets sections, optional details collapsed, long registration scroll with fixed footer and discard guard.
PASS: 320px appointment field focus, typed client selection, 409 refresh, retained failure and save; fixed footer.
PASS: 320px client phone/email validation, optional section opens on error, retained save failure, discard guard and retry; fixed footer.
PASS: 320px product required fields, uses, COP format, integer stock, definitive failure and durable recovery without duplicate write; fixed footer.
Mismos grupos PASS a 768 y 1440 px.
PASS: slow product save uses one operation, fields and Escape locked; editing preserves presentation/lot policy and metadata version.
PASS: recovering another tab operation does not mark the current product draft as saved.
PASS: 33 form structure scenarios; fixture-only API writes, no real database changes or outgoing messages.
Exit code: 0

node scripts/verify-general-dashboard.cjs --feedback-only
PASS: required fields, email/weight, dynamic pets, error focus, persistent failure and protected draft; no invalid writes or overflow, a 320, 768 y 1440 px.
PASS: one submission while saving; fields and Escape protected; successful retry closes registration.
PASS: pet name error, locked owner, retained API failure and successful retry integrated into appointment.
PASS: real route Suspense fallback, mounted sidebar, no fake totals, recovery after delayed read at three widths.
PASS: expected API error stays local; unexpected render error retries and returns Home with tenant and browser draft intact.
PASS: 19 focused scenarios; fixture-only writes, zero real database changes or outgoing messages.
Exit code: 0
```

Total: 52 escenarios agrupados. Se revisaron visualmente las capturas de cita en móvil, producto en tableta y ficha de cliente en móvil. Las capturas reproducibles están en `.cache/general-dashboard/forms-*.png` y `feedback-*.png`; son evidencia local temporal, no archivos publicados.

Los scripts usan Playwright del runtime de Codex mediante `NODE_PATH`. Los puertos 3030 y 3031 son exclusivos de estas comprobaciones y se liberan al terminar.

`node --check` pasó para los tres scripts del recorrido. `git diff --check` terminó con código 0; las advertencias de normalización LF/CRLF no representan errores de parche.

Comprobación documental final: 275 documentos, 260 archivos Markdown y 666 enlaces; cero enlaces rotos, referencias ausentes, enlaces locales no portables o duplicados exactos. La consulta final de puertos no encontró listeners en 3030 ni 3031.

## Límites del cierre

La [siguiente ronda propuesta](../architecture/FRONTEND_AJUSTES_RESTANTES_FORMULARIOS_INVENTARIO_20261008.md) identifica formularios de movimientos de inventario, protección del cierre, listado móvil y controles pequeños. Está separada del trabajo aplicado y comprobado en este informe.

La evidencia certifica estos formularios y los recorridos descritos sobre contratos simulados. No certifica una nueva publicación en la VPS ni sustituye una prueba de integración con datos reales. Los cambios anteriores del repositorio se conservaron; este trabajo no crea un commit ni despliega.
