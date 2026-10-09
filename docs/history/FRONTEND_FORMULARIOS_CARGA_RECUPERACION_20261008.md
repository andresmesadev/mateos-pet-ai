# Formularios, carga y recuperación del frontend

Fecha: 8 de octubre de 2026. Estado: implementado y comprobado localmente; pendiente de commit, push y publicación.

## Alcance aprobado

Se aplicaron los tres ajustes transversales aceptados por el responsable del proyecto: errores junto a los campos de registro, carga uniforme entre pantallas y recuperación de errores inesperados. Son mejoras de presentación y manejo de errores de capacidades existentes. No requieren entidades, casos de uso, tablas ni nuevas reglas de negocio; no constituyen un nuevo entregable de dominio ni una nueva fase.

## Cambios

### Formularios de clientes y mascotas

- Los campos requeridos muestran su explicación debajo del control, con `aria-invalid` y `aria-describedby`.
- Se enfoca el primer campo inválido en el orden del formulario. Las mascotas adicionales se validan por su identificador estable.
- Correo y peso conservan las restricciones de sus controles. La validación previa evita solicitudes con datos inválidos; el backend sigue siendo la autoridad.
- Los errores de guardado quedan visibles dentro del formulario, reciben foco y conservan los valores escritos. Los errores de conexión tienen una explicación en español.
- Guardar bloquea una segunda solicitud, la edición y el cierre mediante Escape. Cancelar conserva la confirmación de cambios pendientes.
- En móvil, los campos se apilan y las acciones quedan una debajo de otra. La inspección visual detectó un botón Cancelar recortado a 320 px; se corrigió y se añadió una comprobación de los límites de los botones dentro del diálogo.

Implementación compartida: [validación de controles](../../frontend/lib/form-feedback.ts), [feedback accesible](../../frontend/components/dashboard/form-feedback.tsx).

Integración: [registro de propietario y mascotas](../../frontend/components/dashboard/new-owner-pets-sheet.tsx), [nueva mascota](../../frontend/components/dashboard/new-pet-sheet.tsx), [componente de cliente simple](../../frontend/components/dashboard/new-client-sheet.tsx). El componente de cliente simple actualmente no tiene consumidores; los recorridos de navegador verificaron los dos formularios utilizados por el aplicativo.

### Carga entre pantallas

- Un [componente común](../../frontend/components/dashboard/dashboard-loading.tsx) dibuja estructuras de lista, agenda, chat, venta e Inicio.
- Se incorporó `loading.tsx` en Inicio y nueve áreas: Agenda, Consultas, Peluquería, Clientes y mascotas, WhatsApp, Punto de venta, Inventario, Seguimiento de clientes y Administración.
- Las estructuras muestran “Cargando…” y `aria-busy`; no presentan importes cero ni mensajes de lista vacía como si fueran resultados reales.
- Los elementos decorativos están ocultos a lectores de pantalla y respetan la preferencia de movimiento reducido.
- Se sustituyeron dos fallbacks vacíos del [layout](../../frontend/app/dashboard/layout.tsx). La carga de una página mantiene la navegación compartida montada; la comprobación inicial de permisos sigue siendo obligatoria.

### Recuperación de errores inesperados

- [Componente común](../../frontend/components/dashboard/workspace-error.tsx) con Reintentar y Volver a Inicio, foco en el encabezado y estado de reintento.
- Límites de error en [dashboard](../../frontend/app/dashboard/error.tsx), [aplicación](../../frontend/app/error.tsx) y [documento raíz](../../frontend/app/global-error.tsx).
- Se utilizó `retry()` de la documentación instalada de Next.js 16.3.6: vuelve a obtener y renderizar el segmento. El error raíz define su propio documento y estilos.
- No se muestran excepciones ni trazas técnicas al operador. Volver a Inicio conserva el establecimiento seleccionado en la URL.
- Los errores esperados de solicitudes mantienen sus avisos y reintentos locales. No se borran los borradores persistidos en el navegador.
- Este cambio no convierte formularios temporales en borradores persistentes frente a un cierre o fallo total del navegador. La conservación comprobada del registro corresponde al fallo de guardado mientras el formulario permanece abierto.

## Evidencia ejecutada

### Compilación y lint

Compilación aislada de la instancia de desarrollo del usuario:

```powershell
# Desde frontend/
$env:NEXT_VERIFY_BUILD='1'
node node_modules/next/dist/bin/next build
```

Salida de la última compilación:

```text
▲ Next.js 16.3.6 (Turbopack)
✓ Compiled successfully in 1007ms
Finished TypeScript in 2.4s
✓ Generating static pages using 11 workers (29/29) in 490ms
Finalizing page optimization
Exit code: 0
```

```text
Comando desde frontend/: node node_modules/eslint/bin/eslint.js
Salida: sin diagnósticos
Exit code: 0
```

### Navegador contra API ficticia autenticada

[Verificador general](../../scripts/verify-general-dashboard.cjs) con `--feedback-only`, que ejecuta los [escenarios específicos](../../scripts/verify-frontend-feedback.cjs). Playwright se tomó del runtime instalado en Codex mediante `NODE_PATH`; no se añadió una dependencia al aplicativo.

```text
PASS: 320px required fields, email/weight, dynamic pets, error focus, persistent failure and protected draft; no invalid writes or overflow.
PASS: 768px required fields, email/weight, dynamic pets, error focus, persistent failure and protected draft; no invalid writes or overflow.
PASS: 1440px required fields, email/weight, dynamic pets, error focus, persistent failure and protected draft; no invalid writes or overflow.
PASS: one submission while saving; fields and Escape protected; successful retry closes registration.
PASS: pet name error, locked owner, retained API failure and successful retry integrated into appointment.
PASS: real route Suspense fallback, mounted sidebar, no fake totals, recovery after delayed read at three widths.
PASS: expected API error stays local; unexpected render error retries and returns Home with tenant and browser draft intact.
PASS: 19 focused scenarios; fixture-only writes, zero real database changes or outgoing messages.
Exit code: 0
```

Se inyectó un error de datos para provocar un fallo real de renderizado y comprobar la recuperación del dashboard. Los límites de aplicación y documento raíz compilaron con la misma interfaz compartida; no se provocó un fallo del layout raíz en el recorrido de navegador.

Comprobaciones adicionales:

```text
git diff --check: exit code 0; sin diagnósticos de formato.
check-docs.cjs: 274 documentos, 655 enlaces comprobados; sin enlaces rotos ni referencias ausentes.
Puertos de verificación 3030/3031: 0 listeners al finalizar.
```

Capturas locales de esta ejecución: `.cache/general-dashboard/feedback-*.png`. Se revisaron visualmente el error de guardado a 320 px y la recuperación de pantalla en escritorio. Las capturas de prueba no son documentación publicada del producto.

## Estado de entrega

La revisión está completada localmente. Los servidores de prueba utilizaron únicamente los puertos 3030 y 3031 y finalizaron al terminar. No se modificó la base real, no se enviaron mensajes externos y no se desplegó en la VPS.

Se conserva la versión actual del proyecto. La evaluación de versión y el commit se realizan al preparar la siguiente publicación conjunta con los cambios locales anteriores.
