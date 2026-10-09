# Inicio reestructurado — 7 de octubre de 2026

## Resultado

La propuesta aceptada se implementó en el dashboard local. Inicio reúne la jornada y los pendientes de los módulos habilitados, respetando los permisos del usuario y el establecimiento autenticado.

### Qué cambió

1. **Tu jornada de hoy:** perfil, fecha de Bogotá, identidad del establecimiento y acciones rápidas permitidas. Crear cita, cobrar y registrar cliente tienen prioridad; las demás acciones corresponden a las áreas disponibles.
2. **Resumen operativo:** por llegar, en espera, en atención y terminadas. Las cancelaciones y ausencias no se presentan como trabajo pendiente. Un establecimiento con solo tienda no recibe una agenda vacía.
3. **Necesita atención:** conversaciones que requieren al equipo, historias clínicas pendientes del día, entregas de peluquería, métodos de pago por confirmar, reposición y vencimientos de inventario, y una vista breve de seguimientos. Cada acceso abre el área correspondiente y conserva sus filtros.
4. **Agenda compacta:** hasta ocho citas visibles, con mascota, propietario, servicio, profesional y estado. Se conserva la ficha y sus acciones existentes. La agenda completa sigue disponible.
5. **Resultados del negocio:** ingresos registrados, gastos y diferencia del día, exclusivos de los usuarios con permiso financiero. Se aclara que estos importes no representan el efectivo físico ni la utilidad.

Las tarjetas antiguas de «El pulso de hoy» y los dos espacios de recordatorios se sustituyeron en Inicio por esta estructura. Los módulos conservan sus pantallas completas.

## Perfiles y módulos

| Perfil | Inicio |
| --- | --- |
| Administrador | Jornada del establecimiento, pendientes autorizados y resultados financieros. |
| Recepción | Agenda, clientes, WhatsApp y caja según los permisos vigentes; sin resultados administrativos. |
| Veterinario | Consultas de su ámbito e historias pendientes; otras acciones solo si están autorizadas. |
| Peluquero | Atenciones y entregas de su ámbito; otras acciones solo si están autorizadas. |
| Solo tienda | Acciones comerciales e inventario autorizados; sin agenda ni tarjetas clínicas o de peluquería. |

No se crearon perfiles ni reglas de autorización. Se reutiliza el contrato de acceso existente, incluidos sus permisos adicionales y módulos activos.

## Integración y límites

- Lecturas del servidor con autenticación existente; las operaciones desde el navegador usan el proxy autenticado.
- Navegación de Inicio, menú, barra superior, rutas del breadcrumb y ficha de cita conservan el establecimiento seleccionado. En empleados, la identidad del establecimiento continúa determinada por su sesión, no por un parámetro de URL.
- Los accesos de pendientes inicializan los filtros de atención humana, historias pendientes, entregas, revisión de cobros y estados de inventario.
- «Actualizar Inicio» vuelve a consultar el conjunto. El resumen compacto y sus acciones mantienen coherencia al actualizar; no se añadió una promesa de actualización en tiempo real.
- Los fallos parciales muestran «no disponible»; no se sustituyen por ceros ni por «sin pendientes».
- Las listas limitadas se identifican como parciales. Inventario muestra la presencia del problema y un ejemplo; no inventa un total a partir de una consulta de un producto. Seguimientos muestra una selección breve y remite al módulo para el listado completo.
- Los importes se calculan en centavos a partir de los movimientos existentes, conservando sus decimales.
- No se modificaron modelos, migraciones, reglas de precios, comisiones, estados de cita ni el motor de WhatsApp. La comprobación local no envió mensajes ni creó ventas, citas o clientes.

## Comprobaciones realizadas

### Lint y compilación

Desde `frontend`, con Node de Windows:

```powershell
& 'C:/Program Files/nodejs/node.exe' node_modules/eslint/bin/eslint.js
& 'C:/Program Files/nodejs/node.exe' node_modules/typescript/bin/tsc --noEmit --incremental false
$env:NEXT_VERIFY_BUILD='1'
& 'C:/Program Files/nodejs/node.exe' node_modules/next/dist/bin/next build
```

Resultado: ESLint y TypeScript finalizaron con código 0. La compilación de producción terminó correctamente y generó las páginas. La compilación de comprobación usa `.next/verification`, separada del frontend de desarrollo del usuario.

### Pruebas automatizadas de lógica

Desde la raíz:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test scripts/home-workspace.test.cjs scripts/pos-cash.test.cjs
```

Salida real de la última ejecución:

```text
✔ admin: todos los módulos y permisos adicionales respetan las fuentes autorizadas
✔ receptionist: todos los módulos y permisos adicionales respetan las fuentes autorizadas
✔ vet: todos los módulos y permisos adicionales respetan las fuentes autorizadas
✔ groomer: todos los módulos y permisos adicionales respetan las fuentes autorizadas
✔ La navegación conserva establecimiento, caso, fecha y filtro, incluidos caracteres reservados
✔ Cancelaciones y ausencias no reaparecen como trabajo pendiente; horas cerca de medianoche usan Bogotá
✔ Las áreas desactivadas no aparecen en la agenda de Inicio
✔ Resultados conservan decimales y un listado parcial nunca afirma un total global
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

Las pruebas incluyen 256 combinaciones de perfil, módulos y permisos adicionales, además de las tres comprobaciones existentes de caja.

### Navegador con datos locales reales

Chrome controlado por Playwright, sesión propia del administrador, frontend `http://localhost:3001` y backend local existente. Credenciales y cookies permanecen en memoria.

- Inicio autenticado, identidad real del establecimiento y una única sección de pendientes y resultados.
- Escritorio de 1440 px y móvil de 390 px, sin desbordamiento horizontal ni errores del navegador.
- Actualización de Inicio y diez fuentes consultadas mediante el proxy autenticado: todas respondieron HTTP 200.
- Filtros de destino: reposición, unidades vencidas, vencimientos próximos, caja por revisar, historias pendientes del día, peluquería lista para entrega y atención humana de WhatsApp.

Se respetó el límite local de solicitudes: el script espera antes de reintentar una lectura HTTP 429. No se cambiaron límites del servidor.

### Escenarios aislados de perfiles y errores

`scripts/verify-home-fixtures.cjs` ejecutó **13 escenarios satisfactorios** con un backend simulado de solo lectura y un frontend de producción separado:

- Los cuatro perfiles con veterinaria, peluquería y tienda.
- Administrador con cada módulo individual y cada combinación de dos módulos.
- Estado vacío, fallos parciales y listados limitados con los tres módulos.

Se comprobó visibilidad por permiso, ausencia de lecturas no autorizadas, aislamiento del establecimiento, navegación, límite de ocho citas y diseño móvil. Estos escenarios son simulaciones controladas; no sustituyen una prueba de cada perfil con cuentas reales en producción.

Capturas locales: `.cache/home-verification/desktop.png`, `mobile.png` y `fixture-*.png`. Los procesos temporales de comprobación se cerraron; los servidores de desarrollo del usuario siguieron funcionando.

## Estado de publicación

Implementación y comprobación local completadas. **Sin commit, push ni despliegue en esta solicitud.** La versión declarada permanece en `2.44.0`; el versionado de la siguiente publicación debe evaluarse antes del commit de cierre correspondiente.
